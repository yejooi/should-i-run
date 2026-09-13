import { remainingSec } from "./arrivals";
import type { Arrival, Verdict } from "./types";

/**
 * 도보 시간과 다음 열차 도착 시간을 비교해 판정.
 * slack = (열차 도착까지 분) - (도보 분).
 *   slack < 0        → 이번 건 놓칠 수 있음 (missed / run)
 *   0 ≤ slack < 1.5  → 뛰어야 함 (run)
 *   1.5 ≤ slack < 4  → 빠르게 걸으면 됨 (hurry)
 *   slack ≥ 4        → 여유 (relax)
 */
export function judge(
  walkMin: number,
  arrivals: Arrival[],
  now = Date.now(),
): Verdict {
  const matched = arrivals.filter((a) => a.matchesDirection);
  const pool = matched.length > 0 ? matched : arrivals;

  if (pool.length === 0) {
    return {
      kind: "relax",
      headline: "정보 없음",
      detail: "실시간 열차 정보를 찾지 못했어요 — 역 전광판을 확인하세요.",
      slackMin: 0,
    };
  }

  const withSlack = pool.map((a) => ({
    a,
    slackMin: remainingSec(a, now) / 60 - walkMin,
  }));

  // 탈 수 있는(=slack이 가장 큰 게 아니라, 도착 임박 순) 열차 중 첫 번째로 "탈 만한" 것
  const target =
    withSlack.find((x) => x.slackMin >= 0) ?? withSlack[0]; // 다 놓칠 상황이면 첫 열차
  const idx = withSlack.indexOf(target);
  const next = withSlack[idx + 1];

  const slackMin = target.slackMin;
  let kind: Verdict["kind"];
  let headline: string;
  let detail: string;

  const etaMin = Math.max(0, Math.round(remainingSec(target.a, now) / 60));

  if (slackMin < 0) {
    kind = next ? "missed" : "run";
    headline = next ? "아깝다" : "뛰어!";
    detail = next
      ? `도보 ${walkMin}분 · 열차 ${etaMin}분 후 도착 — 이건 놓쳐요, 다음 걸 노리세요.`
      : `도보 ${walkMin}분 · 열차 ${etaMin}분 후 도착 — 지금 뛰어도 아슬아슬합니다.`;
  } else if (slackMin < 1.5) {
    kind = "run";
    headline = "뛰어!";
    detail = `도보 ${walkMin}분 · 열차 ${etaMin}분 후 도착 — 뛰면 탈 수 있습니다.`;
  } else if (slackMin < 4) {
    kind = "hurry";
    headline = "빨리!";
    detail = `도보 ${walkMin}분 · 열차 ${etaMin}분 후 도착 — 서두르면 여유 있게 탑니다.`;
  } else {
    kind = "relax";
    headline = "여유";
    detail = `도보 ${walkMin}분 · 열차 ${etaMin}분 후 도착 — 천천히 가도 됩니다.`;
  }

  return {
    kind,
    headline,
    detail,
    slackMin,
    target: target.a,
    next: next?.a,
  };
}
