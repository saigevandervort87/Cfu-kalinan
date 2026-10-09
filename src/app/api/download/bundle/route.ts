import JSZip from "jszip";
import { BUNDLE_FILES } from "@/lib/bundle";

export const dynamic = "force-dynamic";

export async function GET() {
  const zip = new JSZip();
  const root = zip.folder("kallinan-auto")!;
  for (const file of BUNDLE_FILES) {
    root.file(file.path, file.content);
  }
  root.file(
    "START-HERE.txt",
    [
      "کالینان اتومات – راه اندازی در ۴ قدم",
      "",
      "1) pip install -r requirements.txt",
      "2) cp config.example.json config.json  و پر کردن base_url / username / password",
      "3) python kallinan_bot.py test",
      "4) python kallinan_bot.py run --dry   سپس   python kallinan_bot.py run",
      "",
      "راهنمای کامل در README.md",
    ].join("\n"),
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="kallinan-auto.zip"',
      "cache-control": "no-store",
    },
  });
}
