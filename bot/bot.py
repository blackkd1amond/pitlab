"""Бот ПитЛаб (команда «Белая стрела»). Всё управление – кнопками, без команд со слешем.

Что умеет:
  • открывает мини-приложение ПитЛаб (кнопка внизу чата и кнопка меню);
  • присылает напоминания утром и вечером;
  • связывает подростка с тренером (по ссылке-приглашению или коду) и пересылает тренеру недельную сводку;
  • группы-челленджи с друзьями по залу: таблица очков за привычки (не за вес);
  • кнопка «Нет мотивации» с поддержкой и телефоном доверия;
  • «📊 Статистика» пилота – кнопка видна только команде (ADMIN_IDS в .env).

Запуск: python bot.py (подробно – в README.md).
"""
import asyncio
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandObject, CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton,
    FSInputFile, MenuButtonWebApp, Message, ReplyKeyboardMarkup, WebAppInfo,
)
from pathlib import Path

import db
from config import TG_PROXY, ADMIN_IDS, BOT_TOKEN, REMIND_EVENING, REMIND_MORNING, TZ_OFFSET_HOURS, WEBAPP_URL

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
router = Router()
TZ = timezone(timedelta(hours=TZ_OFFSET_HOURS))
BOT_USERNAME = ""  # заполняется при запуске
WELCOME_PIC = Path(__file__).resolve().parent / "welcome.png"

# Текст на пустом экране бота («Что умеет этот бот?») и короткое описание в профиле
DESCRIPTION = (
    "🍏 ПитЛаб – лаборатория питания для подростков, которые начали ходить в зал.\n\n"
    "🎯 Безопасная норма КБЖУ под твой возраст\n"
    "📒 Дневник питания и «Собери тарелку»\n"
    "📚 Уроки по 2 минуты\n"
    "🏆 Челленджи с друзьями\n"
    "🐣 Питомец Стрелка растёт от полезных привычек\n"
    "👟 Связь с тренером\n\n"
    "Без диет и рейтингов по весу. Жми «Запустить» 👇"
)
SHORT_DESCRIPTION = "Лаборатория питания для подростков в зале: норма, дневник, уроки и питомец Стрелка 🍏 Команда «Белая стрела»"

# ------------------------------------------------------------------ Кнопки
BTN_APP = "🍏 Открыть ПитЛаб"
BTN_GROUP = "🏆 Моя группа"
BTN_COACH = "👟 Тренер"
BTN_REMIND = "⏰ Напоминания"
BTN_SOS = "🆘 Нет мотивации"
BTN_HELP = "❓ Помощь"
BTN_STATS = "📊 Статистика"
BTN_CANCEL = "✖️ Отмена"
MENU_BUTTONS = {BTN_GROUP, BTN_COACH, BTN_REMIND, BTN_SOS, BTN_HELP, BTN_STATS, BTN_CANCEL}

# Код тренера T1234 или группы G1234 (буква латиницей или кириллицей, регистр любой)
CODE_RE = re.compile(r"^\s*([TtGgТтГг])\s*-?\s*(\d{4})\s*$")


class Wait(StatesGroup):
    coach_code = State()
    group_code = State()


def main_kb(uid: int) -> ReplyKeyboardMarkup:
    # Мини-приложение открывается именно этой кнопкой –
    # только так оно может отправлять сводку тренеру и очки в группу.
    rows = [
        [KeyboardButton(text=BTN_APP, web_app=WebAppInfo(url=WEBAPP_URL))],
        [KeyboardButton(text=BTN_GROUP), KeyboardButton(text=BTN_COACH)],
        [KeyboardButton(text=BTN_REMIND), KeyboardButton(text=BTN_SOS)],
        [KeyboardButton(text=BTN_HELP)] + ([KeyboardButton(text=BTN_STATS)] if uid in ADMIN_IDS else []),
    ]
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True, is_persistent=True)


def cancel_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text=BTN_CANCEL)]], resize_keyboard=True)


def ib(text, data=None, url=None, tab=None) -> InlineKeyboardButton:
    """Инлайн-кнопка: data – действие в боте, url – ссылка, tab – открыть вкладку мини-приложения."""
    if tab is not None:
        u = WEBAPP_URL + ((("&" if "?" in WEBAPP_URL else "?") + f"tab={tab}") if tab else "")
        return InlineKeyboardButton(text=text, web_app=WebAppInfo(url=u))
    if url:
        return InlineKeyboardButton(text=text, url=url)
    return InlineKeyboardButton(text=text, callback_data=data)


