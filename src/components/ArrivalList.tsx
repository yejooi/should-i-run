"use client";

import { formatEta, remainingSec } from "@/lib/arrivals";
import type { Arrival } from "@/lib/types";

interface Props {
  arrivals: Arrival[];
  now: number;
  walkMin: number;
}

export default function ArrivalList({ arrivals, now, walkMin }: Props) {
  if (arrivals.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-dim">
        표시할 도착 정보가 없어요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {arrivals.slice(0, 5).map((a, i) => {
        const rem = remainingSec(a, now);
        const catchable = rem / 60 - walkMin >= 0;
        return (
          <li
            key={`${a.subwayId}-${a.destName}-${i}`}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
              a.matchesDirection
                ? "border-border bg-surface"
                : "border-transparent bg-surface-2 opacity-70"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span>{a.lineName}</span>
                <span className="text-faint">·</span>
                <span className="truncate text-dim">{a.destName} 방면</span>
                {!a.matchesDirection && (
                  <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] text-faint">
                    다른 방면
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-faint">{a.etaText}</div>
            </div>
            <div className="shrink-0 text-right">
              <div
                className="tabular-nums text-lg font-bold"
                style={{
                  color: catchable ? "var(--relax-fg)" : "var(--run-fg)",
                }}
              >
                {formatEta(rem)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
