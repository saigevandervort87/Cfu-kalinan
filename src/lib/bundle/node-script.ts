export const NODE_SCRIPT = String.raw`#!/usr/bin/env node
/**
 * ===========================================================================
 *  کالینان اتومات – نسخه Node.js (بدون هیچ وابستگی، Node 18+)
 *  سامانه تغذیه کالینان دانشگاه فرهنگیان – مثال: https://t3223.cfu.ac.ir/
 * ===========================================================================
 *  node kallinan-bot.mjs init
 *  node kallinan-bot.mjs test
 *  node kallinan-bot.mjs menu
 *  node kallinan-bot.mjs run --dry
 *  node kallinan-bot.mjs watch
 *  node kallinan-bot.mjs learn --har recording.har
 * ===========================================================================
 */
import fs from "node:fs";
import path from "node:path";

const CONFIG = process.env.KALLINAN_CONFIG ?? "config.json";
const STATE = process.env.KALLINAN_STATE ?? "state.json";
const MEALS = { breakfast: "صبحانه", lunch: "ناهار", dinner: "شام" };
const WEEK = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

const DEFAULTS = {
  base_url: "https://t3223.cfu.ac.ir",
  username: "",
  password: "",
  auth_mode: "session",
  session_cookie: "",
  weekdays: [0, 1, 2, 3, 4],
  meals: ["lunch"],
  food_preference: "first",
  max_price: 0,
  look_ahead_days: 8,
  run_hour: 8,
  run_minute: 5,
  dry_run: false,
  timeout_ms: 25000,
  endpoints: {},
  telegram_bot_token: "",
  telegram_chat_id: "",
};

const log = (...a) => console.log(new Date().toISOString(), "|", ...a);

const loadConfig = () => {
  if (!fs.existsSync(CONFIG)) {
    console.error("config.json نیست. اول: node kallinan-bot.mjs init");
    process.exit(1);
  }
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG, "utf8")) };
};
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2), "utf8");
const loadState = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { reserved: {} });

/* ------------------------- تبدیل تاریخ شمسی ------------------------- */
const div = (a, b) => Math.trunc(a / b);
const mod = (a, b) => a - Math.trunc(a / b) * b;
const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
function jalCal(jy) {
  const gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jump = 0, n;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i]; jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm;
  }
  n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ++;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function toJalali(gy, gm, gd) {
  const jdn = g2d(gy, gm, gd);
  const gyy = d2g(jdn).gy;
  let jy = gyy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gyy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0 && k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
  if (k >= 0) k -= 186; else { jy -= 1; k += 179; if (jalCal(jy).leap === 1) k += 1; }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}
const p2 = (n) => String(n).padStart(2, "0");
const jalaliStr = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const j = toJalali(y, m, d);
  return j.jy + "/" + p2(j.jm) + "/" + p2(j.jd);
};
const persianWeekday = (iso) => (new Date(iso + "T00:00:00Z").getUTCDay() + 1) % 7;

/* ------------------------------ کلاینت ------------------------------ */
class Client {
  constructor(cfg) {
    this.cfg = cfg;
    this.base = cfg.base_url.replace(/\/+$/, "");
    this.cookies = new Map();
    (cfg.session_cookie || "").split(";").forEach((c) => {
      const i = c.indexOf("=");
      if (i > 0) this.cookies.set(c.slice(0, i).trim(), c.slice(i + 1).trim());
    });
    this.up = false;
  }
  cookieHeader() {
    return [...this.cookies].map(([k, v]) => k + "=" + v).join("; ");
  }
  async req(url, init = {}) {
    const target = url.startsWith("http") ? url : this.base + (url.startsWith("/") ? "" : "/") + url;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.cfg.timeout_ms);
    try {
      const res = await fetch(target, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
          accept: "application/json, text/plain, text/html;q=0.9,*/*;q=0.8",
          "accept-language": "fa-IR,fa;q=0.9",
          ...(this.cookieHeader() ? { cookie: this.cookieHeader() } : {}),
          ...(init.headers || {}),
        },
      });
      res.headers.getSetCookie?.().forEach((line) => {
        const [pair] = line.split(";");
        const i = pair.indexOf("=");
        if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      });
      const text = await res.text();
      this.up = true;
      return { status: res.status, text };
    } catch (e) {
      log("خطای شبکه:", e.message);
      return null;
    } finally {
      clearTimeout(t);
    }
  }
  get(url) { return this.req(url); }
  postJson(url, body) { return this.req(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
  postForm(url, body) {
    return this.req(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString() });
  }
}

const CANDIDATES = {
  login: ["/api/auth/login", "/api/login", "/api/v1/login", "/Account/Login", "/login"],
  menu: ["/api/food/week", "/api/reserve/week", "/api/v1/reservation/week", "/Reserve/Week", "/panel/reserve"],
  reserve: ["/api/reserve", "/api/reservation", "/api/v1/reservation", "/Reserve/Add"],
};

function login(client, cfg) {
  if (cfg.auth_mode === "session") {
    if (!cfg.session_cookie) { log("session_cookie خالی است"); return false; }
    log("ورود با کوکی نشست:", client.cookies.size, "کوکی");
    return true;
  }
  const fields = { username: cfg.username, password: cfg.password };
  const ep = cfg.endpoints?.login;
  if (ep) {
    const res = ep.bodyType === "form" ? client.postForm(ep.url, fields) : client.postJson(ep.url, fields);
    return Boolean(res && res.status < 400);
  }
  for (const p of CANDIDATES.login) {
    const res = client.postJson(p, fields);
    if (!res) break;
    if (res.status === 200 || res.status === 302) { log("ورود موفق از", p); return true; }
  }
  log("ورود ناموفق؛ endpointها را با دستور learn تنظیم کنید");
  return false;
}

function normalizeMeal(v) {
  const s = String(v).toLowerCase();
  if (/break|sobh|صبح/.test(s)) return "breakfast";
  if (/din|sham|شام/.test(s)) return "dinner";
  return "lunch";
}

function parseMenu(body, days, meals) {
  const out = [];
  const text = String(body).trim();
  if (text.startsWith("{") || text.startsWith("[")) {
    let data;
    try { data = JSON.parse(text); } catch { return out; }
    const walk = (node, date, meal) => {
      if (Array.isArray(node)) { node.forEach((n) => walk(n, date, meal)); return; }
      if (!node || typeof node !== "object") return;
      const keys = Object.keys(node);
      const pick = (re) => keys.find((k) => re.test(k));
      const dk = pick(/date|day|tarikh/i), mk = pick(/meal|foodType|nobat/i);
      const nk = pick(/^(foodName|name|title|mealName)$/i), ik = pick(/^(id|foodId|reserveId)$/i);
      const pk = pick(/price|cost|amount/i);
      const nd = date ?? (dk && typeof node[dk] === "string" ? node[dk].slice(0, 10) : undefined);
      const nm = meal ?? (mk && typeof node[mk] === "string" ? normalizeMeal(node[mk]) : undefined);
      if (nk && typeof node[nk] === "string" && nd && nm) {
        out.push({ uid: String(ik ? node[ik] : nd + "-" + nm + "-" + out.length), name: node[nk], meal: nm, date: nd, price: pk ? Number(node[pk]) || 0 : 0 });
        return;
      }
      Object.values(node).forEach((v) => walk(v, nd, nm));
    };
    walk(data, undefined, undefined);
  }
  return out.filter((i) => days.includes(i.date) && meals.includes(i.meal));
}

function pickFood(items, cfg) {
  let pool = items.filter((i) => i.available !== false);
  if (cfg.max_price > 0) {
    const b = pool.filter((i) => i.price && i.price <= cfg.max_price);
    if (b.length) pool = b;
  }
  if (!pool.length) return null;
  const pref = cfg.food_preference || "first";
  if (pref === "cheapest") return [...pool].sort((a, b) => a.price - b.price)[0];
  if (pref !== "first") {
    const hit = pool.find((i) => i.name.includes(pref));
    if (hit) return hit;
  }
  return pool[0];
}

function buildDays(cfg) {
  const out = [];
  for (let i = 0; i < cfg.look_ahead_days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (cfg.weekdays.includes(persianWeekday(iso))) out.push(iso);
  }
  return out;
}

async function runOnce(cfg) {
  const days = buildDays(cfg);
  const meals = cfg.meals.filter((m) => MEALS[m]);
  const client = new Client(cfg);
  await client.get("/");
  if (!client.up) { log("میزبان در دسترس نیست"); return 1; }
  if (!login(client, cfg)) return 2;

  const state = loadState();
  let items = [];
  const ep = cfg.endpoints?.menu;
  if (ep) {
    const res = await client.get(ep.url);
    if (res && res.ok) items = parseMenu(res.text, days, meals);
  }
  if (!items.length) {
    for (const p of CANDIDATES.menu) {
      const res = await client.get(p + "?from=" + days[0] + "&to=" + days[days.length - 1]);
      if (!res) break;
      if (res.status === 200) { items = parseMenu(res.text, days, meals); if (items.length) break; }
    }
  }
  let booked = 0, failed = 0, skipped = 0;
  for (const day of days) {
    for (const meal of meals) {
      const key = day + "|" + meal;
      if (state.reserved[key]) { skipped++; continue; }
      const chosen = pickFood(items.filter((i) => i.date === day && i.meal === meal), cfg);
      if (!chosen) { log(jalaliStr(day), MEALS[meal], ": گزینه‌ای نبود"); failed++; continue; }
      if (cfg.dry_run) { log("[dry-run]", chosen.jalali ? "" : "", jalaliStr(day), MEALS[meal], chosen.name); booked++; continue; }
      const payload = { foodId: chosen.uid, date: chosen.date, meal: chosen.meal };
      const rEp = cfg.endpoints?.reserve;
      const res = rEp ? await client.postJson(rEp.url, payload) : await client.postJson(CANDIDATES.reserve[0], payload);
      const ok = res && res.status >= 200 && res.status < 300;
      state.reserved[key] = { status: ok ? "booked" : "failed", food: chosen.name, at: new Date().toISOString() };
      if (ok) { booked++; log("✔", jalaliStr(day), MEALS[meal], chosen.name); } else { failed++; log("✖", jalaliStr(day), MEALS[meal]); }
    }
  }
  saveState(state);
  log("نتیجه:", booked, "موفق /", skipped, "تکراری /", failed, "ناموفق");
  return 0;
}

async function learn(cfg, harPath) {
  const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
  const entries = har.log?.entries ?? [];
  cfg.endpoints = cfg.endpoints ?? {};
  for (const e of entries) {
    const req = e.request || {};
    const method = (req.method || "GET").toUpperCase();
    const url = req.url || "";
    const body = req.postData?.text || "";
    if (method === "POST" && cfg.username && body.includes(cfg.username)) {
      cfg.endpoints.login = { method, url, bodyType: /json/.test(req.postData?.mimeType || "") ? "json" : "form" };
      log("ورود:", url);
    }
    if (method === "POST" && /(reserve|reservation|food|meal)/i.test(url)) {
      cfg.endpoints.reserve = { method, url, bodyType: /json/.test(req.postData?.mimeType || "") ? "json" : "form" };
      log("رزرو:", url);
    }
    if (method === "GET" && /(week|menu|list|reserv|food)/i.test(url) && !cfg.endpoints.menu) {
      cfg.endpoints.menu = { method: "GET", url };
      log("منو:", url);
    }
  }
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), "utf8");
  log("endpointها در", path.resolve(CONFIG), "ذخیره شدند");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function watch(cfg) {
  log("حالت سرویس آغاز شد (Ctrl+C برای توقف)");
  for (;;) {
    const now = new Date();
    const target = new Date(now);
    target.setHours(cfg.run_hour, cfg.run_minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    log("اجرای بعدی", target.toLocaleString("fa-IR"));
    await sleep(target - now + Math.random() * 30000);
    try { await runOnce(cfg); } catch (e) { log("خطا:", e.message); }
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const arg = (name) => {
  const i = rest.indexOf("--" + name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const flag = (name) => rest.includes("--" + name);

if (cmd === "init") {
  fs.writeFileSync(CONFIG, JSON.stringify(DEFAULTS, null, 2), "utf8");
  log("config.json ساخته شد. username و password را پر کنید.");
} else if (cmd === "learn") {
  learn(loadConfig(), arg("har"));
} else if (cmd === "test") {
  const cfg = loadConfig();
  const c = new Client(cfg);
  c.get("/").then((r) => {
    log(r ? "اتصال برقرار (HTTP " + r.status + ")" : "اتصال ناموفق");
    log("ورود:", login(c, cfg) ? "موفق" : "ناموفق");
  });
} else if (cmd === "menu") {
  const cfg = loadConfig();
  const days = buildDays(cfg);
  log("روزهای هدف:", days.map((d) => jalaliStr(d)).join(" , "));
} else if (cmd === "watch") {
  watch(loadConfig());
} else if (cmd === "run") {
  const cfg = loadConfig();
  if (flag("dry")) cfg.dry_run = true;
  if (arg("meal")) cfg.meals = [arg("meal")];
  runOnce(cfg).then((code) => process.exit(code));
} else {
  console.log("دستورها: init | test | menu | run [--dry] [--meal lunch] | watch | learn --har file.har");
}
`;
