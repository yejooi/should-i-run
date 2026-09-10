// 내장 노선 데이터(lines.json)의 무결성 + 라우팅 방향 계산을 빠르게 검증한다.
//   node scripts/check-route.mjs
// route.ts 와 동일한 규칙(인접=hop, 동일역 타노선=transfer, 순환선 인덱스증가=외선)을
// 축약 구현해 데이터 자체의 문제를 잡는 것이 목적.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const lines = JSON.parse(
  await readFile(join(__dirname, "..", "src", "data", "lines.json"), "utf8"),
).lines;

const HOP = 2;
const TRANSFER = 4;
const stationLines = new Map();
for (const [key, line] of Object.entries(lines)) {
  for (const st of line.stations) {
    if (!stationLines.has(st)) stationLines.set(st, []);
    if (!stationLines.get(st).includes(key)) stationLines.get(st).push(key);
  }
}

const graph = new Map();
const add = (a, b, w) => {
  if (!graph.has(a)) graph.set(a, []);
  graph.get(a).push([b, w]);
};
for (const [key, line] of Object.entries(lines)) {
  const s = line.stations;
  for (let i = 0; i < s.length; i++) {
    const from = `${key}|${s[i]}`;
    if (!graph.has(from)) graph.set(from, []);
    if (i + 1 < s.length) {
      add(from, `${key}|${s[i + 1]}`, HOP);
      add(`${key}|${s[i + 1]}`, from, HOP);
    }
  }
  if (line.loop && s.length > 2) {
    add(`${key}|${s.at(-1)}`, `${key}|${s[0]}`, HOP);
    add(`${key}|${s[0]}`, `${key}|${s.at(-1)}`, HOP);
  }
}
for (const [st, keys] of stationLines) {
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      add(`${keys[i]}|${st}`, `${keys[j]}|${st}`, TRANSFER);
      add(`${keys[j]}|${st}`, `${keys[i]}|${st}`, TRANSFER);
    }
}

function dijkstra(sources, target) {
  const dist = new Map(sources.map((s) => [s, 0]));
  const prev = new Map(sources.map((s) => [s, null]));
  const done = new Set();
  while (done.size < dist.size) {
    let cur = null;
    let best = Infinity;
    for (const [n, d] of dist) if (!done.has(n) && d < best) (best = d), (cur = n);
    if (cur == null) break;
    done.add(cur);
    if (cur.split("|")[1] === target) {
      const path = [];
      for (let n = cur; n; n = prev.get(n)) path.unshift(n);
      return path;
    }
    for (const [to, w] of graph.get(cur) ?? []) {
      if (done.has(to)) continue;
      if (best + w < (dist.get(to) ?? Infinity)) {
        dist.set(to, best + w);
        prev.set(to, cur);
      }
    }
  }
  return null;
}

function firstLeg(origin, dest) {
  const sources = (stationLines.get(origin) ?? []).map((k) => `${k}|${origin}`);
  const path = dijkstra(sources, dest);
  if (!path) return null;
  const nodes = path.map((p) => {
    const i = p.indexOf("|");
    return { lineKey: p.slice(0, i), station: p.slice(i + 1) };
  });
  const lineKey = nodes[0].lineKey;
  let j = 0;
  while (
    j + 1 < nodes.length &&
    nodes[j + 1].lineKey === lineKey &&
    nodes[j + 1].station !== nodes[j].station
  )
    j++;
  const line = lines[lineKey];
  const s = line.stations;
  const bi = s.indexOf(nodes[0].station);
  const ti = s.indexOf(nodes[1].station);
  let way;
  if (line.loop) way = ti === (bi + 1) % s.length ? "내선순환" : "외선순환";
  else way = ti > bi ? `${s.at(-1)} 방면` : `${s[0]} 방면`;
  const transfers = new Set(nodes.map((n) => n.lineKey)).size - 1;
  return {
    lineKey,
    board: nodes[0].station,
    toward: nodes[1].station,
    alight: nodes[j].station,
    way,
    transfers,
  };
}

let fail = 0;
const eq = (label, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (기대: ${JSON.stringify(want)})`}`);
};

// 1) 연결성: 시청에서 모든 역 도달 가능
{
  const src = (stationLines.get("시청") ?? []).map((k) => `${k}|시청`);
  const dist = new Map(src.map((s) => [s, 0]));
  const done = new Set();
  while (done.size < dist.size) {
    let cur = null;
    let best = Infinity;
    for (const [n, d] of dist) if (!done.has(n) && d < best) (best = d), (cur = n);
    if (cur == null) break;
    done.add(cur);
    for (const [to, w] of graph.get(cur) ?? [])
      if (best + w < (dist.get(to) ?? Infinity)) dist.set(to, best + w);
  }
  const reachable = new Set([...dist.keys()].map((n) => n.split("|")[1]));
  const unreachable = [...stationLines.keys()].filter((s) => !reachable.has(s));
  eq("모든 역이 시청에서 도달 가능", unreachable.length, 0);
  if (unreachable.length) console.log("  도달 불가:", unreachable.join(", "));
}

// 2) 방향 계산
const t1 = firstLeg("강남", "삼성");
eq("강남→삼성 노선", t1?.lineKey, "2");
eq("강남→삼성 방면(외선)", t1?.way, "외선순환");
eq("강남→삼성 환승", t1?.transfers, 0);

const t2 = firstLeg("시청", "을지로입구");
eq("시청→을지로입구 방면(내선)", t2?.way, "내선순환");

const t3 = firstLeg("방배", "사당");
eq("방배→사당 노선", t3?.lineKey, "2");
eq("방배→사당 방면(내선)", t3?.way, "내선순환");

const t4 = firstLeg("신촌", "혜화");
eq("신촌→혜화 첫 구간 노선", t4?.lineKey, "2");
eq("신촌→혜화 환승 발생", (t4?.transfers ?? 0) >= 1, true);

const t5 = firstLeg("역삼", "홍대입구");
eq("역삼→홍대입구 노선", t5?.lineKey, "2");
eq("역삼→홍대입구 방면(내선)", t5?.way, "내선순환");

const t6 = firstLeg("교대", "양재");
eq("교대→양재 첫 구간 노선(3호선)", t6?.lineKey, "3");

console.log(fail === 0 ? "\n전체 통과" : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