def ikb(*rows) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[list(r) for r in rows])


def invite_link(code: str) -> str:
    return f"https://t.me/{BOT_USERNAME}?start={code}"


def share_url(link: str, text: str) -> str:
    return f"https://t.me/share/url?url={quote(link)}&text={quote(text)}"


def esc(s) -> str:
    return str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def user(m):
    u = m.from_user
    db.upsert_user(u.id, u.first_name, u.username)
    return db.get_user(u.id)


SOS_TEXT = (
    "💚 <b>Нет мотивации – это нормально.</b>\n\n"
    "Срыв – не провал. Один день ничего не решает: решает то, что ты делаешь чаще всего.\n\n"
    "Попробуй прямо сейчас:\n"
    "• 🫁 подыши минуту: вдох на 4, задержка на 4, выдох на 6;\n"
    "• 💧 сделай один маленький шаг – стакан воды или одна отметка в ПитЛабе;\n"
    "• 🍽 съел больше, чем хотел? Не голодай и не «отрабатывай» – просто вернись к обычному режиму.\n\n"
    "Поговори с тренером, родителями или другом. Если тяжело на душе – бесплатно и анонимно:\n"
    "📞 <b>8-800-2000-122</b> – Детский телефон доверия.\n\n"
    "Если мысли о еде, весе или теле занимают почти всё время – обязательно расскажи взрослому, которому доверяешь, или врачу."
)


# ------------------------------------------------------------------ Старт и ссылки-приглашения
@router.message(CommandStart())
async def start(m: Message, command: CommandObject, state: FSMContext, bot: Bot):
    # Кнопка «Запустить» в Telegram. Ссылки-приглашения приходят сюда же: ?start=T1234 или ?start=G1234
    await state.clear()
    user(m)
    arg = (command.args or "").strip().upper()
    if arg.startswith("T"):
        return await link_coach(m, arg, bot)
    if arg.startswith("G"):
        return await join_group(m, arg)
    caption = (
        f"Привет, <b>{esc(m.from_user.first_name)}</b>! 👋\n"
        "Я <b>ПитЛаб</b> – лаборатория питания для тех, кто начал ходить в зал.\n\n"
        "<blockquote>🎯 Безопасная норма КБЖУ под твой возраст\n"
        "📒 Дневник питания и «Собери тарелку»\n"
        "📚 Уроки по 2 минуты с мини-тестами\n"
        "🏆 Челленджи с друзьями – очки за привычки\n"
        "🐣 Питомец Стрелка растёт вместе с тобой</blockquote>\n"
        "Без диет, без рейтингов по весу, без чувства вины 💚\n\n"
        f"👇 Жми <b>{BTN_APP}</b> – займёт 1 минуту"
    )
    kb = main_kb(m.from_user.id)
    sent = False
    if WELCOME_PIC.exists():
        try:
            await m.answer_photo(FSInputFile(WELCOME_PIC), caption=caption, reply_markup=kb)
            sent = True
        except Exception as e:
            logging.warning("Не удалось отправить картинку приветствия: %s", e)
    if not sent:
        await m.answer(caption, reply_markup=kb)
    await m.answer(
        "🐣 Я <b>Стрелка</b>, твой питомец. Показать, за что отвечает каждая кнопка внизу? Это 30 секунд.",
        reply_markup=ikb([ib("👀 Да, покажи", "tour:0"), ib("Потом", "tour:skip")]),
    )


# ------------------------------------------------------------------ Обучение от Стрелки по кнопкам бота
TOUR = [
    (BTN_APP, "Главная кнопка. Открывает приложение: норма, дневник, «Собери тарелку», уроки, челленджи и я – Стрелка. "
              "В приложении я тоже покажу, что где 😉"),
    (BTN_GROUP, "Создай группу с друзьями из зала и отправь им ссылку-приглашение. Соревнуемся только в полезных привычках – никаких рейтингов по весу."),
    (BTN_COACH, "Подключи своего тренера: открой его ссылку-приглашение или введи код. Он увидит только недельную сводку привычек – без веса и того, что ты ел."),
    (BTN_REMIND, "Я напомню про завтрак утром и про итоги дня вечером. Не нужно – выключишь в один тап."),
    (BTN_SOS, "Если опустились руки или сорвался – жми сюда. Там поддержка и телефон доверия. Срыв – не провал 💚"),
    (BTN_HELP, "Короткая шпаргалка по всем кнопкам. Отсюда же можно пройти это обучение заново."),
]


