"""Настройки бота ПитЛаб. Все значения берутся из файла .env рядом с ботом."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()

# ID администраторов (через запятую) – им видна кнопка «📊 Статистика»
ADMIN_IDS = {int(x) for x in os.getenv("ADMIN_IDS", "").replace(" ", "").split(",") if x.isdigit()}

# Часовой пояс пилота (по умолчанию Москва, UTC+3) и время напоминаний
TZ_OFFSET_HOURS = int(os.getenv("TZ_OFFSET_HOURS", "3"))
REMIND_MORNING = os.getenv("REMIND_MORNING", "08:00")
REMIND_EVENING = os.getenv("REMIND_EVENING", "20:00")

# На сервере база лежит в отдельной папке (DATA_DIR), чтобы обновления кода её не трогали
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR)))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / os.getenv("DB_FILE", "pitlab.db")

# Прокси до Telegram (если сервер в России не достаёт до api.telegram.org), например http://user:pass@host:port
TG_PROXY = os.getenv("TG_PROXY", "").strip() or None

import re as _re
if not _re.fullmatch(r"\d{6,12}:[A-Za-z0-9_-]{30,}", BOT_TOKEN):
    raise SystemExit(
        "\n❌ В файле .env нет настоящего токена бота.\n"
        "1) Откройте файл: open -e ~/Downloads/pitlab-mvp/bot/.env\n"
        "2) В строке BOT_TOKEN= вместо слов вставьте токен от @BotFather (вида 7412345678:AAH...), без пробелов и кавычек\n"
        "3) Сохраните: Cmd + S – и запустите бота снова: python bot.py"
    )
if not WEBAPP_URL.startswith("https://"):
    raise SystemExit("WEBAPP_URL в .env должен начинаться с https:// – это адрес мини-приложения (см. README).")
