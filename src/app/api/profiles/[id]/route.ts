import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { encryptSecret, maskSecret, decryptSecret } from "@/lib/crypto";
import { normalizeBaseUrl } from "@/lib/culinan";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, id));
  return row ?? null;
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await load(Number(id));
  if (!row) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({
    profile: {
      id: row.id,
      title: row.title,
      baseUrl: row.baseUrl,
      username: row.username,
      passwordMask: maskSecret(decryptSecret(row.passwordEnc)),
      captchaMode: row.captchaMode,
      engine: row.engine,
      sessionCookie: row.sessionCookie ?? "",
      telegramToken: row.telegramToken ?? "",
      telegramChatId: row.telegramChatId ?? "",
      timezone: row.timezone,
      settings: row.settings ?? {},
      active: row.active,
      userAgent: row.userAgent,
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await load(Number(id));
  if (!row) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Partial<typeof profiles.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.baseUrl === "string" && body.baseUrl.trim())
    patch.baseUrl = normalizeBaseUrl(body.baseUrl);
  if (typeof body.username === "string" && body.username.trim()) patch.username = body.username.trim();
  if (typeof body.password === "string" && body.password) patch.passwordEnc = encryptSecret(body.password);
  if (typeof body.captchaMode === "string") patch.captchaMode = body.captchaMode;
  if (typeof body.engine === "string") patch.engine = body.engine;
  if (typeof body.sessionCookie === "string") patch.sessionCookie = body.sessionCookie || null;
  if (typeof body.timezone === "string") patch.timezone = body.timezone;
  if (typeof body.telegramToken === "string") patch.telegramToken = body.telegramToken || null;
  if (typeof body.telegramChatId === "string") patch.telegramChatId = body.telegramChatId || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.settings && typeof body.settings === "object") {
    patch.settings = body.settings as Record<string, unknown>;
  }

  const [updated] = await db.update(profiles).set(patch).where(eq(profiles.id, row.id)).returning();
  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await db.delete(profiles).where(eq(profiles.id, Number(id)));
  return NextResponse.json({ ok: true });
}