def tour_view(i: int):
    btn, text = TOUR[i]
    dots = "".join("🟢" if k == i else "⚪" for k in range(len(TOUR)))
    body = f"🐣 <b>Стрелка показывает · {i + 1}/{len(TOUR)}</b>\n\n👇 Кнопка внизу: <b>{btn}</b>\n\n{text}\n\n{dots}"
    nav = []
    if i > 0:
        nav.append(ib("◀️ Назад", f"tour:{i - 1}"))
    nav.append(ib("Дальше ▶️", f"tour:{i + 1}") if i < len(TOUR) - 1 else ib("✅ Понятно!", "tour:end"))
    rows = [nav]
    if i == 0:
        rows.append([ib("🍏 Открыть ПитЛаб сейчас", tab="")])
    return body, ikb(*rows)


@router.callback_query(F.data.startswith("tour:"))
async def tour_cb(c: CallbackQuery):
    arg = c.data.split(":", 1)[1]
    if arg == "skip":
        await c.message.edit_text("Хорошо! Если что – обучение есть в кнопке ❓ Помощь 🐣")
        return await c.answer()
    if arg == "end":
        await c.message.edit_text(
            "🎉 <b>Готово!</b> Теперь ты знаешь все кнопки.\n\nНачнём с малого: открой ПитЛаб и отметь сегодня завтрак или стакан воды. Я жду 🐣",
            reply_markup=ikb([ib("🍏 Открыть ПитЛаб", tab="")]),
        )
        return await c.answer("Ура!")
    i = max(0, min(len(TOUR) - 1, int(arg) if arg.isdigit() else 0))
    text, kb = tour_view(i)
    try:
        await c.message.edit_text(text, reply_markup=kb)
    except Exception:
        pass
    await c.answer()


@router.message(F.text == BTN_HELP)
async def help_btn(m: Message, state: FSMContext):
    await state.clear()
    await m.answer(
        "<b>Как пользоваться ПитЛабом</b>\n\n"
        f"{BTN_APP} – само приложение: норма, дневник, тарелка, уроки, челленджи, Стрелка.\n"
        f"{BTN_GROUP} – создать группу с друзьями из зала или посмотреть таблицу очков.\n"
        f"{BTN_COACH} – подключить своего тренера (или зарегистрироваться тренером).\n"
        f"{BTN_REMIND} – включить или выключить напоминания.\n"
        f"{BTN_SOS} – если опустились руки.\n\n"
        "Получил от друга или тренера ссылку-приглашение? Просто открой её – всё подключится само.\n\n"
        f"<i>Для команды проекта: твой Telegram id – <code>{m.from_user.id}</code></i>",
        reply_markup=main_kb(m.from_user.id),
    )
    await m.answer("🐣 Хочешь, Стрелка ещё раз покажет все кнопки?", reply_markup=ikb([ib("👀 Обучение по кнопкам", "tour:0")]))


@router.message(F.text == BTN_CANCEL)
async def cancel(m: Message, state: FSMContext):
    await state.clear()
    await m.answer("Окей, отменил 👌", reply_markup=main_kb(m.from_user.id))


