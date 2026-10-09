export const REQUIREMENTS = String.raw`requests>=2.32.0

# برای خواندن خودکار کد امنیتی (اختیاری، فقط اگر auth_mode = ocr باشد)
# ddddocr>=1.5.6

# برای اجرای سریع‌تر و پشتیبانی از HTTP/2 (اختیاری)
# httpx[http2]>=0.27.0
`;

export const CONFIG_EXAMPLE = String.raw`{
  "base_url": "https://t3223.cfu.ac.ir",
  "username": "4030123456",
  "password": "YOUR_PASSWORD",
  "auth_mode": "session",
  "session_cookie": "",
  "captcha_url": "/captcha",
  "weekdays": [0, 1, 2, 3, 4],
  "meals": ["lunch"],
  "food_preference": "first",
  "max_price": 0,
  "look_ahead_days": 8,
  "run_hour": 8,
  "run_minute": 5,
  "dry_run": false,
  "verify_tls": true,
  "notify_telegram": false,
  "telegram_bot_token": "",
  "telegram_chat_id": "",
  "endpoints": {}
}
`;

export const ENV_EXAMPLE = String.raw`# کلید رمزنگاری رمز عبور در نسخه وب (حتماً عوض کنید)
APP_SECRET=change-me-to-a-long-random-string

# رمز فراخوانی /api/cron/run (اگر خالی باشد بدون رمز هم کار می‌کند)
CRON_SECRET=change-me

# اطلاعات کالینان (برای GitHub Actions هم استفاده می‌شود)
KALLINAN_URL=https://t3223.cfu.ac.ir
KALLINAN_USER=4030123456
KALLINAN_PASS=your-password

DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
`;

export const DOCKERFILE = String.raw`FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 TZ=Asia/Tehran

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY kallinan_bot.py config.example.json ./

CMD ["python", "kallinan_bot.py", "watch"]
`;

export const DOCKER_COMPOSE = String.raw`services:
  kallinan:
    build: .
    container_name: kallinan-bot
    restart: unless-stopped
    environment:
      TZ: Asia/Tehran
      KALLINAN_CONFIG: /data/config.json
      KALLINAN_STATE: /data/state.json
      KALLINAN_LOG: /data/kallinan.log
    volumes:
      - ./data:/data
    # برای اجرای یک‌باره به جای حالت سرویس:
    # command: python kallinan_bot.py run
`;

// توجه: از الگوی رشته‌ای معمولی استفاده شده تا الگوی GitHub Expression حفظ شود
export const GH_ACTION = String.raw`name: kallinan-auto-reserve

on:
  schedule:
    # رزرو هفته بعد معمولاً چهارشنبه باز می‌شود؛ چند بار در روز چک می‌کنیم (UTC)
    - cron: "30 4 * * 3"   # 08:00 تهران، چهارشنبه
    - cron: "35 4 * * 3"   # 08:05 تهران، چهارشنبه
    - cron: "30 4 * * *"   # هر روز 08:00 تهران
  workflow_dispatch: {}

jobs:
  reserve:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - name: ساخت config از Secrets
        run: |
          python - <<'PY'
          import json, os
          cfg = json.load(open("config.example.json", encoding="utf-8"))
          cfg["base_url"] = os.environ["KALLINAN_URL"]
          cfg["username"] = os.environ["KALLINAN_USER"]
          cfg["password"] = os.environ["KALLINAN_PASS"]
          cfg["auth_mode"] = "form"
          cfg["weekdays"] = [0,1,2,3,4]
          cfg["meals"] = ["lunch"]
          json.dump(cfg, open("config.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
          PY
        env:
          KALLINAN_URL: ` +
  "${{ secrets.KALLINAN_URL }}" +
  `
          KALLINAN_USER: ` +
  "${{ secrets.KALLINAN_USER }}" +
  `
          KALLINAN_PASS: ` +
  "${{ secrets.KALLINAN_PASS }}" +
  `
      - name: اجرای رزرو
        run: python kallinan_bot.py run
`;

