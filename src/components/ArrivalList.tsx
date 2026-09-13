"use client";

import { remainingSec } from "@/lib/arrivals";
import { mmss } from "@/lib/format";
import type { Arrival } from "@/lib/types";

interface Props {
  arrivals: Arrival[];
  now: number;
  walkMin: number;
  lineColorHex: string;
}

export default function ArrivalList({ arrivals, now, walkMin, lineColorHex }: Props) {
  if (arrivals.length === 0) {
    return (
      <p className="rounded-[10px] bg-row-bg px-4 py-3 text-[12px] text-dim">
        표시할 도착 정보가 없어요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-px">
      {arrivals.slice(0, 5).map((a, i) => {
        const rem = remainingSec(a, now);
        const catchable = rem / 60 - walkMin >= 0;
        const tone = !a.matchesDirection ? "var(--muted)" : catchable ? "var(--ok)" : "var(--bad)";
        return (
          <div
            key={`${a.subwayId}-${a.destName}-${i}`}
            className="flex items-center gap-2.5 py-2.5 pr-1 pl-3"
            style={{
              borderLeft: `3px solid ${a.matchesDirection ? lineColorHex : "var(--pill-line)"}`,
              background: "var(--row-bg)",
              opacity: a.matchesDirection ? 1 : 0.55,
            }}
          >
            <span className="font-display min-w-[74px] text-[13px] text-ink">{a.destName} 방면</span>
            <span className="truncate text-[11px] text-dim">{a.etaText}</span>
            <span className="font-digital ml-auto shrink-0 text-[20px] leading-none" style={{ color: tone }}>
              {mmss(rem)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