# ------------------------------------------------------------------ Данные из мини-приложения
@router.message(F.web_app_data)
async def from_webapp(m: Message, bot: Bot, state: FSMContext):
    await state.clear()
    user(m)
    kb = main_kb(m.from_user.id)
    try:
        data = json.loads(m.web_app_data.data)
    except (ValueError, TypeError):
        return await m.answer("Не получилось прочитать данные из приложения 😕 Попробуй ещё раз.", reply_markup=kb)
    kind = data.get("t")

    if kind == "summary":
        db.save_summary(m.from_user.id, data)
        u = db.get_user(m.from_user.id)
        if u and u["coach_id"]:
            try:
                await bot.send_message(u["coach_id"], "📩 Новая сводка от подопечного\n\n" + summary_text(data, m.from_user.first_name))
                await m.answer("✅ Сводка отправлена тренеру!", reply_markup=kb)
            except Exception as e:  # тренер мог заблокировать бота
                logging.warning("Не удалось отправить тренеру: %s", e)
                await m.answer("Не получилось доставить сводку тренеру. Попроси его заново открыть бота.", reply_markup=kb)
        else:
            await m.answer("Сводка сохранена ✅", reply_markup=kb)
            await m.answer("Тренер пока не подключён. Подключить:", reply_markup=ikb([ib("🔑 Ввести код тренера", "coach:enter")]))
    elif kind == "sync":
        db.save_sync(m.from_user.id, data)
        u = db.get_user(m.from_user.id)
        if u and u["group_code"]:
            await m.answer(f"✅ Очки отправлены: {data.get('pts', 0)}", reply_markup=kb)
            await m.answer(table_text(u["group_code"], m.from_user.id), reply_markup=group_kb(u["group_code"]))
        else:
            await m.answer(f"✅ Твои очки за неделю: {data.get('pts', 0)}", reply_markup=kb)
            await m.answer("Чтобы соревноваться с друзьями, создай группу 👇", reply_markup=no_group_kb())
    else:
        await m.answer("Получил данные из приложения, но не понял, что с ними делать 🤔", reply_markup=kb)


def summary_text(d: dict, fallback_name: str) -> str:
    name = esc(d.get("n") or fallback_name)
    return (
        f"<b>ПитЛаб · неделя · {name}</b>\n"
        f"Активных дней: {d.get('act', 0)}/7\n"
        f"🍳 Завтрак: {d.get('br', 0)}/7 · 💧 Вода: {d.get('wa', 0)}/7 · 🥦 Овощи: {d.get('ve', 0)}/7\n"
        f"🏋️ Тренировок: {d.get('tr', 0)} · 📚 Уроков: {d.get('le', 0)}\n"
        f"🔥 Калории в среднем: {d.get('kc', 0)}% нормы\n"
        f"⚡ Энергия: {d.get('en') or '–'}/5 · 🏆 Очки: {d.get('pts', 0)} · уровень Стрелки {d.get('lvl', 1)}"
    )


# ------------------------------------------------------------------ Тренер
NO_COACH_TEXT = (
    "👟 <b>Тренер пока не подключён.</b>\n\n"
    "Попроси у тренера ссылку-приглашение и просто открой её. Или нажми кнопку и введи код тренера."
)


def no_coach_kb() -> InlineKeyboardMarkup:
    return ikb([ib("🔑 Ввести код тренера", "coach:enter")], [ib("Я тренер", "coach:iam")])


@router.message(F.text == BTN_COACH)
async def coach_btn(m: Message, state: FSMContext):
    await state.clear()
    u = user(m)
    if u["role"] == "trainer":
        return await m.answer(trainer_text(m.from_user.id), reply_markup=trainer_kb(u["trainer_code"]))
    if u["coach_id"]:
        t = db.get_user(u["coach_id"])
        return await m.answer(
            f"👟 Твой тренер: <b>{esc(t['name'] if t else '—')}</b>\n\n"
            "Он видит только недельную сводку привычек – без веса и того, что именно ты ел.",
            reply_markup=ikb([ib("📤 Отправить сводку тренеру", tab="profile")], [ib("❌ Отключить тренера", "coach:off")]),
        )
    await m.answer(NO_COACH_TEXT, reply_markup=no_coach_kb())


@router.callback_query(F.data == "coach:enter")
async def coach_enter(c: CallbackQuery, state: FSMContext):
    await state.set_state(Wait.coach_code)
    await c.message.answer("Напиши код тренера – например, <b>T4821</b>.", reply_markup=cancel_kb())
    await c.answer()


@router.message(StateFilter(Wait.coach_code), F.text, ~F.text.in_(MENU_BUTTONS))
async def coach_code_input(m: Message, state: FSMContext, bot: Bot):
    mt = CODE_RE.match(m.text or "")
    code = ("T" + mt.group(2)) if mt and mt.group(1).upper() in ("T", "Т") else None
    if not code or not db.find_trainer(code):
        return await m.answer("Такой код не найден 🤔 Проверь его у тренера и напиши ещё раз – или нажми «Отмена».")
    await state.clear()
    await link_coach(m, code, bot)


