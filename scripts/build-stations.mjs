// 내장 역 좌표(src/data/stations.json)를 서울시 열린데이터광장 API로 채우거나 갱신한다.
//
//   SEOUL_SUBWAY_KEY=xxxx node scripts/build-stations.mjs
//
// - lines.json 에 있는 모든 역 이름을 훑어 좌표를 조회하고 stations.json 을 다시 쓴다.
// - 이미 좌표가 있는 역은 --force 를 주지 않는 한 건드리지 않는다.
// - 이 스크립트는 개발 편의용이다. 앱 런타임은 커밋된 stations.json 만 읽는다.
//
// 참고: SearchInfoBySubwayNameService 응답의 XPOINT_WGS=경도, YPOINT_WGS=위도.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "src", "data");

const KEY = process.env.SEOUL_SUBWAY_KEY?.trim();
const FORCE = process.argv.includes("--force");

if (!KEY) {
  console.error("SEOUL_SUBWAY_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const lines = JSON.parse(await readFile(join(DATA, "lines.json"), "utf8")).lines;
const stationsDoc = JSON.parse(
  await readFile(join(DATA, "stations.json"), "utf8"),
);

const known = new Map(stationsDoc.stations.map((s) => [s.name, s]));
const allNames = new Set();
for (const line of Object.values(lines)) {
  for (const st of line.stations) allNames.add(st);
}

let filled = 0;
let missed = 0;

for (const name of allNames) {
  const existing = known.get(name);
  if (existing && !FORCE) continue;

  const url = `http://openapi.seoul.go.kr:8088/${KEY}/json/SearchInfoBySubwayNameService/1/5/${encodeURIComponent(
    name,
  )}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    const row = json?.SearchInfoBySubwayNameService?.row?.[0];
    const lng = Number(row?.XPOINT_WGS);
    const lat = Number(row?.YPOINT_WGS);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      known.set(name, {
        name,
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
      });
      filled++;
      process.stdout.write(`+ ${name}\n`);
    } else {
      missed++;
      process.stdout.write(`? ${name} (좌표 없음)\n`);
    }
  } catch (e) {
    missed++;
    process.stdout.write(`! ${name} (${e.message})\n`);
  }
  await new Promise((r) => setTimeout(r, 120)); // rate limit 배려
}

stationsDoc.stations = [...known.values()].sort((a, b) =>
  a.name.localeCompare(b.name, "ko"),
);

await writeFile(
  join(DATA, "stations.json"),
  JSON.stringify(stationsDoc, null, 2) + "\n",
  "utf8",
);

console.log(`\n완료: ${filled}개 채움, ${missed}개 실패, 총 ${known.size}개.`);
