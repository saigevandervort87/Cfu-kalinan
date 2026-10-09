# راهنمای deploy (cfu.dpdns.org)

## ۱. متغیرهای محیطی (در تنظیمات پلتفرم، نه در Git)

| متغیر | الزامی | توضیح |
|---|---|---|
| `DATABASE_URL` | بله | رشته اتصال PostgreSQL، مثال: `postgresql://user:pass@host:5432/dbname` |
| `APP_SECRET` | بله | کلید رمزنگاری رمزهای ذخیره‌شده. با `openssl rand -hex 32` بسازید |
| `CRON_SECRET` | توصیه می‌شود | رمز فراخوانی `/api/cron/run`. بدون آن این endpoint برای همه باز است |
| `PORT` | خیر | پیش‌فرض `3000` است |

## ۲. ساخت جدول‌ها (یک‌بار)

با همان `DATABASE_URL` از سیستم خودتان (یا یک ترمینال داخل پلتفرم):

```bash
npm ci
DATABASE_URL="postgresql://..." npm run db:push
```

## ۳. اجرا با Docker

```bash
docker build -t cfu-kalinan .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e APP_SECRET="..." \
  -e CRON_SECRET="..." \
  --name cfu-kalinan cfu-kalinan
```

سلامت سرویس: `GET /api/health` باید `{"ok":true}` برگرداند.

## ۴. زمان‌بندی اجرای پلن‌ها

اپ خودش زمان‌بندی ندارد. باید هر ۱ تا ۵ دقیقه این را صدا بزنید:

```
GET https://cfu.dpdns.org/api/cron/run
Header: x-cron-secret: <CRON_SECRET>
```

(از cron پلتفرم یا سرویس خارجی مثل cron-job.org استفاده کنید.)

## ۵. دامنه

رکورد DNS برای `cfu.dpdns.org` را طبق راهنمای پلتفرم تنظیم کنید (معمولاً `CNAME` یا `A`).

## هشدار امنیتی

API های `/api/profiles`، `/api/plans` و `/api/runs` هنوز احراز هویت ندارند و رمز حساب‌های کاربری دانشگاه را نگه می‌دارند. قبل از انتشار عمومی، لاگین یا محدودیت دسترسی (مثلاً Basic Auth در reverse proxy) را فعال کنید.