async def link_coach(m: Message, code: str, bot: Bot):
    t = db.find_trainer(code)
    kb = main_kb(m.from_user.id)
    if not t:
        return await m.answer("Ссылка тренера устарела или код неверный 🤔 Попроси у тренера новую.", reply_markup=kb)
    if t["id"] == m.from_user.id:
        return await m.answer("Это твоя собственная ссылка тренера 🙂", reply_markup=kb)
    db.set_coach(m.from_user.id, t["id"])
    await m.answer(
        f"✅ Тренер <b>{esc(t['name'])}</b> подключён.\n\n"
        "Он будет видеть только недельную сводку привычек – без веса и того, что именно ты ел.",
        reply_markup=kb,
    )
    await m.answer("Отправить первую сводку можно прямо сейчас:", reply_markup=ikb([ib("📤 Отправить сводку тренеру", tab="profile")]))
    try:
        await bot.send_message(t["id"], f"👋 К вам подключился подопечный: <b>{esc(m.from_user.first_name)}</b>.",
                               reply_markup=ikb([ib("👥 Мои подопечные", "tr:list")]))
    except Exception:
        pass


@router.callback_query(F.data == "coach:off")
async def coach_off(c: CallbackQuery):
    db.set_coach(c.from_user.id, None)
    await c.message.edit_text("Тренер отключён.", reply_markup=ikb([ib("🔑 Подключить снова", "coach:enter")]))
    await c.answer()


@router.callback_query(F.data == "coach:iam")
async def coach_iam(c: CallbackQuery):
    await c.message.edit_text(
        "Вы тренер? Вы получите ссылку для подопечных и будете видеть их недельные сводки.",
        reply_markup=ikb([ib("✅ Да, я тренер", "coach:iam_yes"), ib("Нет", "coach:back")]),
    )
    await c.answer()


@router.callback_query(F.data == "coach:back")
async def coach_back(c: CallbackQuery):
    await c.message.edit_text(NO_COACH_TEXT, reply_markup=no_coach_kb())
    await c.answer()


@router.callback_query(F.data == "coach:iam_yes")
async def coach_iam_yes(c: CallbackQuery):
    db.upsert_user(c.from_user.id, c.from_user.first_name, c.from_user.username)
    code = db.make_trainer(c.from_user.id)
    await c.message.edit_text(trainer_text(c.from_user.id), reply_markup=trainer_kb(code))
    await c.answer("Готово!")


def trainer_text(uid: int) -> str:
    u = db.get_user(uid)
    code = u["trainer_code"]
    lines = [
        "👟 <b>Кабинет тренера</b>\n",
        f"Ссылка для подопечных: {invite_link(code)}",
        f"Код (если ссылка не открывается): <code>{code}</code>\n",
        "Подросток открывает ссылку – и подключается к вам. Вы видите только недельные сводки привычек, без веса и подробностей еды.\n",
    ]
    st = db.students_of(uid)
    if not st:
        lines.append("Пока никто не подключился.")
    else:
        lines.append(f"<b>Подопечные ({len(st)})</b>")
        for s in st:
            ts, d = db.last_summary(s["id"])
            if d:
                when = datetime.fromtimestamp(ts, TZ).strftime("%d.%m")
                lines.append(f"• <b>{esc(s['name'])}</b> ({when}): активных дней {d.get('act', 0)}/7, "
                             f"тренировок {d.get('tr', 0)}, энергия {d.get('en') or '–'}/5")
            else:
                lines.append(f"• <b>{esc(s['name'])}</b>: сводки пока нет")
    return "\n".join(lines)


def trainer_kb(code: str) -> InlineKeyboardMarkup:
    return ikb(
        [ib("📨 Отправить ссылку подопечным", url=share_url(invite_link(code), "Подключайся ко мне в ПитЛабе – лаборатории питания 🍏"))],
        [ib("🔄 Обновить список", "tr:list")],
    )


