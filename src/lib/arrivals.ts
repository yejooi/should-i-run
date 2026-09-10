import { LINES } from "./network";
import { subwayIdToName } from "./lines-meta";
import type { Arrival, RawArrival, RouteLeg } from "./types";

/** arvlMsg2 등에서 도착 초를 최대한 뽑아낸다. */
export function resolveEtaSec(raw: RawArrival): number {
  if (raw.barvlDt && raw.barvlDt > 0) return raw.barvlDt;
  const msg = raw.arvlMsg2 ?? "";
  // "2분 후 (역삼)" 형태
  const m = msg.match(/(\d+)\s*분/);
  if (m) return parseInt(m[1], 10) * 60;
  // arvlCd: 0 진입, 1 도착, 2 출발, 3 전역출발, 4 전역진입, 5 전역도착
  if (["0", "1", "5"].includes(raw.arvlCd)) return 20;
  if (["2", "3", "4"].includes(raw.arvlCd)) return 60;
  if (/곧 도착|전역/.test(msg)) return 30;
  return 180; // 알 수 없으면 보수적으로 3분
}

const STOP_WORDS = /(행|방면|급행|일반|방향|\(|\)|-|·|ㆍ|:|\d)/g;

/** trainLineNm / bstatnNm 에서 역 이름 후보들을 뽑는다. */
function anchorStations(raw: RawArrival, lineStations: string[]): string[] {
  const text = `${raw.trainLineNm} ${raw.bstatnNm}`;
  const tokens = text
    .split(/[\s\-·ㆍ,/]+/)
    .map((t) => t.replace(STOP_WORDS, "").trim())
    .filter(Boolean);
  const set = new Set<string>();
  for (const tok of tokens) {
    if (lineStations.includes(tok)) set.add(tok);
    else {
      // "구로디지털단지방면" 같이 붙은 경우 부분 일치
      const hit = lineStations.find((s) => tok.startsWith(s) || s.startsWith(tok));
      if (hit && Math.abs(hit.length - tok.length) <= 2) set.add(hit);
    }
  }
  if (lineStations.includes(raw.bstatnNm)) set.add(raw.bstatnNm);
  return [...set];
}

/**
 * 이 도착 열차가 leg(내가 타야 할 구간)의 방면과 일치하는지.
 */
export function matchesLegDirection(raw: RawArrival, leg: RouteLeg): boolean {
  if (raw.subwayId !== leg.subwayId) return false;
  const line = LINES[leg.lineKey];
  if (!line) return true; // 노선 데이터 없으면 통과

  const s = line.stations;
  const boardIdx = s.indexOf(leg.boardStation);
  const towardIdx = s.indexOf(leg.towardStation);
  if (boardIdx < 0 || towardIdx < 0) return true;

  const n = s.length;
  const inc = towardIdx === (boardIdx + 1) % n; // 우리 진행이 인덱스 증가 방향인가 (2호선: 내선)
  const anchors = anchorStations(raw, s);

  if (anchors.length === 0) {
    // 방면 앵커 역을 못 읽음 → updnLine 문자열로 완화 매칭
    if (line.loop) {
      if (/내선/.test(raw.updnLine)) return inc;
      if (/외선/.test(raw.updnLine)) return !inc;
    } else {
      // 비순환선의 상/하행은 노선마다 기준이 달라 신뢰도가 낮다 → 판단 보류(노출)
    }
    return true;
  }

  if (line.loop) {
    // 순환선: 앵커 역이 우리 진행 방향으로 더 가까우면(반 바퀴 이내) 우리 방면.
    const fwd = (from: number, to: number, dir: 1 | -1) =>
      dir === 1 ? (to - from + n) % n : (from - to + n) % n;
    const ourDir: 1 | -1 = inc ? 1 : -1;
    return anchors.some((a) => {
      const ai = s.indexOf(a);
      if (ai < 0 || ai === boardIdx) return false;
      return fwd(boardIdx, ai, ourDir) <= fwd(boardIdx, ai, ourDir === 1 ? -1 : 1);
    });
  }

  const dir = Math.sign(towardIdx - boardIdx);
  return anchors.some((a) => {
    const ai = s.indexOf(a);
    return ai >= 0 && Math.sign(ai - boardIdx) === dir;
  });
}

export function normalizeArrival(
  raw: RawArrival,
  leg: RouteLeg | null,
): Arrival {
  return {
    subwayId: raw.subwayId,
    lineName: subwayIdToName(raw.subwayId),
    updnLine: raw.updnLine,
    headsign: raw.trainLineNm,
    destName: raw.bstatnNm,
    etaSec: resolveEtaSec(raw),
    etaText: raw.arvlMsg2 || raw.arvlMsg3 || "",
    currentPos: raw.arvlMsg3 || "",
    receivedAt: raw.recptnDt || Date.now(),
    matchesDirection: leg ? matchesLegDirection(raw, leg) : false,
  };
}

/**
 * 원시 도착 목록 → 정규화 + 내가 타야 할 방면만 우선 정렬.
 * leg가 있으면 해당 노선만 남긴다.
 */
export function buildArrivals(
  raws: RawArrival[],
  leg: RouteLeg | null,
): Arrival[] {
  let list = raws.map((r) => normalizeArrival(r, leg));
  if (leg) list = list.filter((a) => a.subwayId === leg.subwayId);
  return list.sort((a, b) => {
    if (a.matchesDirection !== b.matchesDirection)
      return a.matchesDirection ? -1 : 1;
    return a.etaSec - b.etaSec;
  });
}

/** 현재 시각 기준으로 남은 초를 보정 (수신 시각 경과분 차감) */
export function remainingSec(a: Arrival, now = Date.now()): number {
  const elapsed = Math.max(0, (now - a.receivedAt) / 1000);
  return Math.max(0, Math.round(a.etaSec - elapsed));
}

export function formatEta(sec: number): string {
  if (sec <= 20) return "곧 도착";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s.toString().padStart(2, "0")}초`;
}
