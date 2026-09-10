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

/** trainLineNm 의 "○○방면" 에서 진행 방향을 가리키는 역을 뽑는다. */
function bearingAnchor(raw: RawArrival, lineStations: string[]): string | null {
  const m = raw.trainLineNm.match(/([가-힣A-Za-z0-9().·]+?)\s*방면/);
  if (!m) return null;
  const name = m[1];
  if (lineStations.includes(name)) return name;
  const hit = lineStations.find((s) => name.startsWith(s) || s.startsWith(name));
  return hit && Math.abs(hit.length - name.length) <= 2 ? hit : null;
}

/**
 * 이 도착 열차가 leg(내가 타야 할 구간)의 방면과 일치하는지.
 */
export function matchesLegDirection(raw: RawArrival, leg: RouteLeg): boolean {
  if (raw.subwayId !== leg.subwayId) return false;
  const line = LINES[leg.lineKey];
  if (!line) return true; // 노선 데이터 없으면 통과

  const s = line.stations;
  const n = s.length;
  const boardIdx = s.indexOf(leg.boardStation);
  const towardIdx = s.indexOf(leg.towardStation);
  if (boardIdx < 0 || towardIdx < 0) return true;

  const inc = towardIdx === (boardIdx + 1) % n; // 우리 진행이 인덱스 증가 방향인가 (2호선: 내선)

  if (line.loop) {
    // 1) updnLine 이 내선/외선을 명시하면 확정 (서울 2호선 실데이터는 여기서 끝남)
    if (/내선/.test(raw.updnLine)) return inc;
    if (/외선/.test(raw.updnLine)) return !inc;
    // 2) "○○방면" 역이 우리 진행 방향으로 더 가까우면 우리 방면
    //    (bstatnNm 은 순환선에서 양방향 모두 존재할 수 있어 신뢰 불가)
    const bearing = bearingAnchor(raw, s);
    if (bearing) {
      const bi = s.indexOf(bearing);
      const fwd = (dir: 1 | -1) =>
        dir === 1 ? (bi - boardIdx + n) % n : (boardIdx - bi + n) % n;
      const ourDir: 1 | -1 = inc ? 1 : -1;
      return fwd(ourDir) < fwd(ourDir === 1 ? -1 : 1);
    }
    return true; // 판단 불가 → 노출
  }

  // 비순환선: bstatnNm / "○○방면" 이 board 기준 우리 방향(인덱스 증감)에 있으면 일치
  const dir = Math.sign(towardIdx - boardIdx);
  const anchors = anchorStations(raw, s);
  if (anchors.length === 0) return true;
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