@router.callback_query(F.data == "tr:list")
async def trainer_list(c: CallbackQuery):
    u = db.get_user(c.from_user.id)
    if not u or u["role"] != "trainer":
        return await c.answer("Это для тренеров", show_alert=True)
    text, kb = trainer_text(c.from_user.id), trainer_kb(u["trainer_code"])
    try:
        await c.message.edit_text(text, reply_markup=kb)
    except Exception:  # текст не изменился или это уведомление, а не кабинет
        if not (c.message.text or "").startswith("👟 Кабинет"):
            await c.message.answer(text, reply_markup=kb)
    await c.answer("Обновлено")


# ------------------------------------------------------------------ Группы-челленджи
def table_text(code: str, me: int) -> str:
    rows = db.group_table(code)
    medals = ["🥇", "🥈", "🥉"]
    lines = ["🏆 <b>Твоя группа</b> · очки за привычки этой недели\n"]
    for i, r in enumerate(rows):
        mark = medals[i] if i < 3 else f"{i + 1}."
        me_mark = " ← ты" if r["id"] == me else ""
        lines.append(f"{mark} {esc(r['name'])} – {r['pts']} очк. (Стрелка ур. {r['lvl']}){me_mark}")
    lines.append(f"\nКод группы: <code>{code}</code>")
    lines.append("Обновить свои очки – кнопка «📤 Отправить мои очки».")
    return "\n".join(lines)


def group_kb(code: str) -> InlineKeyboardMarkup:
    return ikb(
        [ib("📨 Пригласить друзей", url=share_url(invite_link(code), "Го соревноваться в полезных привычках в ПитЛабе 💪"))],
        [ib("📤 Отправить мои очки", tab="challenges"), ib("🔄 Обновить", "grp:refresh")],
        [ib("🚪 Выйти из группы", "grp:leave")],
    )


def no_group_kb() -> InlineKeyboardMarkup:
    return ikb([ib("➕ Создать группу", "grp:new")], [ib("🔑 Вступить по коду", "grp:join")])


@router.message(F.text == BTN_GROUP)
async def group_btn(m: Message, state: FSMContext):
    await state.clear()
    u = user(m)
    if u["group_code"]:
        return await m.answer(table_text(u["group_code"], m.from_user.id), reply_markup=group_kb(u["group_code"]))
    await m.answer(
        "🏆 <b>Группа с друзьями</b>\n\n"
        "Соревнуйтесь в полезных привычках: завтрак, вода, овощи, уроки. Никаких рейтингов по весу.\n\n"
        "Создай свою группу и отправь друзьям приглашение – или вступи по ссылке от друга.",
        reply_markup=no_group_kb(),
    )


@router.callback_query(F.data == "grp:new")
async def group_new(c: CallbackQuery):
    db.upsert_user(c.from_user.id, c.from_user.first_name, c.from_user.username)
    u = db.get_user(c.from_user.id)
    code = u["group_code"] or db.create_group(c.from_user.id)
    await c.message.edit_text(
        "🎉 <b>Группа создана!</b>\n\nНажми «Пригласить друзей» и выбери, кому отправить ссылку. "
        "Друг откроет её – и сразу окажется в группе.\n\n" + table_text(code, c.from_user.id),
        reply_markup=group_kb(code),
    )
    await c.answer()


@router.callback_query(F.data == "grp:join")
async def group_join_ask(c: CallbackQuery, state: FSMContext):
    await state.set_state(Wait.group_code)
    await c.message.answer("Напиши код группы – например, <b>G1234</b>.\nА если у тебя есть ссылка от друга – просто открой её.",
                           reply_markup=cancel_kb())
    await c.answer()


@router.message(StateFilter(Wait.group_code), F.text, ~F.text.in_(MENU_BUTTONS))
async def group_code_input(m: Message, state: FSMContext):
    mt = CODE_RE.match(m.text or "")
    code = ("G" + mt.group(2)) if mt and mt.group(1).upper() in ("G", "Г") else None
    if not code or not db.group_exists(code):
        return await m.answer("Группа с таким кодом не найдена 🤔 Проверь и напиши ещё раз – или нажми «Отмена».")
    await state.clear()
    await join_group(m, code)


async def join_group(m: Message, code: str):
    kb = main_kb(m.from_user.id)
    if not db.join_group(m.from_user.id, code):
        return await m.answer("Приглашение устарело или группа не найдена 🤔 Попроси у друга новую ссылку.", reply_markup=kb)
    await m.answer("✅ Ты в группе!", reply_markup=kb)
    await m.answer(table_text(code, m.from_user.id), reply_markup=group_kb(code))


