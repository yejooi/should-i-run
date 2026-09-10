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
      headline: "도착 정보 없음",
      detail: "이 역의 실시간 열차 정보를 찾지 못했어요. 전광판을 확인하세요.",
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
    headline = next ? "이번 건 아슬아슬" : "지금 전력질주";
    detail = next
      ? `다음 열차까지 ${etaMin}분, 도보 ${walkMin}분. 뛰어도 아슬아슬해요.`
      : `${etaMin}분 뒤 도착인데 도보 ${walkMin}분. 무조건 뛰어야 합니다.`;
  } else if (slackMin < 1.5) {
    kind = "run";
    headline = "뛰어야 탑니다";
    detail = `${etaMin}분 뒤 도착. 도보 ${walkMin}분이라 여유가 거의 없어요.`;
  } else if (slackMin < 4) {
    kind = "hurry";
    headline = "빠르게 걸으면 탑니다";
    detail = `${etaMin}분 뒤 도착. 도보 ${walkMin}분, 약 ${Math.round(
      slackMin,
    )}분 여유.`;
  } else {
    kind = "relax";
    headline = "여유 있어요";
    detail = `${etaMin}분 뒤 도착. 도보 ${walkMin}분, 약 ${Math.round(
      slackMin,
    )}분 여유.`;
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
