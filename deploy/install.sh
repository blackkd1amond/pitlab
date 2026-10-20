#!/bin/bash
# Установка бота ПитЛаб на сервер Ubuntu одной командой:
#   curl -fsSL https://raw.githubusercontent.com/blackkd1amond/pitlab/main/deploy/install.sh | sudo bash
set -e
echo "=== ПитЛаб: установка бота ==="
apt-get update -qq && apt-get install -y -qq python3-venv git curl >/dev/null
[ -d /opt/pitlab/.git ] || git clone -q https://github.com/blackkd1amond/pitlab /opt/pitlab
cd /opt/pitlab && git pull -q || true
python3 -m venv /opt/pitlab-venv
/opt/pitlab-venv/bin/pip install -q --upgrade pip
/opt/pitlab-venv/bin/pip install -q -r /opt/pitlab/bot/requirements.txt
mkdir -p /var/lib/pitlab
timedatectl set-timezone Europe/Moscow 2>/dev/null || true

if [ ! -f /etc/pitlab.env ]; then
  echo
  echo "Вставьте токен бота от @BotFather и нажмите Enter (символы не будут видны):"
  read -rs TOKEN < /dev/tty
  echo
  cat > /etc/pitlab.env <<ENV
BOT_TOKEN=$TOKEN
WEBAPP_URL=https://blackkd1amond.github.io/pitlab/
ADMIN_IDS=
TZ_OFFSET_HOURS=3
REMIND_MORNING=08:00
REMIND_EVENING=20:00
DATA_DIR=/var/lib/pitlab
TG_PROXY=
ENV
  chmod 600 /etc/pitlab.env
fi

echo "Проверяю связь с Telegram..."
if curl -s -m 10 -o /dev/null https://api.telegram.org; then echo "✅ Telegram доступен"; else
  echo "⚠️  Telegram недоступен с этого сервера. Впишите прокси в строку TG_PROXY= файла /etc/pitlab.env (nano /etc/pitlab.env) и выполните: systemctl restart pitlab-bot"; fi

cat > /etc/systemd/system/pitlab-bot.service <<'UNIT'
[Unit]
Description=PitLab Telegram bot
After=network-online.target
Wants=network-online.target
[Service]
EnvironmentFile=/etc/pitlab.env
WorkingDirectory=/opt/pitlab/bot
ExecStart=/opt/pitlab-venv/bin/python bot.py
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT

cat > /usr/local/bin/pitlab-update <<'UPD'
#!/bin/sh
cd /opt/pitlab || exit 0
git fetch -q origin main || exit 0
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  git reset -q --hard origin/main
  /opt/pitlab-venv/bin/pip install -q -r bot/requirements.txt
  systemctl restart pitlab-bot
fi
UPD
chmod 755 /usr/local/bin/pitlab-update
cat > /etc/systemd/system/pitlab-update.service <<'UNIT'
[Unit]
Description=PitLab auto-update
[Service]
Type=oneshot
ExecStart=/usr/local/bin/pitlab-update
UNIT
cat > /etc/systemd/system/pitlab-update.timer <<'UNIT'
[Unit]
Description=PitLab auto-update every 5 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable -q --now pitlab-bot
systemctl enable -q --now pitlab-update.timer
sleep 5
echo
systemctl --no-pager --lines=5 status pitlab-bot | sed -n '1,12p'
echo
echo "=== Готово! Бот работает на сервере круглосуточно. ==="
echo "Логи: journalctl -u pitlab-bot -f     Перезапуск: systemctl restart pitlab-bot"
