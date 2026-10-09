import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "کالینان اتومات | رزرو خودکار غذای دانشگاه فرهنگیان",
  description:
    "پنل مدیریت و اسکریپت قابل دانلود برای رزرو خودکار وعده‌های غذایی سامانه کالینان (t3223.cfu.ac.ir) با زمان‌بندی، لاگ و اعلان.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
