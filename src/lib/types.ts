export interface Coord {
  lat: number;
  lng: number;
}

export interface StationCoord {
  name: string;
  lat: number;
  lng: number;
}

export interface LineDef {
  name: string;
  subwayId: string;
  loop: boolean;
  note?: string;
  stations: string[];
}

/** 현위치에서 가장 가까운 역 */
export interface NearestStation {
  station: string;
  lines: string[]; // 이 역을 지나는 노선 키(우리 데이터 기준)
  distanceM: number;
  walkMin: number;
}

/** 경로의 한 구간(한 번 타는 열차) */
export interface RouteLeg {
  lineKey: string;
  lineName: string;
  subwayId: string;
  boardStation: string;
  alightStation: string; // 이 구간에서 내리는 역(환승역 또는 목적지)
  towardStation: string; // 승차 후 다음 정차역(진행 방향)
  directionTerminus: string; // 진행 방향 종착역 (순환선은 "내선순환"/"외선순환")
  wayLabel: string; // 사람이 읽는 방면 표기
  numStops: number;
}

export interface RoutePlan {
  legs: RouteLeg[];
  transfers: number;
  totalStops: number;
  roughMinutes: number;
  originStation: string;
  destinationStation: string;
}

/** 정규화된 도착 정보 1건 */
export interface Arrival {
  subwayId: string;
  lineName: string;
  updnLine: string; // 상행/하행/내선/외선
  headsign: string; // trainLineNm 원문 (예: "성수행 - 구로디지털단지방면")
  destName: string; // bstatnNm (종착역)
  etaSec: number; // 도착까지 초 (추정 포함)
  etaText: string; // arvlMsg2 원문 (예: "2분 후 (역삼)")
  currentPos: string; // arvlMsg3 (현재 위치역)
  receivedAt: number; // recptnDt epoch(ms)
  matchesDirection: boolean; // 내가 타야 할 방면인지
}

/** /api/arrivals 응답 */
export interface ArrivalsApiResponse {
  station: string;
  mock: boolean;
  fetchedAt: number;
  arrivals: RawArrival[];
  error?: string;
}

/** Seoul API에서 필요한 필드만 추린 원시 형태 */
export interface RawArrival {
  subwayId: string;
  updnLine: string;
  trainLineNm: string;
  bstatnNm: string;
  barvlDt: number;
  arvlMsg2: string;
  arvlMsg3: string;
  arvlCd: string;
  recptnDt: number; // epoch(ms)
}

export type VerdictKind = "run" | "hurry" | "relax" | "missed";

export interface Verdict {
  kind: VerdictKind;
  headline: string;
  detail: string;
  slackMin: number; // 열차 도착까지(분) - 도보(분). 음수면 못 탈 수도
  target?: Arrival; // 판정 기준이 된 열차
  next?: Arrival; // 그다음 열차
}
