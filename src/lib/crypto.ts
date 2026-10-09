import crypto from "node:crypto";

/**
 * گاوصندوق رمز عبور: AES-256-GCM
 * کلید از APP_SECRET خوانده می‌شود؛ اگر تعریف نشده بود از یک کلید ثابتِ
 * مخصوص محیط توسعه استفاده می‌کنیم تا برنامه در سندباکس هم بالا بیاید.
 */
const SECRET =
  process.env.APP_SECRET ??
  process.env.ENCRYPTION_KEY ??
  "kallinan-dev-secret-change-me-in-production";

const KEY = crypto.scryptSync(SECRET, "kallinan.vault.v1", 32);

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(".");
    if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return "";
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      KEY,
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

/** ماسک کردن رمز برای نمایش در رابط کاربری */
export function maskSecret(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 3) return "•".repeat(plain.length);
  return `${plain.slice(0, 2)}${"•".repeat(Math.max(4, plain.length - 3))}${plain.slice(-1)}`;
}
