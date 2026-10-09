export const PYTHON_SCRIPT = String.raw`#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
 کالینان اتومات | اسکریپت رزرو خودکار غذا
 سامانه تغذیه کالینان (دانشگاه فرهنگیان) - نمونه: https://t3223.cfu.ac.ir/
================================================================================

این اسکریپت با حساب کاربری *خودتان* وارد سامانه تغذیه می‌شود، برنامه هفتگی را
می‌خواند و طبق قانونی که در فایل config.json تعریف کرده‌اید، وعده‌های غذایی را
رزرو می‌کند.

نصب سریع:
    pip install -r requirements.txt
    python kallinan_bot.py init          # ساخت فایل تنظیمات
    python kallinan_bot.py test          # تست اتصال و ورود
    python kallinan_bot.py menu          # نمایش برنامه هفتگی
    python kallinan_bot.py run           # اجرای یک‌باره رزرو
    python kallinan_bot.py run --dry     # بدون ثبت واقعی (تمرین)
    python kallinan_bot.py watch         # اجرای مداوم (مثل سرویس)
    python kallinan_bot.py learn --har recording.har   # یادگیری endpointها از HAR

نکته مهم درباره کد امنیتی:
    بعضی نسخه‌های کالینان در صفحه ورود «کد امنیتی» دارند. سه راه حل تعریف شده:
      1) auth_mode = "session"  ->  کوکی نشست را از مرورگر کپی می‌کنید (ساده‌ترین)
      2) auth_mode = "ocr"      ->  با کتابخانه ddddocr کد خودکار خوانده می‌شود
      3) auth_mode = "form"     ->  اگر سامانه شما کد امنیتی ندارد

استفاده مسئولانه: این ابزار فقط برای مدیریت رزرو خودتان است. رزروهای بی‌مصرف
را لغو کنید تا مشمول جریمه تغذیه دانشگاه نشوید.
================================================================================
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

try:
    import requests
except ImportError:  # pragma: no cover
    sys.exit("کتابخانه requests نصب نیست.  ->  pip install requests")

CONFIG_PATH = Path(os.environ.get("KALLINAN_CONFIG", "config.json"))
STATE_PATH = Path(os.environ.get("KALLINAN_STATE", "state.json"))
LOG_PATH = Path(os.environ.get("KALLINAN_LOG", "kallinan.log"))

MEAL_KEYS = ["breakfast", "lunch", "dinner"]
MEAL_FA = {"breakfast": "صبحانه", "lunch": "ناهار", "dinner": "شام"}
WEEKDAY_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"]

# مسیرهای رایج در نسخه‌های مختلف سامانه کالینان. اگر کار نکردند از دستور learn استفاده کنید.
CANDIDATES = {
    "login": ["/api/auth/login", "/api/login", "/api/v1/login", "/Account/Login", "/login",
              "/Home/Login", "/panel/login"],
    "menu": ["/api/food/week", "/api/reserve/week", "/api/v1/reservation/week",
             "/Reserve/Week", "/panel/reserve", "/FoodReservation/Week"],
    "reserve": ["/api/reserve", "/api/reservation", "/api/v1/reservation", "/Reserve/Add",
                "/panel/reserve/add"],
    "captcha": ["/captcha", "/Captcha/Image", "/api/captcha", "/Home/Captcha"],
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler(LOG_PATH, encoding="utf-8")],
)
log = logging.getLogger("kallinan")


# ----------------------------------------------------------------------------- #
# تاریخ شمسی                                                                     #
# ----------------------------------------------------------------------------- #
_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
           2192, 2262, 2324, 2394, 2456, 3178]


def _div(a: int, b: int) -> int:
    return a // b


def _mod(a: int, b: int) -> int:
    return a - a // b * b


def _jal_cal(jy: int):
    gy = jy + 621
    leap_j = -14
    jp = _BREAKS[0]
    jump = 0
    for i in range(1, len(_BREAKS)):
        jm = _BREAKS[i]
        jump = jm - jp
        if jy < jm:
            break
        leap_j += _div(jump, 33) * 8 + _div(_mod(jump, 33), 4)
        jp = jm
    n = jy - jp
    leap_j += _div(n, 33) * 8 + _div(_mod(n, 33) + 3, 4)
    if _mod(jump, 33) == 4 and jump - n == 4:
        leap_j += 1
    leap_g = _div(gy, 4) - _div((_div(gy, 100) + 1) * 3, 4) - 150
    march = 20 + leap_j - leap_g
    if jump - n < 6:
        n = n - jump + _div(jump + 4, 33) * 33
    leap = _mod(_mod(n + 1, 33) - 1, 4)
    if leap == -1:
        leap = 4
    return leap, gy, march


def _g2d(gy: int, gm: int, gd: int) -> int:
    d = _div((gy + _div(gm - 8, 6) + 100100) * 1461, 4) + _div(153 * _mod(gm + 9, 12) + 2, 5) + gd - 34840408
    return d - _div(_div(gy + 100100 + _div(gm - 8, 6), 100) * 3, 4) + 752


def _d2g(jdn: int):
    j = 4 * jdn + 139361631
    j = j + _div(_div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
    i = _div(_mod(j, 1461), 4) * 5 + 308
    gd = _div(_mod(i, 153), 5) + 1
    gm = _mod(_div(i, 153), 12) + 1
    gy = _div(j, 1461) - 100100 + _div(8 - gm, 6)
    return gy, gm, gd


def to_jalali(gy: int, gm: int, gd: int):
    jdn = _g2d(gy, gm, gd)
    gyy = _d2g(jdn)[0]
    jy = gyy - 621
    r = _jal_cal(jy)
    jdn1f = _g2d(gyy, 3, r[2])
    k = jdn - jdn1f
    if 0 <= k <= 185:
        return jy, 1 + _div(k, 31), _mod(k, 31) + 1
    if k > 185:
        k -= 186
    else:
        jy -= 1
        k += 179
        if _jal_cal(jy)[0] == 1:
            k += 1
    return jy, 7 + _div(k, 30), _mod(k, 30) + 1


def jalali_str(gdate: datetime) -> str:
    jy, jm, jd = to_jalali(gdate.year, gdate.month, gdate.day)
    return "%d/%02d/%02d" % (jy, jm, jd)


def persian_weekday(d: datetime.date) -> int:
    """0 = شنبه ... 6 = جمعه"""
    return (d.weekday() + 1) % 7


# ----------------------------------------------------------------------------- #
# تنظیمات                                                                       #
# ----------------------------------------------------------------------------- #
DEFAULT_CONFIG: Dict[str, Any] = {
    "base_url": "https://t3223.cfu.ac.ir",
    "username": "",
    "password": "",
    "auth_mode": "session",          # session | form | ocr
    "session_cookie": "",
    "weekdays": [0, 1, 2, 3, 4],      # 0=شنبه
    "meals": ["lunch"],
    "food_preference": "first",       # first | cheapest | بخشی از نام غذا مثل «کباب»
    "max_price": 0,                   # 0 = بدون سقف
    "look_ahead_days": 8,
    "run_hour": 8,
    "run_minute": 5,
    "verify_tls": True,
    "timeout": 25,
    "dry_run": False,
    "notify_telegram": False,
    "telegram_bot_token": "",
    "telegram_chat_id": "",
    "user_agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"),
    "extra_headers": {},
    "endpoints": {},                  # از دستور learn پر می‌شود
}


def load_config(path: Path = CONFIG_PATH) -> Dict[str, Any]:
    if not path.exists():
        sys.exit("فایل config.json پیدا نشد. اول  python kallinan_bot.py init  را اجرا کنید.")
    cfg = dict(DEFAULT_CONFIG)
    cfg.update(json.loads(path.read_text(encoding="utf-8")))
    return cfg


def save_config(cfg: Dict[str, Any], path: Path = CONFIG_PATH) -> None:
    path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("تنظیمات در %s ذخیره شد", path)


def load_state() -> Dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"reserved": {}, "last_run": None}


def save_state(state: Dict[str, Any]) -> None:
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


# ----------------------------------------------------------------------------- #
# مدل داده                                                                      #
# ----------------------------------------------------------------------------- #
@dataclass
class Food:
    uid: str
    name: str
    meal: str
    date: str           # YYYY-MM-DD میلادی
    price: int = 0
    available: bool = True
    self_name: str = ""

    @property
    def jalali(self) -> str:
        d = datetime.strptime(self.date, "%Y-%m-%d")
        return jalali_str(d)


# ----------------------------------------------------------------------------- #
# کلاینت HTTP                                                                   #
# ----------------------------------------------------------------------------- #
class Client:
    def __init__(self, cfg: Dict[str, Any]):
        self.cfg = cfg
        self.base = cfg["base_url"].rstrip("/")
        self.session = requests.Session()
        self.session.verify = cfg.get("verify_tls", True)
        self.session.headers.update({
            "User-Agent": cfg.get("user_agent", DEFAULT_CONFIG["user_agent"]),
            "Accept": "application/json, text/plain, text/html;q=0.9,*/*;q=0.8",
            "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
            "X-Requested-With": "XMLHttpRequest",
        })
        for key, value in (cfg.get("extra_headers") or {}).items():
            self.session.headers[key] = value
        if cfg.get("session_cookie"):
            for chunk in cfg["session_cookie"].split(";"):
                if "=" in chunk:
                    k, v = chunk.strip().split("=", 1)
                    self.session.cookies.set(k, v)
        self.ok = False

    def url(self, path: str) -> str:
        return path if path.startswith("http") else urljoin(self.base + "/", path.lstrip("/"))

    def request(self, method: str, path: str, retries: int = 3, **kwargs) -> Optional[requests.Response]:
        target = self.url(path)
        kwargs.setdefault("timeout", self.cfg.get("timeout", 25))
        for attempt in range(1, retries + 1):
            try:
                res = self.session.request(method, target, **kwargs)
                self.ok = True
                log.debug("%s %s -> %s", method, target, res.status_code)
                return res
            except requests.RequestException as exc:
                log.warning("خطای شبکه (%s/3): %s", attempt, exc)
                time.sleep(1.5 * attempt + random.random())
        self.ok = False
        return None

    def get(self, path: str, **kw) -> Optional[requests.Response]:
        return self.request("GET", path, **kw)

    def post_json(self, path: str, payload: Dict[str, Any]) -> Optional[requests.Response]:
        return self.request("POST", path, json=payload)

    def post_form(self, path: str, fields: Dict[str, Any]) -> Optional[requests.Response]:
        return self.request("POST", path, data=fields)


# ----------------------------------------------------------------------------- #
# ورود به سامانه                                                                #
# ----------------------------------------------------------------------------- #
def read_captcha(client: Client, cfg: Dict[str, Any]) -> str:
    """کد امنیتی را می‌خواند: با OCR یا از کاربر."""
    path = None
    for candidate in CANDIDATES["captcha"] + [cfg.get("captcha_url", "")]:
        if not candidate:
            continue
        res = client.get(candidate)
        if res is not None and res.status_code == 200 and res.content[:3] not in (b"<ht", b"<!DO"):
            path = "captcha.png"
            Path(path).write_bytes(res.content)
            break
    if path is None:
        log.warning("تصویر کد امنیتی پیدا نشد؛ اگر سامانه کد دارد مسیر آن را در config بدهید (captcha_url)")
        return input("کد امنیتی را دستی وارد کنید (خالی = رد شدن): ").strip()

    if cfg.get("auth_mode") == "ocr":
        try:
            import ddddocr  # type: ignore
            ocr = ddddocr.DdddOcr(show_ad=False)
            return ocr.classification(Path(path).read_bytes()).strip()
        except Exception as exc:  # pragma: no cover
            log.warning("OCR در دسترس نیست (%s). pip install ddddocr", exc)
    return input("کد امنیتی تصویر %s را وارد کنید: " % path).strip()


def login(client: Client, cfg: Dict[str, Any]) -> bool:
    if str(cfg.get("auth_mode")) == "session":
        if not cfg.get("session_cookie"):
            log.error("auth_mode=session است ولی session_cookie خالی است. "
                      "از DevTools مرورگر (Application → Cookies) مقدار کوکی را کپی کنید.")
            return False
        log.info("ورود با کوکی نشست (%s کوکی)", len(cfg["session_cookie"].split(";")))
        return True

    endpoints = cfg.get("endpoints") or {}
    login_ep = endpoints.get("login")
    fields = {"username": cfg["username"], "password": cfg["password"]}

    if str(cfg.get("auth_mode")) != "form":
        code = read_captcha(client, cfg)
        if code:
            fields["captcha"] = code
            fields["captchaCode"] = code
            fields["securityCode"] = code

    if login_ep:
        res = client.post_json(login_ep["url"], fields) if login_ep.get("bodyType") == "json" \
            else client.post_form(login_ep["url"], fields)
        if res is not None and res.status_code < 400:
            log.info("ورود با endpoint تنظیم‌شده انجام شد (HTTP %s)", res.status_code)
            return True
        log.warning("endpoint ورود پاسخ نداد: %s", res.status_code if res else "network error")

    for path in CANDIDATES["login"]:
        res = client.post_json(path, fields)
        if res is None:
            break
        if res.status_code in (200, 302):
            log.info("ورود موفق از %s", path)
            return True
        body = (res.text or "")[:200]
        if re.search(r"already|تکراری|ناموفق|خطا", body):
            log.info("پاسخ %s: %s", res.status_code, body)
    # تلاش با فرم HTML صفحه ورود
    page = client.get("/")
    if page is not None:
        for action, form_fields in extract_forms(page.text):
            if not any(re.search(r"user|pass|login", k, re.I) for k in form_fields):
                continue
            payload = dict(form_fields)
            for key in list(payload):
                if re.search(r"user(name)?|uid|code", key, re.I):
                    payload[key] = cfg["username"]
                if re.search(r"pass(word)?|pwd", key, re.I):
                    payload[key] = cfg["password"]
            res = client.post_form(action or "/", payload)
            if res is not None and res.status_code < 400:
                log.info("ورود با فرم HTML از %s", action)
                return True
    log.error("ورود ناموفق بود. راهنمای learn را در README ببینید.")
    return False


def extract_forms(html: str):
    for match in re.finditer(r"<form\b[^>]*>", html, re.I):
        tag = match.group(0)
        action = re.search(r"action\s*=\s*[\"']([^\"']*)[\"']", tag, re.I)
        start = match.start()
        end = html.find("</form>", start)
        inner = html[start:end if end > 0 else len(html)]
        fields = {}
        for inp in re.finditer(r"<input\b[^>]*>", inner, re.I):
            t = inp.group(0)
            name = re.search(r"name\s*=\s*[\"']([^\"']+)[\"']", t, re.I)
            if not name:
                continue
            itype = (re.search(r"type\s*=\s*[\"']([^\"']+)[\"']", t, re.I) or [None, "text"])[1]
            if str(itype).lower() in ("submit", "button"):
                continue
            value = re.search(r"value\s*=\s*[\"']([^\"']*)[\"']", t, re.I)
            fields[name.group(1)] = value.group(1) if value else ""
        yield (action.group(1) if action else ""), fields


# ----------------------------------------------------------------------------- #
# خواندن برنامه هفتگی                                                           #
# ----------------------------------------------------------------------------- #
def normalize_meal(value: str) -> str:
    v = str(value).strip().lower()
    if re.search(r"break|sobh|صبح", v):
        return "breakfast"
    if re.search(r"din|sham|شام", v):
        return "dinner"
    return "lunch"


def normalize_date(value: str) -> str:
    v = str(value).strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        return v
    if re.match(r"^\d{4}/\d{2}/\d{2}$", v):
        jy, jm, jd = [int(x) for x in v.split("/")]
        return jalali_to_gregorian_iso(jy, jm, jd)
    try:
        return datetime.fromisoformat(v[:19]).date().isoformat()
    except Exception:
        return v


def jalali_to_gregorian_iso(jy: int, jm: int, jd: int) -> str:
    # جست‌وجوی خطی روی سال میلادی متناظر (سال تحصیلی، بازه‌ی کوچک و امن)
    for gy in range(jy + 620, jy + 623):
        for gm in range(1, 13):
            for gd in range(1, 32):
                try:
                    candidate = datetime(gy, gm, gd)
                except ValueError:
                    continue
                if to_jalali(gy, gm, gd) == (jy, jm, jd):
                    return candidate.date().isoformat()
    return "%d-%02d-%02d" % (jy + 621, jm, jd)


def fetch_menu(client: Client, cfg: Dict[str, Any], days: List[str], meals: List[str]) -> List[Food]:
    items: List[Food] = []
    endpoints = cfg.get("endpoints") or {}
    menu_ep = endpoints.get("menu")
    if menu_ep:
        res = client.get(menu_ep["url"]) if str(menu_ep.get("method", "GET")).upper() == "GET" \
            else client.post_json(menu_ep["url"], {"from": days[0], "to": days[-1]})
        if res is not None and res.ok:
            items = parse_menu(res.text, days, meals)
            if items:
                log.info("%s گزینه از endpoint تنظیم‌شده خوانده شد", len(items))
    if not items:
        for path in CANDIDATES["menu"]:
            res = client.get(path, params={"from": days[0], "to": days[-1]})
            if res is None:
                break
            if res.ok:
                items = parse_menu(res.text, days, meals)
                if items:
                    log.info("منو از %s خوانده شد (%s گزینه)", path, len(items))
                    break
    if not items:
        log.warning("برنامه واقعی خوانده نشد؛ برای یافتن endpoint درست از دستور learn استفاده کنید.")
    return items


def parse_menu(body: str, days: List[str], meals: List[str]) -> List[Food]:
    text = body.strip()
    found: List[Food] = []
    if text[:1] in ("{", "["):
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return found

        def walk(node: Any, date: Optional[str] = None, meal: Optional[str] = None) -> None:
            if isinstance(node, list):
                for child in node:
                    walk(child, date, meal)
                return
            if not isinstance(node, dict):
                return
            keys = list(node.keys())
            date_key = next((k for k in keys if re.search(r"date|day|tarikh", k, re.I)), None)
            meal_key = next((k for k in keys if re.search(r"meal|food_?type|nobat", k, re.I)), None)
            name_key = next((k for k in keys if re.match(r"^(food_?name|name|title|meal_?name)$", k, re.I)), None)
            id_key = next((k for k in keys if re.match(r"^(id|food_?id|reserve_?id|meal_?id)$", k, re.I)), None)
            price_key = next((k for k in keys if re.search(r"price|cost|amount|mablagh", k, re.I)), None)
            new_date = date or (str(node[date_key])[:10] if date_key and isinstance(node[date_key], str) else None)
            new_meal = meal or (normalize_meal(str(node[meal_key])) if meal_key and isinstance(node[meal_key], str) else None)
            if name_key and isinstance(node[name_key], str) and new_date and new_meal:
                found.append(Food(
                    uid=str(node[id_key]) if id_key else "%s-%s-%d" % (new_date, new_meal, len(found)),
                    name=str(node[name_key]),
                    meal=new_meal,
                    date=normalize_date(new_date),
                    price=int(node[price_key] or 0) if price_key and str(node[price_key]).isdigit() else 0,
                ))
                return
            for child in node.values():
                walk(child, new_date, new_meal)

        walk(data)
    else:
        for row in re.finditer(r"<tr\b[^>]*>([\s\S]*?)</tr>", body, re.I):
            cells = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c.group(1))).replace("&nbsp;", " ").strip()
                     for c in re.finditer(r"<td\b[^>]*>([\s\S]*?)</td>", row.group(1), re.I)]
            if len(cells) < 2:
                continue
            date_cell = next((c for c in cells if re.match(r"^\d{4}[/\-]\d{2}[/\-]\d{2}$", c)), None)
            meal_cell = next((c for c in cells if re.search(r"صبحانه|ناهار|شام", c)), None)
            if not date_cell or not meal_cell:
                continue
            meal = "breakfast" if "صبحانه" in meal_cell else ("dinner" if "شام" in meal_cell else "lunch")
            if meal not in meals:
                continue
            iso = normalize_date(date_cell)
            if iso not in days:
                continue
            name_cell = next((c for c in cells if c not in (date_cell, meal_cell) and len(c) > 2), "")
            found.append(Food(uid="%s-%s-%d" % (iso, meal, len(found)), name=name_cell,
                              meal=meal, date=iso))
    return found


# ----------------------------------------------------------------------------- #
# انتخاب و ثبت رزرو                                                             #
# ----------------------------------------------------------------------------- #
def pick_food(items: List[Food], cfg: Dict[str, Any]) -> Optional[Food]:
    pool = [i for i in items if i.available]
    if cfg.get("max_price"):
        budget = [i for i in pool if i.price and i.price <= int(cfg["max_price"])]
        pool = budget or pool
    if not pool:
        return None
    pref = str(cfg.get("food_preference") or "first")
    if pref == "cheapest":
        return sorted(pool, key=lambda i: i.price or 0)[0]
    if pref != "first":
        for item in pool:
            if pref in item.name:
                return item
    return pool[0]


def reserve_item(client: Client, cfg: Dict[str, Any], food: Food) -> str:
    """خروجی: booked | already | failed"""
    if cfg.get("dry_run"):
        log.info("[dry-run] رزرو %s (%s %s) ارسال نشد", food.name, food.jalali, MEAL_FA[food.meal])
        return "booked"
    endpoints = cfg.get("endpoints") or {}
    ep = endpoints.get("reserve")
    payload = {
        "foodId": food.uid, "food_id": food.uid,
        "date": food.date, "reserveDate": food.jalali,
        "meal": food.meal, "mealType": food.meal,
    }
    if ep:
        res = client.post_json(ep["url"], payload) if str(ep.get("bodyType", "json")) == "json" \
            else client.post_form(ep["url"], payload)
        if res is None:
            return "failed"
        if 200 <= res.status_code < 300:
            return "booked"
        log.warning("endpoint رزرو کد %s داد: %s", res.status_code, res.text[:120])
        return "failed"
    for path in CANDIDATES["reserve"]:
        res = client.post_json(path, payload)
        if res is None:
            return "failed"
        if 200 <= res.status_code < 300:
            return "booked"
        if re.search(r"already|تکراری|قبلا", res.text or ""):
            return "already"
    return "failed"


def notify(cfg: Dict[str, Any], text: str) -> None:
    if not cfg.get("notify_telegram"):
        return
    token, chat = cfg.get("telegram_bot_token"), cfg.get("telegram_chat_id")
    if not token or not chat:
        return
    try:
        requests.post("https://api.telegram.org/bot%s/sendMessage" % token,
                      json={"chat_id": chat, "text": text}, timeout=15)
    except requests.RequestException as exc:
        log.warning("ارسال پیام تلگرام ناموفق: %s", exc)


# ----------------------------------------------------------------------------- #
# اجرای اصلی                                                                     #
# ----------------------------------------------------------------------------- #
def build_days(cfg: Dict[str, Any]) -> List[str]:
    today = datetime.now().date()
    weekdays = set(int(w) for w in (cfg.get("weekdays") or [0, 1, 2, 3, 4]))
    days: List[str] = []
    forced = cfg.get("_forced_date")
    if forced:
        return [str(forced)]
    for offset in range(int(cfg.get("look_ahead_days", 8))):
        day = today + timedelta(days=offset)
        if persian_weekday(day) in weekdays:
            days.append(day.isoformat())
    return days or [(today + timedelta(days=i)).isoformat() for i in range(cfg.get("look_ahead_days", 8))]


def run_once(cfg: Dict[str, Any]) -> int:
    days = build_days(cfg)
    meals = [m for m in (cfg.get("meals") or ["lunch"]) if m in MEAL_KEYS]
    log.info("اجرای رزرو برای %s روز و وعده‌های %s", len(days), "،".join(MEAL_FA[m] for m in meals))

    client = Client(cfg)
    client.get("/")
    if not client.ok:
        log.error("میزبان %s در دسترس نیست (اینترنت/فیلترینگ شبکه دانشگاه را بررسی کنید)", cfg["base_url"])
        notify(cfg, "کالینان اتومات: میزبان در دسترس نبود.")
        return 1
    if not login(client, cfg):
        return 2

    state = load_state()
    items = fetch_menu(client, cfg, days, meals)
    booked = failed = skipped = 0
    for day in days:
        for meal in meals:
            key = "%s|%s" % (day, meal)
            if key in state["reserved"]:
                skipped += 1
                continue
            chosen = pick_food([i for i in items if i.date == day and i.meal == meal], cfg)
            if chosen is None:
                log.info("%s (%s) گزینه‌ای پیدا نشد", jalali_str(datetime.strptime(day, "%Y-%m-%d")), MEAL_FA[meal])
                failed += 1
                continue
            status = reserve_item(client, cfg, chosen)
            state["reserved"][key] = {"status": status, "food": chosen.name, "at": datetime.now().isoformat()}
            if status == "booked":
                booked += 1
                log.info("✔ %s – %s – %s", chosen.jalali, MEAL_FA[meal], chosen.name)
            elif status == "already":
                skipped += 1
            else:
                failed += 1
                log.error("✖ %s – %s ثبت نشد", chosen.jalali, MEAL_FA[meal])
    state["last_run"] = datetime.now().isoformat()
    save_state(state)
    notify(cfg, "کالینان اتومات | ثبت‌شده: %s | تکراری: %s | ناموفق: %s" % (booked, skipped, failed))
    log.info("پایان: %s موفق، %s تکراری، %s ناموفق", booked, skipped, failed)
    return 0


def seconds_until(cfg: Dict[str, Any]) -> float:
    now = datetime.now()
    target = now.replace(hour=int(cfg.get("run_hour", 8)), minute=int(cfg.get("run_minute", 5)),
                         second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds() + random.uniform(5, 45)


def cmd_watch(cfg: Dict[str, Any]) -> None:
    log.info("حالت سرویس فعال شد. برای توقف Ctrl+C بزنید.")
    while True:
        wait = seconds_until(cfg)
        log.info("اجرای بعدی %s دقیقه دیگر", round(wait / 60, 1))
        try:
            time.sleep(wait)
        except KeyboardInterrupt:
            log.info("متوقف شد")
            return
        try:
            run_once(cfg)
        except Exception as exc:  # noqa: BLE001
            log.exception("خطای غیرمنتظره: %s", exc)


def cmd_learn(cfg: Dict[str, Any], har_path: Path) -> None:
    """endpointها را از فایل HAR (Export از Network مرورگر) یاد می‌گیرد."""
    data = json.loads(har_path.read_text(encoding="utf-8"))
    entries = data.get("log", {}).get("entries", [])
    cfg.setdefault("endpoints", {})
    username = cfg.get("username") or ""
    for entry in entries:
        req = entry.get("request", {})
        method = str(req.get("method", "GET")).upper()
        url = req.get("url", "")
        post = req.get("postData", {}) or {}
        body = post.get("text", "") or ""
        lower = url.lower()
        if method == "POST" and username and username in body:
            cfg["endpoints"]["login"] = {"method": method, "url": url,
                                         "bodyType": "json" if "json" in post.get("mimeType", "") else "form"}
            log.info("ورود پیدا شد: %s %s", method, url)
        if re.search(r"(reserve|reservation|food|meal)", lower) and method == "POST":
            cfg["endpoints"]["reserve"] = {"method": method, "url": url,
                                           "bodyType": "json" if "json" in post.get("mimeType", "") else "form"}
            log.info("رزرو پیدا شد: %s %s", method, url)
        if re.search(r"(week|menu|list|reserv|food)", lower) and method == "GET" and "menu" not in cfg["endpoints"]:
            cfg["endpoints"]["menu"] = {"method": "GET", "url": url}
            log.info("منو پیدا شد: %s", url)
    save_config(cfg)


def cmd_init() -> None:
    if CONFIG_PATH.exists():
        log.info("config.json از قبل وجود دارد؛ دست نزدم.")
        return
    save_config(dict(DEFAULT_CONFIG))
    log.info("فایل تنظیمات ساخته شد. مقادیر username و password را پر کنید.")


def cmd_menu(cfg: Dict[str, Any]) -> int:
    client = Client(cfg)
    client.get("/")
    if not login(client, cfg):
        return 2
    days = build_days(cfg)
    items = fetch_menu(client, cfg, days, [m for m in MEAL_KEYS if m in (cfg.get("meals") or [])])
    if not items:
        return 3
    print("-" * 62)
    for day in days:
        day_items = [i for i in items if i.date == day]
        if not day_items:
            continue
        g = datetime.strptime(day, "%Y-%m-%d")
        print("%s (%s - %s)" % (jalali_str(g), WEEKDAY_FA[persian_weekday(g.date())], day))
        for item in day_items:
            price = ("%s تومان" % item.price) if item.price else "—"
            print("   %-9s %-28s %s" % (MEAL_FA[item.meal], item.name[:28], price))
    print("-" * 62)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="رزرو خودکار غذای سامانه کالینان")
    parser.add_argument("command", choices=["init", "test", "menu", "run", "watch", "learn"],
                        help="دستور مورد نظر")
    parser.add_argument("--config", default=str(CONFIG_PATH))
    parser.add_argument("--har", help="فایل HAR برای دستور learn")
    parser.add_argument("--dry", action="store_true", help="بدون ثبت واقعی رزرو")
    parser.add_argument("--meal", choices=MEAL_KEYS, help="اجرای موقت روی یک وعده")
    parser.add_argument("--date", help="فقط یک تاریخ مشخص YYYY-MM-DD")
    args = parser.parse_args()

    if args.command == "init":
        cmd_init()
        return 0

    cfg = load_config(Path(args.config))
    if args.dry:
        cfg["dry_run"] = True
    if args.meal:
        cfg["meals"] = [args.meal]
    if args.date:
        cfg["look_ahead_days"] = 1
        cfg["weekdays"] = [0, 1, 2, 3, 4, 5, 6]
        cfg["_forced_date"] = args.date

    if args.command == "learn":
        if not args.har:
            log.error("مسیر فایل HAR لازم است:  python kallinan_bot.py learn --har rec.har")
            return 1
        cmd_learn(cfg, Path(args.har))
        return 0

    if args.command == "test":
        client = Client(cfg)
        res = client.get("/")
        if res is None:
            log.error("اتصال برقرار نشد")
            return 1
        log.info("اتصال برقرار (HTTP %s) – %s کوکی", res.status_code, len(client.session.cookies))
        log.info("ورود: %s", "موفق" if login(client, cfg) else "ناموفق")
        return 0

    if args.command == "menu":
        return cmd_menu(cfg)

    if args.command == "watch":
        cmd_watch(cfg)
        return 0

    if cfg.get("_forced_date"):
        cfg["weekdays"] = [persian_weekday(datetime.strptime(cfg["_forced_date"], "%Y-%m-%d").date())]
    return run_once(cfg)


if __name__ == "__main__":
    sys.exit(main())
`;
