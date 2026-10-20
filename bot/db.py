"""Простая база данных SQLite для бота ПитЛаб (файл pitlab.db рядом с ботом)."""
import json
import random
import sqlite3
import time
from contextlib import closing

from config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    username TEXT,
    role TEXT DEFAULT 'teen',          -- teen | trainer
    trainer_code TEXT,                 -- код тренера (если role = trainer)
    coach_id INTEGER,                  -- id тренера, к которому подключён подросток
    group_code TEXT,                   -- код группы-челленджа
    remind INTEGER DEFAULT 1,          -- присылать напоминания
    created INTEGER
);
CREATE TABLE IF NOT EXISTS groups (
    code TEXT PRIMARY KEY,
    owner_id INTEGER,
    created INTEGER
);
CREATE TABLE IF NOT EXISTS summaries (
    user_id INTEGER,
    ts INTEGER,
    data TEXT
);
CREATE TABLE IF NOT EXISTS syncs (
    user_id INTEGER PRIMARY KEY,
    ts INTEGER,
    pts INTEGER, xp INTEGER, lvl INTEGER,
    a10 INTEGER,                       -- активных дней из последних 10
    tb INTEGER, ta INTEGER,            -- тест знаний до / после
    rating INTEGER,                    -- оценка полезности 1–5
    lessons INTEGER
);
CREATE TABLE IF NOT EXISTS reminders_sent (
    kind TEXT, day TEXT, PRIMARY KEY (kind, day)
);
"""


def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with closing(conn()) as c:
        c.executescript(SCHEMA)
        c.commit()


def upsert_user(uid, name, username):
    with closing(conn()) as c:
        c.execute(
            "INSERT INTO users (id, name, username, created) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET name = excluded.name, username = excluded.username",
            (uid, name, username, int(time.time())),
        )
        c.commit()


def get_user(uid):
    with closing(conn()) as c:
        return c.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()


def _new_code(prefix, table, column):
    with closing(conn()) as c:
        while True:
            code = f"{prefix}{random.randint(1000, 9999)}"
            if not c.execute(f"SELECT 1 FROM {table} WHERE {column} = ?", (code,)).fetchone():
                return code


def make_trainer(uid):
    u = get_user(uid)
    if u and u["trainer_code"]:
        return u["trainer_code"]
    code = _new_code("T", "users", "trainer_code")
    with closing(conn()) as c:
        c.execute("UPDATE users SET role = 'trainer', trainer_code = ? WHERE id = ?", (code, uid))
        c.commit()
    return code


def find_trainer(code):
    with closing(conn()) as c:
        return c.execute("SELECT * FROM users WHERE trainer_code = ?", (code.upper(),)).fetchone()


def set_coach(uid, coach_id):
    with closing(conn()) as c:
        c.execute("UPDATE users SET coach_id = ? WHERE id = ?", (coach_id, uid))
        c.commit()


def students_of(trainer_id):
    with closing(conn()) as c:
        return c.execute("SELECT * FROM users WHERE coach_id = ? ORDER BY name", (trainer_id,)).fetchall()


def create_group(uid):
    code = _new_code("G", "groups", "code")
    with closing(conn()) as c:
        c.execute("INSERT INTO groups (code, owner_id, created) VALUES (?, ?, ?)", (code, uid, int(time.time())))
        c.execute("UPDATE users SET group_code = ? WHERE id = ?", (code, uid))
        c.commit()
    return code


def group_exists(code):
    with closing(conn()) as c:
        return c.execute("SELECT 1 FROM groups WHERE code = ?", (code.upper(),)).fetchone() is not None


def join_group(uid, code):
    code = code.upper()
    with closing(conn()) as c:
        if not c.execute("SELECT 1 FROM groups WHERE code = ?", (code,)).fetchone():
            return False
        c.execute("UPDATE users SET group_code = ? WHERE id = ?", (code, uid))
        c.commit()
    return True


def leave_group(uid):
    with closing(conn()) as c:
        c.execute("UPDATE users SET group_code = NULL WHERE id = ?", (uid,))
        c.commit()


def group_table(code):
    with closing(conn()) as c:
        return c.execute(
            "SELECT u.id, u.name, COALESCE(s.pts, 0) AS pts, COALESCE(s.lvl, 1) AS lvl, s.ts "
            "FROM users u LEFT JOIN syncs s ON s.user_id = u.id WHERE u.group_code = ? "
            "ORDER BY pts DESC, lvl DESC, u.name",
            (code,),
        ).fetchall()


def save_summary(uid, data):
    with closing(conn()) as c:
        c.execute("INSERT INTO summaries (user_id, ts, data) VALUES (?, ?, ?)", (uid, int(time.time()), json.dumps(data, ensure_ascii=False)))
        c.commit()


def last_summary(uid):
    with closing(conn()) as c:
        r = c.execute("SELECT * FROM summaries WHERE user_id = ? ORDER BY ts DESC LIMIT 1", (uid,)).fetchone()
        return (r["ts"], json.loads(r["data"])) if r else (None, None)


def save_sync(uid, d):
    def num(k):
        v = d.get(k)
        return int(v) if isinstance(v, (int, float)) else None
    with closing(conn()) as c:
        c.execute(
            "INSERT INTO syncs (user_id, ts, pts, xp, lvl, a10, tb, ta, rating, lessons) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET ts = excluded.ts, pts = excluded.pts, xp = excluded.xp, lvl = excluded.lvl, "
            "a10 = excluded.a10, tb = COALESCE(excluded.tb, syncs.tb), ta = COALESCE(excluded.ta, syncs.ta), "
            "rating = COALESCE(excluded.rating, syncs.rating), lessons = excluded.lessons",
            (uid, int(time.time()), num("pts") or 0, num("xp") or 0, num("lvl") or 1, num("a10") or 0, num("tb"), num("ta"), num("r"), num("ls") or 0),
        )
        c.commit()


def set_remind(uid, on):
    with closing(conn()) as c:
        c.execute("UPDATE users SET remind = ? WHERE id = ?", (1 if on else 0, uid))
        c.commit()


def remind_users():
    with closing(conn()) as c:
        return [r["id"] for r in c.execute("SELECT id FROM users WHERE remind = 1 AND role = 'teen'").fetchall()]


def reminder_done(kind, day):
    """True, если напоминание этого типа за этот день уже отправлено; иначе отмечает его и возвращает False."""
    with closing(conn()) as c:
        if c.execute("SELECT 1 FROM reminders_sent WHERE kind = ? AND day = ?", (kind, day)).fetchone():
            return True
        c.execute("INSERT INTO reminders_sent (kind, day) VALUES (?, ?)", (kind, day))
        c.commit()
        return False


def pilot_stats():
    with closing(conn()) as c:
        teens = c.execute("SELECT COUNT(*) FROM users WHERE role = 'teen'").fetchone()[0]
        synced = c.execute("SELECT * FROM syncs").fetchall()
    regular = sum(1 for s in synced if (s["a10"] or 0) >= 5)
    ratings = [s["rating"] for s in synced if s["rating"]]
    pairs = [(s["tb"], s["ta"]) for s in synced if s["tb"] is not None and s["ta"] is not None]
    tb = [s["tb"] for s in synced if s["tb"] is not None]
    return {
        "teens": teens,
        "synced": len(synced),
        "regular": regular,
        "ratings": len(ratings),
        "rating_avg": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "rating_good": sum(1 for r in ratings if r >= 4),
        "test_before_avg": round(sum(tb) / len(tb), 2) if tb else None,
        "pairs": len(pairs),
        "growth_pct": round((sum(a for _, a in pairs) / max(1, sum(b for b, _ in pairs)) - 1) * 100, 1) if pairs else None,
    }