@router.callback_query(F.data == "grp:refresh")
async def group_refresh(c: CallbackQuery):
    u = db.get_user(c.from_user.id)
    if not u or not u["group_code"]:
        await c.message.edit_text("Ты сейчас не в группе.", reply_markup=no_group_kb())
        return await c.answer()
    try:
        await c.message.edit_text(table_text(u["group_code"], c.from_user.id), reply_markup=group_kb(u["group_code"]))
    except Exception:
        pass  # таблица не изменилась
    await c.answer("Обновлено")


@router.callback_query(F.data == "grp:leave")
async def group_leave_ask(c: CallbackQuery):
    await c.message.edit_reply_markup(reply_markup=ikb([ib("Да, выйти", "grp:leave_yes"), ib("Остаться", "grp:refresh")]))
    await c.answer("Точно выйти?")


@router.callback_query(F.data == "grp:leave_yes")
async def group_leave(c: CallbackQuery):
    db.leave_group(c.from_user.id)
    await c.message.edit_text("Ты вышел из группы.", reply_markup=no_group_kb())
    await c.answer()


# ------------------------------------------------------------------ Напоминания и поддержка
def remind_view(on: bool):
    text = (f"⏰ Напоминания <b>включены</b>.\nУтром в {REMIND_MORNING} – про завтрак, вечером в {REMIND_EVENING} – подвести итоги дня."
            if on else "⏰ Напоминания <b>выключены</b>.")
    return text, ikb([ib("🔕 Выключить", "rem:off") if on else ib("🔔 Включить", "rem:on")])


@router.message(F.text == BTN_REMIND)
async def remind(m: Message, state: FSMContext):
    await state.clear()
    u = user(m)
    text, kb = remind_view(bool(u["remind"]))
    await m.answer(text, reply_markup=kb)


@router.callback_query(F.data.in_({"rem:on", "rem:off"}))
async def remind_toggle(c: CallbackQuery):
    db.upsert_user(c.from_user.id, c.from_user.first_name, c.from_user.username)
    on = c.data == "rem:on"
    db.set_remind(c.from_user.id, on)
    text, kb = remind_view(on)
    await c.message.edit_text(text, reply_markup=kb)
    await c.answer("Включены" if on else "Выключены")


@router.message(F.text == BTN_SOS)
async def sos(m: Message, state: FSMContext):
    await state.clear()
    await m.answer(SOS_TEXT, reply_markup=ikb([ib("Открыть поддержку в ПитЛабе", tab="sos")]))


# ------------------------------------------------------------------ Статистика пилота (кнопка только для команды)
def stats_text() -> str:
    s = db.pilot_stats()
    pct = lambda a, b: f"{round(a / b * 100)}%" if b else "–"
    return (
        "📊 <b>Пилот ПитЛаба</b>\n\n"
        f"Подростков в боте: {s['teens']}\n"
        f"Прислали данные из приложения: {s['synced']}\n\n"
        f"<b>Регулярность</b> (≥5 активных дней из 10): {s['regular']} ({pct(s['regular'], s['synced'])}) · цель – 20 из 30\n"
        f"<b>Полезность</b> 4–5 из 5: {s['rating_good']} из {s['ratings']} ({pct(s['rating_good'], s['ratings'])}) · "
        f"цель – ≥70%, средняя {s['rating_avg'] or '–'}\n"
        f"<b>Тест знаний</b>: средний «до» {s['test_before_avg'] or '–'}/10, пар «до–после» {s['pairs']}, "
        f"рост {s['growth_pct'] if s['growth_pct'] is not None else '–'}% · цель – +30%\n\n"
        "Данные приходят, когда подросток нажимает в приложении «Отправить мои очки в группу»."
    )


@router.message(F.text == BTN_STATS)
async def stats(m: Message, state: FSMContext):
    await state.clear()
    if m.from_user.id in ADMIN_IDS:
        await m.answer(stats_text(), reply_markup=ikb([ib("🔄 Обновить", "stats:refresh")]))


