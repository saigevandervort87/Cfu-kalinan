"use client";

import { useEffect, useState } from "react";

type FileMeta = {
  name: string;
  path: string;
  label: string;
  description: string;
  language: string;
  size: number;
};

const LANG_FA: Record<string, string> = {
  python: "پایتون",
  javascript: "جاوااسکریپت",
  json: "JSON",
  bash: "Bash",
  yaml: "YAML",
  docker: "Docker",
  markdown: "Markdown",
  ini: "Config",
};

const bytes = (n: number) =>
  n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;

export default function DownloadCenter() {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [stats, setStats] = useState<{ files: number; bytes: number; lines: number } | null>(null);
  const [active, setActive] = useState<string>("kallinan_bot.py");
  const [code, setCode] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/download")
      .then((r) => r.json())
      .then((data: { files: FileMeta[]; bytes: number; lines: number; filesCount: number }) => {
        setFiles(data.files ?? []);
        setStats({ files: data.files?.length ?? 0, bytes: data.bytes, lines: data.lines });
      })
      .catch(() => setFiles([]));
  }, []);

  useEffect(() => {
    if (!active) return;
    setCode("…");
    fetch(`/api/download/${encodeURIComponent(active)}`)
      .then((r) => r.text())
      .then(setCode)
      .catch(() => setCode("خواندن فایل ممکن نشد"));
  }, [active]);

  const current = files.find((f) => f.name === active);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="download" className="card p-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">مرکز دانلود اسکریپت</h2>
          <p className="text-xs text-slate-400">
            {stats
              ? `${stats.files} فایل، ${bytes(stats.bytes)} کد، ${stats.lines} خط — قابل دانلود تکی یا یکجا`
              : "در حال خواندن فهرست فایل‌ها…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-primary" href="/api/download/bundle">
            ⬇ دانلود همه (ZIP)
          </a>
          {current && (
            <a className="btn btn-ghost" href={`/api/download/${encodeURIComponent(current.name)}`}>
              دانلود همین فایل
            </a>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-1.5">
          {files.map((file) => (
            <button
              key={file.name}
              onClick={() => setActive(file.name)}
              className={`w-full rounded-xl border px-3 py-2 text-right transition ${
                active === file.name
                  ? "border-emerald-400/50 bg-emerald-400/10"
                  : "border-slate-700/40 bg-black/20 hover:border-slate-500/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{file.label}</span>
                <span className="text-[10px] text-slate-500">{LANG_FA[file.language] ?? file.language}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span dir="ltr" className="text-[10px] text-slate-500">{file.name}</span>
                <span className="text-[10px] text-slate-500">{bytes(file.size)}</span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">{file.description}</p>
            </button>
          ))}
        </div>

        <div className="min-w-0 rounded-xl border border-slate-700/40 bg-black/45">
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/40 px-3 py-2">
            <span dir="ltr" className="text-xs text-slate-300">{current?.path ?? active}</span>
            <button className="chip" data-on={copied} onClick={copy}>
              {copied ? "کپی شد ✓" : "کپی کد"}
            </button>
          </div>
          <pre className="code max-h-[520px] px-3 py-3">{code}</pre>
        </div>
      </div>
    </section>
  );
}
