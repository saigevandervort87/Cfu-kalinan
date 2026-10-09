import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, profiles, reservations, runs } from "@/db/schema";
import { executePlan } from "@/lib/culinan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const runRows = await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(12);
  const reservationRows = await db
    .select()
    .from(reservations)
    .orderBy(desc(reservations.serviceDate), desc(reservations.id))
    .limit(40);
  return NextResponse.json({ runs: runRows, reservations: reservationRows });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const profileId = Number(body.profileId ?? 0);
  const planId = body.planId ? Number(body.planId) : null;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!profile) return NextResponse.json({ error: "ابتدا پروفایل را بسازید" }, { status: 400 });

  let plan = null;
  if (planId) {
    const [row] = await db.select().from(plans).where(eq(plans.id, planId));
    plan = row ?? null;
  }

  try {
    const result = await executePlan({
      profile,
      plan,
      trigger: "manual",
      options: {
        dryRun: Boolean(body.dryRun),
        forceSimulate: Boolean(body.forceSimulate),
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
