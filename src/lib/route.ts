import {
  getGraph,
  LINES,
  nodeId,
  parseNode,
  STATION_LINES,
  lineDisplayName,
  HOP_MIN,
  TRANSFER_MIN,
} from "./network";
import type { NearestStation, RouteLeg, RoutePlan } from "./types";

// ── Dijkstra (작은 그래프라 이진 힙 없이 충분) ──────────────────
function shortestPath(
  sources: string[],
  isTarget: (station: string) => boolean,
): string[] | null {
  const graph = getGraph();
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const s of sources) {
    dist.set(s, 0);
    prev.set(s, null);
  }

  while (visited.size < dist.size) {
    let cur: string | null = null;
    let best = Infinity;
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < best) {
        best = d;
        cur = node;
      }
    }
    if (cur === null) break;
    visited.add(cur);

    if (isTarget(parseNode(cur).station)) {
      // 경로 복원
      const path: string[] = [];
      let n: string | null = cur;
      while (n) {
        path.unshift(n);
        n = prev.get(n) ?? null;
      }
      return path;
    }

    for (const edge of graph.get(cur) ?? []) {
      if (visited.has(edge.to)) continue;
      const nd = best + edge.weight;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, cur);
      }
    }
  }
  return null;
}

/** 노드 경로 → 구간(leg) 목록으로 압축 */
function pathToLegs(path: string[]): RouteLeg[] {
  const nodes = path.map(parseNode);
  const legs: RouteLeg[] = [];

  let i = 0;
  while (i < nodes.length - 1) {
    // 같은 노선으로 이어지는 최대 구간
    const lineKey = nodes[i].lineKey;
    let j = i;
    while (
      j + 1 < nodes.length &&
      nodes[j + 1].lineKey === lineKey &&
      nodes[j + 1].station !== nodes[j].station
    ) {
      j++;
    }
    if (j > i) {
      const board = nodes[i].station;
      const toward = nodes[i + 1].station;
      const alight = nodes[j].station;
      legs.push(buildLeg(lineKey, board, toward, alight, j - i));
      i = j;
    } else {
      // 환승 엣지 (station 동일, lineKey 변경) → 다음 노드로
      i++;
    }
  }
  return legs;
}

function buildLeg(
  lineKey: string,
  board: string,
  toward: string,
  alight: string,
  numStops: number,
): RouteLeg {
  const line = LINES[lineKey];
  const s = line.stations;
  const n = s.length;
  const boardIdx = s.indexOf(board);
  const towardIdx = s.indexOf(toward);

  let directionTerminus: string;
  let wayLabel: string;

  if (line.loop) {
    // 서울 2호선: 내선순환 = 시청→을지로입구→성수→잠실→강남→사당→신도림 (데이터상 인덱스 증가).
    const inc = towardIdx === (boardIdx + 1) % n;
    wayLabel = inc ? "내선순환" : "외선순환";
    directionTerminus = wayLabel;
  } else if (towardIdx > boardIdx) {
    directionTerminus = s[n - 1];
    wayLabel = `${directionTerminus} 방면`;
  } else {
    directionTerminus = s[0];
    wayLabel = `${directionTerminus} 방면`;
  }

  return {
    lineKey,
    lineName: lineDisplayName(lineKey),
    subwayId: line.subwayId,
    boardStation: board,
    alightStation: alight,
    towardStation: toward,
    directionTerminus,
    wayLabel,
    numStops,
  };
}

export interface PlanInput {
  nearest: NearestStation[]; // 현위치 인근 후보역 (거리순)
  destination: string; // 목적지 역 이름
}

export interface PlanResult {
  plan: RoutePlan;
  origin: NearestStation; // 실제 채택된 승차 후보
}

/**
 * 후보 승차역들 각각에서 목적지까지 경로를 구해, (도보 + 예상 소요)가 가장 짧은 것을 채택.
 */
export function planRoute({ nearest, destination }: PlanInput): PlanResult | null {
  if (!STATION_LINES.has(destination)) return null;

  let best: PlanResult | null = null;

  for (const origin of nearest) {
    if (origin.station === destination) continue;
    const sources = (STATION_LINES.get(origin.station) ?? []).map((k) =>
      nodeId(k, origin.station),
    );
    if (sources.length === 0) continue;

    const path = shortestPath(sources, (st) => st === destination);
    if (!path || path.length < 2) continue;

    const legs = pathToLegs(path);
    if (legs.length === 0) continue;

    const totalStops = legs.reduce((a, l) => a + l.numStops, 0);
    const transfers = legs.length - 1;
    const roughMinutes = totalStops * HOP_MIN + transfers * TRANSFER_MIN;

    const plan: RoutePlan = {
      legs,
      transfers,
      totalStops,
      roughMinutes,
      originStation: origin.station,
      destinationStation: destination,
    };

    if (!best || origin.walkMin + roughMinutes < best.origin.walkMin + best.plan.roughMinutes) {
      best = { plan, origin };
    }
  }

  return best;
}

/**
 * 순환선에서 진행 방향으로 앞쪽 k개 역 (방면 매칭·표시용).
 */
export function stationsAhead(
  lineKey: string,
  fromStation: string,
  towardStation: string,
  k: number,
): string[] {
  const line = LINES[lineKey];
  if (!line) return [];
  const s = line.stations;
  const n = s.length;
  const fromIdx = s.indexOf(fromStation);
  const towardIdx = s.indexOf(towardStation);
  if (fromIdx < 0 || towardIdx < 0) return [];

  const out: string[] = [];
  if (line.loop) {
    const dir = towardIdx === (fromIdx + 1) % n ? 1 : -1;
    for (let step = 1; step <= k; step++) {
      out.push(s[(fromIdx + dir * step + n * step) % n]);
    }
  } else {
    const dir = towardIdx > fromIdx ? 1 : -1;
    for (let step = 1; step <= k; step++) {
      const idx = fromIdx + dir * step;
      if (idx < 0 || idx >= n) break;
      out.push(s[idx]);
    }
  }
  return out;
}
