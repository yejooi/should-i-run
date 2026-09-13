"use client";

import { remainingSec } from "@/lib/arrivals";
import { mmss } from "@/lib/format";
import type { Verdict, VerdictKind } from "@/lib/types";

const TONE: Record<VerdictKind, { bg: string; line: string; fg: string; sub: string; pulse?: boolean }> = {
  run: { bg: "var(--run-bg)", line: "var(--run-line)", fg: "var(--run-fg)", sub: "var(--run-sub)", pulse: true },
  missed: { bg: "var(--run-bg)", line: "var(--run-line)", fg: "var(--run-fg)", sub: "var(--run-sub)" },
  hurry: { bg: "var(--hurry-bg)", line: "var(--hurry-line)", fg: "var(--hurry-fg)", sub: "var(--hurry-sub)" },
  relax: { bg: "var(--relax-bg)", line: "var(--relax-line)", fg: "var(--relax-fg)", sub: "var(--relax-sub)" },
};

export default function VerdictCard({ verdict, now }: { verdict: Verdict; now: number }) {
  const t = TONE[verdict.kind];
  const bang = verdict.headline.endsWith("!");
  const head = bang ? verdict.headline.slice(0, -1) : verdict.headline;
  const secLeft = verdict.target ? remainingSec(verdict.target, now) : null;

  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border p-5 ${t.pulse ? "led-pulse" : ""}`}
      style={{ background: t.bg, borderColor: t.line }}
    >
      <div className="dot-matrix z-0" />
      <div className="relative z-10 flex items-end gap-3">
        <div className="font-display text-[54px] leading-[.86]" style={{ color: t.fg }}>
          {head}
          {bang && (
            <span className="led-blink" style={{ color: t.fg }}>
              !
            </span>
          )}
        </div>
        {secLeft !== null && (
          <div className="ml-auto flex items-baseline gap-1">
            <span className="font-digital text-[38px] leading-none" style={{ color: t.fg }}>
              {mmss(secLeft)}
            </span>
          </div>
        )}
      </div>
      <p className="relative z-10 mt-3 text-[13px] leading-relaxed" style={{ color: t.sub }}>
        {verdict.detail}
      </p>
    </div>
  );
}
