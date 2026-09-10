import type { Coord } from "./types";

const R = 6371000; // 지구 반경(m)

export function haversineM(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// 직선거리 → 실제 도보 시간(분) 추정.
// 우회 계수 1.3, 보행 속도 75 m/분(≈4.5km/h), 개찰구·계단 진입 버퍼 1분.
const DETOUR_FACTOR = 1.3;
const WALK_SPEED_M_PER_MIN = 75;
const ENTRY_BUFFER_MIN = 1;

export function estimateWalkMin(distanceM: number): number {
  const min =
    (distanceM * DETOUR_FACTOR) / WALK_SPEED_M_PER_MIN + ENTRY_BUFFER_MIN;
  return Math.max(1, Math.round(min));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}
