import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, profiles } from "@/db/schema";
import { computeNextRun } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({ plan: plans, profileTitle: profiles.title, baseUrl: profiles.baseUrl })
    .from(plans)
    .innerJoin(profiles, eq(plans.profileId, profiles.id))
    .orderBy(asc(plans.id));
  return NextResponse.json({
    plans: rows.map((r) => ({
      ...r.plan,
      profileTitle: r.profileTitle,
      baseUrl: r.baseUrl,
      nextRunAt: r.plan.nextRunAt,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const profileId = Number(body.profileId ?? 0);
  if (!profileId) return NextResponse.json({ error: "پروفایل را انتخاب کنید" }, { status: 400 });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!profile) return NextResponse.json({ error: "پروفایل پیدا نشد" }, { status: 404 });

  const weekdays = Array.isArray(body.weekdays) ? (body.weekdays as number[]).map(Number) : [0, 1, 2, 3, 4];
  const meals = Array.isArray(body.meals) ? (body.meals as string[]) : ["lunch"];

  const [created] = await db
    .insert(plans)
    .values({
      profileId,
      name: String(body.name ?? "قانون هفتگی").trim() || "قانون هفتگی",
      weekdays: weekdays.filter((d) => d >= 0 && d <= 6),
      meals: meals.filter((m) => ["breakfast", "lunch", "dinner"].includes(m)),
      foodPreference: String(body.foodPreference ?? "first"),
      maxPrice: Number(body.maxPrice ?? 0) || 0,
      lookAheadDays: Math.min(30, Math.max(1, Number(body.lookAheadDays ?? 8) || 8)),
      runAtHour: Math.min(23, Math.max(0, Number(body.runAtHour ?? 8) || 0)),
      runAtMinute: Math.min(59, Math.max(0, Number(body.runAtMinute ?? 5) || 0)),
      cancelUnaccepted: Boolean(body.cancelUnaccepted ?? false),
      active: body.active === undefined ? true : Boolean(body.active),
    })
    .returning();

  const next = computeNextRun(created, profile.timezone);
  await db.update(plans).set({ nextRunAt: next }).where(eq(plans.id, created.id));

  return NextResponse.json({ plan: { ...created, nextRunAt: next } }, { status: 201 });
}