export const SYSTEMD_SERVICE = String.raw`# /etc/systemd/system/kallinan.service
[Unit]
Description=Kallinan auto food reservation
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/kallinan
ExecStart=/usr/bin/python3 /opt/kallinan/kallinan_bot.py watch
Restart=always
RestartSec=60
Environment=TZ=Asia/Tehran

[Install]
WantedBy=multi-user.target
`;

export const RUN_SH = String.raw`#!/usr/bin/env bash
# راه‌اندازی سریع:  bash run.sh
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f config.json ]; then
  cp config.example.json config.json
  echo "config.json ساخته شد؛ username و password را پر کنید و دوباره اجرا کنید."
  exit 0
fi

if [ ! -d .venv ]; then
  python3 -m venv .venv
  ./.venv/bin/pip install -q -r requirements.txt
fi

exec ./.venv/bin/python kallinan_bot.py run
`;

export const HAR_GUIDE = String.raw`# راهنمای گرفتن endpointهای سامانه (فایل HAR)

هدف: بفهمیم اسکریپت باید دقیقاً به کدام آدرس و با چه فیلدهایی درخواست بزند.

۱) در کروم یا اج وارد سامانه کالینان شوید و F12 بزنید.
۲) تب Network → تیک Preserve log را فعال کنید → لیست درخواست‌ها را پاک کنید.
۳) به ترتیب این کارها را انجام دهید:
   - خروج از حساب و ورود مجدد با نام کاربری و رمز
   - باز کردن منوی «رزرو و خرید غذا»
   - رزرو یک وعده و تأیید آن
۴) روی لیست درخواست‌ها راست‌کلیک →
   Save all as HAR with content (کروم) یا Export HAR (فایرفاکس).
۵) فایل را کنار اسکریپت بگذارید (مثلاً rec.har) و اجرا کنید:

       python kallinan_bot.py learn --har rec.har

۶) config.json را باز کنید؛ در بخش endpoints سه کلید login و menu و reserve
   پر شده‌اند. حالا دستور run بدون حدس زدن کار می‌کند.

نکته: اگر سامانه به‌روزرسانی شد و دوباره خطا گرفتید، همین کار را تکرار کنید.
`;

