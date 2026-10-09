import Dashboard from "@/components/Dashboard";
import DownloadCenter from "@/components/DownloadCenter";

const FEATURES = [
  {
    icon: "🕰️",
    title: "زمان‌بندی هوشمند",
    text: "هر روز سر ساعت مشخص به سامانه سر می‌زند، روزهای بازه‌ی پیش‌رو را بررسی می‌کند و رزرو تکراری نمی‌زند.",
  },
  {
    icon: "🎯",
    title: "انتخاب غذا با قانون",
    text: "اولین غذای موجود، ارزان‌ترین، یا غذایی که اسم دلخواه شما را دارد؛ با سقف قیمت به تومان.",
  },
  {
    icon: "🔐",
    title: "سه راه ورود",
    text: "کوکی نشست مرورگر، فرم بدون کد امنیتی، یا تشخیص خودکار کد امنیتی با ddddocr.",
  },
  {
    icon: "🧠",
    title: "یادگیری endpoint با HAR",
    text: "یک بار در مرورگر رزرو کنید، فایل HAR بدهید؛ اسکریپت آدرس‌های واقعی ورود/منو/رزرو را خودش پیدا می‌کند.",
  },
  {
    icon: "🔔",
    title: "اعلان تلگرام",
    text: "نتیجه‌ی هر اجرا با فهرست رزروها برایتان ارسال می‌شود تا مطمئن شوید چیزی جا نیفتاده.",
  },
  {
    icon: "🐳",
    title: "هر جا اجرا می‌شود",
    text: "پایتون، Node، داکر، systemd، cron و GitHub Actions — همه آماده در بسته‌ی دانلود.",
  },
];

const STEPS = [
  { n: "۱", title: "حساب را بسازید", text: "آدرس سامانه (مثل t3223.cfu.ac.ir)، شماره دانشجویی و رمز را وارد کنید." },
  { n: "۲", title: "قانون رزرو را بچینید", text: "روزها، وعده‌ها، اولویت غذا و ساعت اجرا را انتخاب کنید." },
  { n: "۳", title: "تمرین کنید", text: "با dry-run ببینید چه چیزی رزرو می‌شد؛ بدون هیچ درخواست واقعی." },
  { n: "۴", title: "اسکریپت را ببرید روی سیستم خودتان", text: "از مرکز دانلود ZIP بگیرید و با cron یا داکر دائمی‌اش کنید." },
];

