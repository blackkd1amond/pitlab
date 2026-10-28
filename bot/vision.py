"""Распознавание блюд по фото и подсчёт КБЖУ через нейросеть с поддержкой картинок.

Работает с любым сервисом, совместимым с OpenAI API (OpenAI, OpenRouter, ProxyAPI и т. п.),
и с Anthropic (Claude). Настройки – в файле .env:
  AI_API_KEY   – ключ сервиса (обязательно)
  AI_BASE_URL  – адрес API, по умолчанию https://api.openai.com/v1
  AI_MODEL     – модель, по умолчанию gpt-4o-mini
  AI_PROVIDER  – openai (по умолчанию) или anthropic
"""
import base64
import json
import logging
import os
import re

import aiohttp

import config  # noqa: F401 – подгружает .env

AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
AI_PROVIDER = os.getenv("AI_PROVIDER", "openai").strip().lower()
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.anthropic.com/v1" if AI_PROVIDER == "anthropic" else "https://api.openai.com/v1").strip().rstrip("/")
AI_MODEL = os.getenv("AI_MODEL", "claude-haiku-4-5" if AI_PROVIDER == "anthropic" else "gpt-4o-mini").strip()
AI_PROXY = os.getenv("AI_PROXY", "").strip() or None

CATS = {"veg", "prot", "carb", "dairy", "snack", "drink", "ready"}

PROMPT = """Ты – нутрициолог приложения ПитЛаб для подростков-спортсменов. На фото – еда.
Определи каждое отдельное блюдо или компонент на тарелке (гарнир, мясо, овощи, соус, хлеб, напиток),
оцени его вес в граммах по размеру порции и дай КБЖУ на 100 г по справочным таблицам.
Ответь ТОЛЬКО JSON без пояснений, в таком виде:
{"food": true, "items": [{"name": "Гречка варёная", "grams": 150, "kcal": 110, "p": 4.2, "f": 1.1, "c": 21.3, "cat": "carb"}],
 "tip": "короткий дружелюбный совет по этой тарелке, 1 предложение, без оценки веса и внешности"}
kcal, p, f, c – на 100 г. cat – одно из: veg (овощи, фрукты, ягоды), prot (мясо, рыба, яйца, бобовые),
carb (крупы, макароны, картофель, хлеб), dairy (молочное), snack (сладкое, соусы, орехи), drink (напитки), ready (сложное блюдо целиком).
Названия – по-русски, коротко. Если на фото нет еды – {"food": false, "items": []}."""


def enabled() -> bool:
    return bool(AI_API_KEY)


def _parse(text: str) -> dict:
    m = re.search(r"\{.*\}", text or "", re.S)
    data = json.loads(m.group(0)) if m else {}
    items = []
    for x in data.get("items") or []:
        try:
            g = float(x.get("grams") or 0)
            if g <= 0:
                continue
            items.append({
                "name": str(x.get("name") or "Блюдо")[:40],
                "grams": round(min(g, 1500)),
                "kcal": round(max(0.0, float(x.get("kcal") or 0)), 1),
                "p": round(max(0.0, float(x.get("p") or 0)), 1),
                "f": round(max(0.0, float(x.get("f") or 0)), 1),
                "c": round(max(0.0, float(x.get("c") or 0)), 1),
                "cat": x.get("cat") if x.get("cat") in CATS else "ready",
            })
        except (TypeError, ValueError):
            continue
    return {"food": bool(data.get("food", bool(items))) and bool(items), "items": items[:12], "tip": str(data.get("tip") or "")[:200]}


async def analyze(image: bytes, mime: str = "image/jpeg") -> dict:
    """Возвращает {"food": bool, "items": [...], "tip": str}. Бросает исключение при ошибке сервиса."""
    b64 = base64.b64encode(image).decode()
    timeout = aiohttp.ClientTimeout(total=60)
    async with aiohttp.ClientSession(timeout=timeout) as s:
        if AI_PROVIDER == "anthropic":
            body = {"model": AI_MODEL, "max_tokens": 800, "messages": [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": mime, "data": b64}},
                {"type": "text", "text": PROMPT}]}]}
            headers = {"x-api-key": AI_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}
            async with s.post(f"{AI_BASE_URL}/messages", json=body, headers=headers, proxy=AI_PROXY) as r:
                data = await r.json(content_type=None)
                if r.status != 200:
                    raise RuntimeError(f"AI {r.status}: {str(data)[:300]}")
                text = "".join(c.get("text", "") for c in data.get("content", []) if c.get("type") == "text")
        else:
            body = {"model": AI_MODEL, "max_tokens": 800, "temperature": 0.2, "messages": [{"role": "user", "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}]}]}
            headers = {"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"}
            async with s.post(f"{AI_BASE_URL}/chat/completions", json=body, headers=headers, proxy=AI_PROXY) as r:
                data = await r.json(content_type=None)
                if r.status != 200:
                    raise RuntimeError(f"AI {r.status}: {str(data)[:300]}")
                text = data["choices"][0]["message"]["content"]
    logging.info("Ответ нейросети по фото: %s", (text or "")[:300])
    return _parse(text)