export const README = String.raw`# کالینان اتومات — رزرو خودکار غذای سامانه تغذیه دانشگاه فرهنگیان

اسکریپت‌های این پکیج با حساب کاربری **خودتان** وارد سامانه کالینان می‌شوند
(نمونه آدرس: https://t3223.cfu.ac.ir/)، برنامه هفتگی غذا را می‌خوانند و
طبق قانونی که تعریف می‌کنید وعده‌ها را رزرو می‌کنند.

## فایل‌های پکیج

| فایل | توضیح |
|------|-------|
| kallinan_bot.py | اسکریپت اصلی پایتون (پیشنهادی) |
| kallinan-bot.mjs | نسخه Node.js بدون هیچ وابستگی |
| config.example.json | نمونه تنظیمات |
| requirements.txt | وابستگی‌های پایتون |
| run.sh | نصب و اجرای یک‌فرمانی روی لینوکس/مک |
| Dockerfile / docker-compose.yml | اجرای دائمی در داکر |
| reserve.yml | گردش‌کار GitHub Actions |
| kallinan.service | سرویس systemd |
| HAR-GUIDE.md | آموزش یادگیری endpointها از مرورگر |

## ۱) نصب سریع پایتون

    pip install -r requirements.txt
    python kallinan_bot.py init          # ساخت config.json
    # فایل config.json را باز کنید و base_url ، username ، password را پر کنید
    python kallinan_bot.py test          # تست اتصال و ورود
    python kallinan_bot.py menu          # دیدن برنامه هفتگی
    python kallinan_bot.py run --dry     # تمرین بدون ثبت واقعی
    python kallinan_bot.py run           # رزرو واقعی

## ۲) نصب سریع Node.js (نسخه ۱۸ به بالا)

    node kallinan-bot.mjs init
    node kallinan-bot.mjs run --dry
    node kallinan-bot.mjs run

## ۳) کلیدهای مهم تنظیمات

    base_url          آدرس سامانه پردیس شما
    username          شماره دانشجویی (یا کد ملی برای اساتید و کارمندان)
    password          رمز عبور سامانه
    auth_mode         session (کوکی) | form (بدون کد امنیتی) | ocr (تشخیص خودکار)
    session_cookie    مقدار هدر Cookie از مرورگر
    weekdays          0=شنبه تا 6=جمعه
    meals             breakfast / lunch / dinner
    food_preference   first | cheapest | بخشی از نام غذا مثل «کباب»
    max_price         سقف قیمت به تومان، 0 یعنی بی‌سقف
    look_ahead_days   چند روز جلوتر را بررسی کند
    run_hour/minute   ساعت اجرای خودکار (وقت محلی سیستم)

## ۴) ورود به سامانه — سه راه

### راه ۱: کوکی نشست (سریع‌ترین)
1. در مرورگر وارد کالینان شوید.
2. F12 → تب Network → یک درخواست به همان دامنه را انتخاب کنید.
3. مقدار کامل هدر Cookie را کپی و در session_cookie بگذارید.
4. auth_mode را روی session بگذارید.

### راه ۲: یادگیری خودکار endpoint با فایل HAR (پیشنهاد اصلی)
1. F12 → Network → تیک Preserve log.
2. یک بار کامل: ورود، رفتن به رزرو غذا، رزرو یک وعده.
3. راست‌کلیک روی لیست درخواست‌ها → Save all as HAR with content.
4. اجرا:

       python kallinan_bot.py learn --har rec.har

5. اسکریپت آدرس‌های ورود/منو/رزرو را در config.json می‌نویسد؛ بعد فقط run کنید.

### راه ۳: تشخیص خودکار کد امنیتی
    pip install ddddocr
و در config بگذارید auth_mode = ocr و مسیر تصویر کد را در captcha_url بنویسید.

اگر سامانه شما کد امنیتی ندارد: auth_mode = form

## ۵) اجرای خودکار روزانه

لینوکس/مک با cron:

    crontab -e
    5 8 * * * cd /path/to/kallinan && python3 kallinan_bot.py run >> cron.log 2>&1

ویندوز با Task Scheduler:
1. Create Basic Task → Daily 08:05
2. Action: Start a program → Program: python → Arguments: kallinan_bot.py run
   → Start in: پوشه پروژه

حالت سرویس دائمی:

    python kallinan_bot.py watch

داکر:

    docker compose up -d

GitHub Actions: مخزن خصوصی بسازید، سه Secret به نام‌های KALLINAN_URL و
KALLINAN_USER و KALLINAN_PASS بسازید و فایل reserve.yml را در
.github/workflows/reserve.yml قرار دهید.

systemd:

    sudo cp kallinan.service /etc/systemd/system/
    sudo systemctl enable --now kallinan

## ۶) اعلان تلگرام

    "notify_telegram": true,
    "telegram_bot_token": "123456:ABC...",
    "telegram_chat_id": "123456789"

## ۷) فایل state.json
برای اینکه یک وعده دو بار رزرو نشود، نتیجه هر وعده در state.json ذخیره می‌شود.
برای رزرو مجدد، فایل را پاک کنید.

## ۸) عیب‌یابی

| مشکل | راه‌حل |
|------|--------|
| میزبان در دسترس نیست | آدرس را در مرورگر باز کنید؛ اگر در شبکه دانشگاهید از اینترنت خانگی امتحان کنید |
| ورود ناموفق | کوکی نشست را تازه کنید یا learn --har را اجرا کنید |
| منو خوانده نشد | learn --har تا endpoint منو ذخیره شود |
| رزرو ثبت نمی‌شود | learn --har برای endpoint رزرو، و برداشتن --dry |
| کد امنیتی اشتباه | auth_mode = session یا نصب ddddocr |

## ۹) استفاده مسئولانه
- این ابزار فقط برای مدیریت رزرو خودتان است.
- وعده‌ای را که نمی‌خورید لغو کنید؛ طبق اطلاعیه واحد تغذیه، بیش از سه بار
  تحویل‌نگرفتن غذا باعث جریمه و بستن دسترسی به سامانه می‌شود.
- config.json و رمز عبور را در هیچ مخزن عمومی قرار ندهید.
`;
