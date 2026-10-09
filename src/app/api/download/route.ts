import { NextResponse } from "next/server";
import { BUNDLE_FILES, bundleStats } from "@/lib/bundle";

export const dynamic = "force-static";

export async function GET() {
  const stats = bundleStats();
  return NextResponse.json({
    ...stats,
    files: BUNDLE_FILES.map(({ name, path, label, description, language }) => ({
      name,
      path,
      label,
      description,
      language,
      size: BUNDLE_FILES.find((f) => f.name === name)?.content.length ?? 0,
    })),
  });
}
