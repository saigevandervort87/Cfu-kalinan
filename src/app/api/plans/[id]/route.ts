import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { computeNextRun } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const planId = Number(id);
  const [row] = await db.select().from(plans).where(eq(plans.id, planId));
  if (!row) return NextResponse.json({ error: "قانون پیدا نشد" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Partial<typeof plans.$inferInsert> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (Array.isArray(body.weekdays)) patch.weekdays = (body.weekdays as number[]).map(Number);
  if (Array.isArray(body.meals)) patch.meals = body.meals as string[];
  if (typeof body.foodPreference === "string") patch.foodPreference = body.foodPreference;
  if (body.maxPrice !== undefined) patch.maxPrice = Number(body.maxPrice) || 0;
  if (body.lookAheadDays !== undefined)
    patch.lookAheadDays = Math.min(30, Math.max(1, Number(body.lookAheadDays) || 8));
  if (body.runAtHour !== undefined) patch.runAtHour = Math.min(23, Math.max(0, Number(body.runAtHour) || 0));
  if (body.runAtMinute !== undefined)
    patch.runAtMinute = Math.min(59, Math.max(0, Number(body.runAtMinute) || 0));
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.cancelUnaccepted === "boolean") patch.cancelUnaccepted = body.cancelUnaccepted;

  const merged = { ...row, ...patch };
  patch.nextRunAt = computeNextRun(merged);

  const [updated] = await db.update(plans).set(patch).where(eq(plans.id, planId)).returning();
  return NextResponse.json({ plan: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await db.delete(plans).where(eq(plans.id, Number(id)));
  return NextResponse.json({ ok: true });
}
