import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // خروجی مستقل برای اجرای سبک داخل Docker (فقط فایل‌های لازم کپی می‌شوند)
  output: "standalone",
};

export default nextConfig;
