import { findBundleFile } from "@/lib/bundle";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ file: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { file } = await ctx.params;
  const decoded = decodeURIComponent(file);
  const match = findBundleFile(decoded);
  if (!match) {
    return new Response("فایل پیدا نشد", { status: 404 });
  }
  return new Response(match.content, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${match.name.replace(/[^\w.\-]/g, "_")}"`,
      "cache-control": "no-store",
    },
  });
}
