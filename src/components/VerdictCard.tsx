"use client";

import type { Verdict, VerdictKind } from "@/lib/types";

const STYLE: Record<
  VerdictKind,
  { bg: string; fg: string; line: string; icon: string; pulse?: boolean }
> = {
  run: {
    bg: "var(--run-bg)",
    fg: "var(--run-fg)",
    line: "var(--run-line)",
    icon: "🏃",
    pulse: true,
  },
  missed: {
    bg: "var(--run-bg)",
    fg: "var(--run-fg)",
    line: "var(--run-line)",
    icon: "😮‍💨",
  },
  hurry: {
    bg: "var(--hurry-bg)",
    fg: "var(--hurry-fg)",
    line: "var(--hurry-line)",
    icon: "🚶‍♂️💨",
  },
  relax: {
    bg: "var(--relax-bg)",
    fg: "var(--relax-fg)",
    line: "var(--relax-line)",
    icon: "🚶",
  },
};

export default function VerdictCard({ verdict }: { verdict: Verdict }) {
  const s = STYLE[verdict.kind];
  return (
    <div
      className={`rounded-2xl border p-5 ${s.pulse ? "pulse-run" : ""}`}
      style={{ background: s.bg, borderColor: s.line }}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {s.icon}
        </span>
        <div className="text-2xl font-extrabold tracking-tight" style={{ color: s.fg }}>
          {verdict.headline}
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed" style={{ color: s.fg }}>
        {verdict.detail}
      </p>
    </div>
  );
}
