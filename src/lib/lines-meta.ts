// 서울시 실시간 도착 API의 subwayId → 표시 이름.
// (구현 시작 시 서울 열린데이터광장 최신 문서로 값 재확인 권장.)
export const SUBWAY_ID_NAME: Record<string, string> = {
  "1001": "1호선",
  "1002": "2호선",
  "1003": "3호선",
  "1004": "4호선",
  "1005": "5호선",
  "1006": "6호선",
  "1007": "7호선",
  "1008": "8호선",
  "1009": "9호선",
  "1061": "중앙선",
  "1063": "경의중앙선",
  "1065": "공항철도",
  "1067": "경춘선",
  "1075": "수인분당선",
  "1077": "신분당선",
  "1092": "우이신설선",
  "1093": "서해선",
  "1032": "GTX-A",
};

export function subwayIdToName(id: string): string {
  return SUBWAY_ID_NAME[id] ?? `노선(${id})`;
}

// 실시간 API가 기대하는 역명이 우리 표기와 다른 경우의 예외 맵.
// 대부분은 "역" 없는 순수 역명이면 되지만, 병기역 등 일부는 아래처럼 맞춰준다.
export const STATION_API_NAME: Record<string, string> = {
  총신대입구: "총신대입구(이수)",
  이수: "이수",
  공릉: "공릉(서울과학기술대)",
  남한산성입구: "남한산성입구(성남법원ㆍ검찰청)",
  운길산: "운길산",
  광나루: "광나루(장신대)",
  몽촌토성: "몽촌토성(평화의문)",
  총신대: "총신대입구(이수)",
};

export function toApiStationName(name: string): string {
  return STATION_API_NAME[name] ?? name;
}

// 서울 수도권 노선 공식 색 (lines.json 의 lineKey 기준). 전광판 배지·마퀴·액센트에 사용.
export const LINE_COLOR: Record<string, string> = {
  "1": "#0052A4",
  "2": "#00A84D",
  "3": "#EF7C1C",
  "4": "#00A5DE",
  "5": "#996CAC",
  "5-마천": "#996CAC",
  "6": "#CD7C2F",
  "7": "#747F00",
  "8": "#E6186C",
  "9": "#BDB092",
  신분당: "#D4003B",
  수인분당: "#F5A200",
  경의중앙: "#77C4A3",
  우이신설: "#B0CE18",
};

export function lineColor(lineKey: string): string {
  return LINE_COLOR[lineKey] ?? "#6B7280";
}

// 전광판 배지에 넣을 짧은 라벨 (숫자 노선은 숫자, 이름 노선은 앞 글자).
const LINE_BADGE: Record<string, string> = {
  "5-마천": "5",
  신분당: "신",
  수인분당: "수",
  경의중앙: "경",
  우이신설: "우",
};

export function lineBadgeLabel(lineKey: string): string {
  return LINE_BADGE[lineKey] ?? lineKey;
}