const RULES = [
  "رزرو هفته‌ی بعد معمولاً روز چهارشنبه باز می‌شود.",
  "مهلت رزرو: تا ۸ صبح روز قبل از وعده.",
  "مهلت لغو رزرو: تا ۱۴ روز قبل از وعده از طریق سامانه.",
  "توزیع: صبحانه ۶:۳۰–۸، ناهار ۱۱:۴۵–۱۳:۴۵، شام ۱۹–۲۰:۳۰.",
  "بیش از سه وعده‌ی تحویل‌نگرفته = جریمه و بستن رزرو ناهار یکشنبه و سه‌شنبه.",
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      {/* ------------------------------- هیرو ------------------------------- */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/40 bg-gradient-to-bl from-emerald-500/10 via-transparent to-indigo-500/10 p-6 sm:p-10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl floaty" />
        <span className="badge bg-emerald-400/15 text-emerald-300">
          سامانه کالینان · دانشگاه فرهنگیان · t3223.cfu.ac.ir
        </span>
        <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
          رزرو خودکار غذای سلف، بدون هر روز کلیک کردن
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
          این پنل هم یک <b className="text-white">موتور رزرو</b> روی سرور دارد و هم{" "}
          <b className="text-white">اسکریپت کامل قابل دانلود</b> می‌دهد (پایتون و Node) تا روی
          سیستم خودتان یا سرور شخصی، به‌صورت خودکار و سر وقت وارد سامانه کالینان شود، برنامه
          هفتگی را بخواند و طبق قانون شما وعده‌ها را رزرو کند.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <a className="btn btn-primary" href="/api/download/bundle">
            ⬇ دانلود بسته‌ی کامل (ZIP)
          </a>
          <a className="btn btn-ghost" href="#panel">
            شروع: ساخت حساب و قانون
          </a>
          <a className="btn btn-ghost" href="#download">
            دیدن کد اسکریپت
          </a>
        </div>
        <div className="mt-6 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700/40 bg-black/25 px-3 py-2">
            ورود امن · رمز با AES-256-GCM
          </div>
          <div className="rounded-xl border border-slate-700/40 bg-black/25 px-3 py-2">
            dry-run · قبل از رزرو واقعی تمرین کنید
          </div>
          <div className="rounded-xl border border-slate-700/40 bg-black/25 px-3 py-2">
            بدون وابستگی · فقط requests در پایتون
          </div>
        </div>
      </section>

      {/* ------------------------------ امکانات ----------------------------- */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-4">
            <div className="text-2xl">{f.icon}</div>
            <h3 className="mt-2 font-bold text-white">{f.title}</h3>
            <p className="mt-1 text-xs leading-6 text-slate-400">{f.text}</p>
          </div>
        ))}
      </section>

      {/* ----------------------------- مراحل کار ---------------------------- */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="card p-4">
            <span className="badge bg-indigo-400/15 text-indigo-300">قدم {s.n}</span>
            <h3 className="mt-2 font-bold text-white">{s.title}</h3>
            <p className="mt-1 text-xs leading-6 text-slate-400">{s.text}</p>
          </div>
        ))}
      </section>

      {/* ------------------------------- پنل -------------------------------- */}
      <div id="panel" className="mt-10 scroll-mt-6">
        <Dashboard />
      </div>

      {/* ---------------------------- مرکز دانلود --------------------------- */}
      <div className="mt-10">
        <DownloadCenter />
      </div>

      {/* ------------------------------ قوانین ------------------------------ */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-bold text-white">قوانین کلیدی سامانه کالینان</h2>
          <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-300">
            {RULES.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span className="text-emerald-400">◂</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-6 text-slate-500">
            این موارد از اطلاعیه‌های رسمی واحد تغذیه جمع‌آوری شده و ممکن است در پردیس شما کمی
            متفاوت باشد؛ ساعت اجرای قانون رزرو را بر همان اساس تنظیم کنید.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-bold text-white">اگر اسکریپت وارد نشد چه کنم؟</h2>
          <ol className="mt-3 space-y-2 text-xs leading-6 text-slate-300">
            <li>
              <b className="text-white">۱.</b> فایل README را بخوانید؛ سه راه ورود (کوکی، فرم، OCR) توضیح داده شده.
            </li>
            <li>
              <b className="text-white">۲.</b> با دستور <span dir="ltr">learn --har rec.har</span> مسیرهای واقعی
              سامانه‌ی پردیس خود را به اسکریپت یاد بدهید.
            </li>
            <li>
              <b className="text-white">۳.</b> اگر داخل شبکه‌ی دانشگاه هستید، سامانه از بیرون قابل دسترس نیست؛
              روی اینترنت خانگی یا یک سرور خارج اجرایش کنید.
            </li>
            <li>
              <b className="text-white">۴.</b> در پنل، دکمه‌ی «تست اتصال» وضعیت دسترسی و پاسخ سرور را نشان می‌دهد.
            </li>
          </ol>
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-[11px] leading-6 text-amber-200">
            این ابزار برای مدیریت رزرو حساب <b>خودتان</b> ساخته شده است. وعده‌ای را که نمی‌خورید لغو کنید
            تا مشمول جریمه نشوید و food waste ایجاد نشود. مسئولیت استفاده مطابق مقررات دانشگاه با شماست.
          </div>
        </div>
      </section>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/40 pt-5 text-xs text-slate-500">
        <span>کالینان اتومات · ساخته‌شده با Next.js، PostgreSQL و Drizzle ORM</span>
        <span dir="ltr">https://t3223.cfu.ac.ir/</span>
      </footer>
    </main>
  );
}
