import { NextResponse } from "next/server";
import { runDuePlans } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // در محیط توسعه بدون رمز هم اجرا می‌شود
  const url = new URL(request.url);
  const provided = request.headers.get("x-cron-secret") ?? url.searchParams.get("secret") ?? "";
  return provided === secret;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  }
  const report = await runDuePlans();
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...report });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
