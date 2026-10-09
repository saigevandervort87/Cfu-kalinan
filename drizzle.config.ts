import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    // در deploy حتماً DATABASE_URL را تنظیم کنید؛ مقدار پیش‌فرض فقط برای توسعه محلی است.
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
