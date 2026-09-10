import linesJson from "@/data/lines.json";
import stationsJson from "@/data/stations.json";
import type { LineDef, StationCoord } from "./types";

export const LINES: Record<string, LineDef> = linesJson.lines as unknown as Record<
  string,
  LineDef
>;

export const STATION_COORDS: StationCoord[] = (
  stationsJson.stations as StationCoord[]
).filter((s) => typeof s.lat === "number" && typeof s.lng === "number");

/** 역 이름 → 이 역을 지나는 노선 키 목록 */
export const STATION_LINES: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const [key, line] of Object.entries(LINES)) {
    for (const st of line.stations) {
      const arr = m.get(st) ?? [];
      if (!arr.includes(key)) arr.push(key);
      m.set(st, arr);
    }
  }
  return m;
})();

/** 우리 데이터가 아는 모든 역 이름 */
export const ALL_STATION_NAMES: string[] = [...STATION_LINES.keys()].sort();

export function stationExists(name: string): boolean {
  return STATION_LINES.has(name);
}

export function lineDisplayName(lineKey: string): string {
  return LINES[lineKey]?.name ?? lineKey;
}

// ── 노선 그래프 ────────────────────────────────────────────────
// 노드: `${lineKey}|${station}`  (같은 역이라도 노선마다 별도 노드)
// 엣지: 노선 내 인접(HOP_MIN), 같은 역의 다른 노선 간 환승(TRANSFER_MIN)

export const HOP_MIN = 2;
// 환승은 실제 소요(플랫폼 이동 + 다음 열차 대기)에 더해 "번거로움" 비용까지 포함.
// 이 값이 낮으면 한 번에 갈 수 있는 구간을 굳이 갈아타는 경로가 선택된다.
export const TRANSFER_MIN = 10;

export interface GraphEdge {
  to: string;
  weight: number;
  kind: "hop" | "transfer";
}

export type Graph = Map<string, GraphEdge[]>;

export function nodeId(lineKey: string, station: string): string {
  return `${lineKey}|${station}`;
}

export function parseNode(id: string): { lineKey: string; station: string } {
  const i = id.indexOf("|");
  return { lineKey: id.slice(0, i), station: id.slice(i + 1) };
}

let cachedGraph: Graph | null = null;

export function getGraph(): Graph {
  if (cachedGraph) return cachedGraph;
  const g: Graph = new Map();
  const add = (from: string, edge: GraphEdge) => {
    const arr = g.get(from) ?? [];
    arr.push(edge);
    g.set(from, arr);
  };

  for (const [key, line] of Object.entries(LINES)) {
    const s = line.stations;
    for (let i = 0; i < s.length; i++) {
      const from = nodeId(key, s[i]);
      if (!g.has(from)) g.set(from, []);
      if (i + 1 < s.length) {
        const to = nodeId(key, s[i + 1]);
        add(from, { to, weight: HOP_MIN, kind: "hop" });
        add(to, { to: from, weight: HOP_MIN, kind: "hop" });
      }
    }
    if (line.loop && s.length > 2) {
      const a = nodeId(key, s[s.length - 1]);
      const b = nodeId(key, s[0]);
      add(a, { to: b, weight: HOP_MIN, kind: "hop" });
      add(b, { to: a, weight: HOP_MIN, kind: "hop" });
    }
  }

  // 환승 엣지
  for (const [station, keys] of STATION_LINES) {
    if (keys.length < 2) continue;
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = nodeId(keys[i], station);
        const b = nodeId(keys[j], station);
        add(a, { to: b, weight: TRANSFER_MIN, kind: "transfer" });
        add(b, { to: a, weight: TRANSFER_MIN, kind: "transfer" });
      }
    }
  }

  cachedGraph = g;
  return g;
}
