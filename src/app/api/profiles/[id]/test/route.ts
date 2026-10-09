import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { probeProfile } from "@/lib/culinan";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const [row] = await db.select().from(profiles).where(eq(profiles.id, Number(id)));
  if (!row) return NextResponse.json({ error: "پروفایل پیدا نشد" }, { status: 404 });

  const result = await probeProfile(row);
  await db
    .update(profiles)
    .set({
      lastCheckAt: new Date(),
      lastCheckStatus: result.reachable ? "reachable" : "unreachable",
      sessionCookie: result.cookieCount ? row.sessionCookie : row.sessionCookie,
    })
    .where(eq(profiles.id, row.id));

  return NextResponse.json({
    ...result,
    verdict: result.reachable
      ? "میزبان پاسخ داد؛ موتور می‌تواند به‌صورت زنده کار کند"
      : "میزبان از این سرور در دسترس نیست؛ موتور به حالت شبیه‌سازی می‌رود و روی سیستم خودتان زنده کار می‌کند",
  });
}
