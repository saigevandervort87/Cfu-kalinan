import { PYTHON_SCRIPT } from "./python-script";
import { NODE_SCRIPT } from "./node-script";
import {
  CONFIG_EXAMPLE,
  DOCKERFILE,
  DOCKER_COMPOSE,
  ENV_EXAMPLE,
  GH_ACTION,
  HAR_GUIDE,
  README,
  REQUIREMENTS,
  RUN_SH,
  SYSTEMD_SERVICE,
} from "./assets";

export type BundleFile = {
  /** نام فایل در حالت دانلود تکی */
  name: string;
  /** مسیر داخل زیپ */
  path: string;
  label: string;
  description: string;
  language: "python" | "javascript" | "json" | "bash" | "yaml" | "docker" | "markdown" | "ini";
  content: string;
};

export const BUNDLE_FILES: BundleFile[] = [
  {
    name: "kallinan_bot.py",
    path: "kallinan_bot.py",
    label: "اسکریپت پایتون",
    description: "ربات کامل: ورود، خواندن منو، انتخاب غذا، رزرو، حالت سرویس و یادگیری HAR",
    language: "python",
    content: PYTHON_SCRIPT,
  },
  {
    name: "kallinan-bot.mjs",
    path: "kallinan-bot.mjs",
    label: "نسخه Node.js",
    description: "همان قابلیت‌ها بدون هیچ وابستگی؛ فقط Node 18+",
    language: "javascript",
    content: NODE_SCRIPT,
  },
  {
    name: "config.example.json",
    path: "config.example.json",
    label: "نمونه تنظیمات",
    description: "قانون رزرو: روزها، وعده‌ها، سقف قیمت و اولویت غذا",
    language: "json",
    content: CONFIG_EXAMPLE,
  },
  {
    name: "requirements.txt",
    path: "requirements.txt",
    label: "وابستگی‌های پایتون",
    description: "فقط requests؛ ddddocr اختیاری برای OCR کد امنیتی",
    language: "ini",
    content: REQUIREMENTS,
  },
  {
    name: "run.sh",
    path: "run.sh",
    label: "نصب و اجرای سریع",
    description: "ساخت virtualenv، نصب وابستگی‌ها و اجرای رزرو",
    language: "bash",
    content: RUN_SH,
  },
  {
    name: "Dockerfile",
    path: "Dockerfile",
    label: "داکر – ایمیج",
    description: "اجرای ربات در کانتینر با منطقه زمانی تهران",
    language: "docker",
    content: DOCKERFILE,
  },
  {
    name: "docker-compose.yml",
    path: "docker-compose.yml",
    label: "داکر – سرویس دائمی",
    description: "کافی است up -d بزنید؛ ربات هر روز سر ساعت اجرا می‌شود",
    language: "yaml",
    content: DOCKER_COMPOSE,
  },
  {
    name: "reserve.yml",
    path: ".github/workflows/reserve.yml",
    label: "GitHub Actions",
    description: "رزرو رایگان در ابر؛ زمان‌بندی به وقت تهران",
    language: "yaml",
    content: GH_ACTION,
  },
  {
    name: "kallinan.service",
    path: "kallinan.service",
    label: "سرویس systemd",
    description: "اجرای دائمی روی سرور لینوکس با راه‌اندازی مجدد خودکار",
    language: "ini",
    content: SYSTEMD_SERVICE,
  },
  {
    name: "HAR-GUIDE.md",
    path: "docs/HAR-GUIDE.md",
    label: "راهنمای endpoint",
    description: "آموزش گرفتن فایل HAR و یادگیری مسیرهای واقعی سامانه",
    language: "markdown",
    content: HAR_GUIDE,
  },
  {
    name: ".env.example",
    path: ".env.example",
    label: "متغیرهای محیطی",
    description: "کلید رمزنگاری و رمز کرون برای نسخه وب",
    language: "ini",
    content: ENV_EXAMPLE,
  },
  {
    name: "README.md",
    path: "README.md",
    label: "راهنمای کامل",
    description: "نصب، تنظیمات، زمان‌بندی، عیب‌یابی و نکات استفاده مسئولانه",
    language: "markdown",
    content: README,
  },
];

export const findBundleFile = (name: string) =>
  BUNDLE_FILES.find((f) => f.name === name) ?? null;

export const bundleStats = () => {
  const bytes = BUNDLE_FILES.reduce((sum, f) => sum + Buffer.byteLength(f.content, "utf8"), 0);
  const lines = BUNDLE_FILES.reduce(
    (sum, f) => sum + f.content.split("\n").length,
    0,
  );
  return { files: BUNDLE_FILES.length, bytes, lines };
};
