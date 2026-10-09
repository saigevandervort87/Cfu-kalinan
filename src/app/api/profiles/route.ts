import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, profiles } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { normalizeBaseUrl } from "@/lib/culinan";

export const dynamic = "force-dynamic";

function serialize(row: typeof profiles.$inferSelect) {
  const settings = (row.settings ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    title: row.title,
    baseUrl: row.baseUrl,
    username: row.username,
    captchaMode: row.captchaMode,
    engine: row.engine,
    active: row.active,
    hasSessionCookie: Boolean(row.sessionCookie),
    hasLearnedEndpoints: Boolean((settings.endpoints as unknown) ?? false),
    telegramEnabled: Boolean(row.telegramToken && row.telegramChatId),
    lastCheckAt: row.lastCheckAt,
    lastCheckStatus: row.lastCheckStatus,
    createdAt: row.createdAt,
  };
}

export async function GET() {
  const rows = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
  const withPlans = await Promise.all(
    rows.map(async (row) => {
      const planRows = await db.select().from(plans).where(eq(plans.profileId, row.id));
      return { ...serialize(row), planCount: planRows.length };
    }),
  );
  return NextResponse.json({ profiles: withPlans });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const title = String(body.title ?? "").trim();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const baseUrl = normalizeBaseUrl(String(body.baseUrl ?? "https://t3223.cfu.ac.ir"));

  if (!title || !username || !password) {
    return NextResponse.json(
      { error: "عنوان، نام کاربری و رمز عبور الزامی است" },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(profiles)
    .values({
      title,
      baseUrl,
      username,
      passwordEnc: encryptSecret(password),
      captchaMode: String(body.captchaMode ?? "session"),
      engine: String(body.engine ?? "auto"),
      sessionCookie: body.sessionCookie ? String(body.sessionCookie) : null,
      telegramToken: body.telegramToken ? String(body.telegramToken) : null,
      telegramChatId: body.telegramChatId ? String(body.telegramChatId) : null,
      timezone: String(body.timezone ?? "Asia/Tehran"),
      settings: (body.settings as Record<string, unknown>) ?? {},
    })
    .returning();

  return NextResponse.json({ profile: serialize(created) }, { status: 201 });
}