@router.callback_query(F.data == "stats:refresh")
async def stats_refresh(c: CallbackQuery):
    if c.from_user.id in ADMIN_IDS:
        try:
            await c.message.edit_text(stats_text(), reply_markup=ikb([ib("🔄 Обновить", "stats:refresh")]))
        except Exception:
            pass
    await c.answer("Обновлено")


# ------------------------------------------------------------------ Любой другой текст
@router.message(F.text)
async def fallback(m: Message, bot: Bot):
    # Если человек просто прислал код (T1234 или G1234) – подключаем и так.
    mt = CODE_RE.match(m.text or "")
    if mt:
        if mt.group(1).upper() in ("T", "Т"):
            return await link_coach(m, "T" + mt.group(2), bot)
        return await join_group(m, "G" + mt.group(2))
    await m.answer(f"Пользуйся кнопками внизу 👇 Приложение – <b>{BTN_APP}</b>.", reply_markup=main_kb(m.from_user.id))


# ------------------------------------------------------------------ Напоминания по расписанию
MORNING_TEXTS = [
    "🍳 Доброе утро! Завтрак – топливо для учёбы и тренировки. Отметь его в ПитЛабе – Стрелка будет рада.",
    "☀️ Утро! Начни день со стакана воды и завтрака. Отметить – в ПитЛабе.",
]
EVENING_TEXTS = [
    "🌙 Как прошёл день? Отметь воду и самочувствие в ПитЛабе – это 30 секунд.",
    "📚 Вечер – отличное время для урока на 2 минуты. Заходи в ПитЛаб!",
]


def _plus_minutes(hhmm: str, minutes: int) -> str:
    h, mm = map(int, hhmm.split(":"))
    t = min(h * 60 + mm + minutes, 23 * 60 + 59)
    return f"{t // 60:02d}:{t % 60:02d}"


async def reminders_loop(bot: Bot):
    kb = ikb([ib("🍏 Открыть ПитЛаб", tab="")], [ib("🔕 Выключить напоминания", "rem:off")])
    while True:
        try:
            now = datetime.now(TZ)
            hm, day = now.strftime("%H:%M"), now.strftime("%Y-%m-%d")
            for kind, at, texts in (("morning", REMIND_MORNING, MORNING_TEXTS), ("evening", REMIND_EVENING, EVENING_TEXTS)):
                if at <= hm < _plus_minutes(at, 30) and not db.reminder_done(kind, day):
                    text = texts[now.toordinal() % len(texts)]
                    for uid in db.remind_users():
                        try:
                            await bot.send_message(uid, text, reply_markup=kb)
                        except Exception as e:
                            logging.info("Напоминание не доставлено %s: %s", uid, e)
                        await asyncio.sleep(0.05)
        except Exception as e:
            logging.exception("Ошибка в напоминаниях: %s", e)
        await asyncio.sleep(30)


# ------------------------------------------------------------------ Запуск
async def main():
    global BOT_USERNAME
    db.init()
    from aiogram.client.session.aiohttp import AiohttpSession
    session = AiohttpSession(proxy=TG_PROXY) if TG_PROXY else None
    bot = Bot(BOT_TOKEN, session=session, default=DefaultBotProperties(parse_mode=ParseMode.HTML, link_preview_is_disabled=True))
    BOT_USERNAME = (await bot.get_me()).username
    dp = Dispatcher()
    dp.include_router(router)
    await bot.delete_my_commands()  # никаких команд со слешем – только кнопки
    try:
        await bot.set_my_description(description=DESCRIPTION)
        await bot.set_my_short_description(short_description=SHORT_DESCRIPTION)
    except Exception as e:
        logging.warning("Не удалось обновить описание бота: %s", e)
    await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="ПитЛаб", web_app=WebAppInfo(url=WEBAPP_URL)))
    asyncio.create_task(reminders_loop(bot))
    logging.info("ПитЛаб @%s запущен. Остановить: Ctrl+C", BOT_USERNAME)
    await dp.start_polling(bot)


if __name__ == "__main__":
    from aiogram.exceptions import TelegramUnauthorizedError
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except TelegramUnauthorizedError:
        raise SystemExit("\n❌ Telegram не принял токен. Скопируйте его заново у @BotFather (/mybots → бот → API Token) и вставьте в файл .env, затем сохраните (Cmd + S).")
