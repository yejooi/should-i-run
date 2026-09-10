import landmarksJson from "@/data/landmarks.json";
import { haversineM, estimateWalkMin } from "./geo";
import {
  ALL_STATION_NAMES,
  STATION_COORDS,
  STATION_LINES,
  lineDisplayName,
} from "./network";
import type { Coord, NearestStation } from "./types";

const ALIASES: Record<string, string> = landmarksJson.aliases as Record<
  string,
  string
>;

/** 현위치에서 가까운 역 n개 (거리순) */
export function nearestStations(pos: Coord, n = 3): NearestStation[] {
  return STATION_COORDS.map((s) => {
    const distanceM = haversineM(pos, { lat: s.lat, lng: s.lng });
    return {
      station: s.name,
      lines: STATION_LINES.get(s.name) ?? [],
      distanceM,
      walkMin: estimateWalkMin(distanceM),
    };
  })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, n);
}

export interface StationSuggestion {
  station: string;
  lineNames: string[];
  via?: string; // 별칭으로 매칭된 경우 원래 검색어
}

/** 목적지 자동완성: 역 이름 + 랜드마크 별칭 */
export function searchStations(query: string, limit = 8): StationSuggestion[] {
  const q = query.trim().toLowerCase().replace(/역$/, "");
  if (!q) return [];

  const scored: { name: string; score: number; via?: string }[] = [];
  const seen = new Set<string>();

  const push = (name: string, score: number, via?: string) => {
    if (seen.has(name)) return;
    if (!STATION_LINES.has(name)) return;
    seen.add(name);
    scored.push({ name, score, via });
  };

  for (const name of ALL_STATION_NAMES) {
    const lname = name.toLowerCase();
    if (lname === q) push(name, 0);
    else if (lname.startsWith(q)) push(name, 1);
    else if (lname.includes(q)) push(name, 2);
  }

  for (const [alias, target] of Object.entries(ALIASES)) {
    const la = alias.toLowerCase();
    if (la.includes(q) || q.includes(la)) {
      push(target, la === q ? 0.5 : 2.5, alias);
    }
  }

  return scored
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((s) => ({
      station: s.name,
      lineNames: (STATION_LINES.get(s.name) ?? []).map(lineDisplayName),
      via: s.via,
    }));
}

/** 검색어를 역 이름으로 해석 (별칭 포함). 못 찾으면 null */
export function resolveDestination(query: string): string | null {
  const q = query.trim().replace(/역$/, "");
  if (STATION_LINES.has(q)) return q;
  const alias = ALIASES[q] ?? ALIASES[q.toLowerCase()];
  if (alias && STATION_LINES.has(alias)) return alias;
  const first = searchStations(query, 1)[0];
  return first ? first.station : null;
}
