import { NextRequest, NextResponse } from "next/server";
import { toApiStationName } from "@/lib/lines-meta";
import type { ArrivalsApiResponse, RawArrival } from "@/lib/types";

export const dynamic = "force-dynamic";

const SEOUL_ENDPOINT = "http://swopenapi.seoul.go.kr/api/subway";

// 아주 짧은 메모리 캐시 (동일 역 연타 방지)
const cache = new Map<string, { at: number; body: ArrivalsApiResponse }>();
const CACHE_MS = 10_000;

export async function GET(req: NextRequest) {
  const station = req.nextUrl.searchParams.get("station")?.trim();
  if (!station) {
    return NextResponse.json({ error: "station 파라미터가 필요합니다." }, { status: 400 });
  }
  // 목업 모드에서만 쓰는 힌트: 표시할 노선(subwayId, 콤마 구분). 실 API는 무시.
  const lineHint = (req.nextUrl.searchParams.get("lines") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const cacheKey = `${station}|${lineHint.join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.body);
  }

  const key = process.env.SEOUL_SUBWAY_KEY?.trim();
  const body: ArrivalsApiResponse = key
    ? await fetchReal(key, station)
    : mockResponse(station, lineHint);

  cache.set(cacheKey, { at: Date.now(), body });
  return NextResponse.json(body);
}

async function fetchReal(
  key: string,
  station: string,
): Promise<ArrivalsApiResponse> {
  const apiName = toApiStationName(station);
  const url = `${SEOUL_ENDPOINT}/${key}/json/realtimeStationArrival/0/25/${encodeURIComponent(
    apiName,
  )}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as SeoulResponse;

    // 데이터 없음: { errorMessage: { code: "INFO-200", ... } }
    const code = json.errorMessage?.code ?? json.status?.toString();
    if (json.errorMessage && json.errorMessage.code !== "INFO-000") {
      if (json.errorMessage.code === "INFO-200") {
        return { station, mock: false, fetchedAt: Date.now(), arrivals: [] };
      }
      return {
        station,
        mock: false,
        fetchedAt: Date.now(),
        arrivals: [],
        error: `서울 API 오류(${code}): ${json.errorMessage.message ?? ""}`,
      };
    }

    const list = json.realtimeArrivalList ?? [];
    return {
      station,
      mock: false,
      fetchedAt: Date.now(),
      arrivals: list.map(toRaw),
    };
  } catch (e) {
    return {
      station,
      mock: false,
      fetchedAt: Date.now(),
      arrivals: [],
      error: `서울 API 요청 실패: ${(e as Error).message}`,
    };
  }
}

function toRaw(a: SeoulArrival): RawArrival {
  return {
    subwayId: a.subwayId ?? "",
    updnLine: a.updnLine ?? "",
    trainLineNm: a.trainLineNm ?? "",
    bstatnNm: a.bstatnNm ?? "",
    barvlDt: Number(a.barvlDt ?? 0),
    arvlMsg2: a.arvlMsg2 ?? "",
    arvlMsg3: a.arvlMsg3 ?? "",
    arvlCd: a.arvlCd ?? "",
    recptnDt: parseRecptnDt(a.recptnDt),
  };
}

function parseRecptnDt(s?: string): number {
  if (!s) return Date.now();
  // "2026-09-10 09:41:07" (KST). 대략적인 보정이면 충분.
  const t = Date.parse(s.replace(" ", "T") + "+09:00");
  return Number.isNaN(t) ? Date.now() : t;
}

// ── 목업 ──────────────────────────────────────────────────────
// 키가 없을 때. 역 이름 + 현재 분으로 시드를 만들어 "살아있는" 느낌을 준다.
function mockResponse(station: string, lineHint: string[]): ArrivalsApiResponse {
  const now = Date.now();
  const seed = [...station].reduce((a, c) => a + c.charCodeAt(0), 0);
  const minute = Math.floor(now / 60000);
  const rng = mulberry32(seed + minute);

  const lines =
    lineHint.length > 0 ? lineHint : MOCK_LINE_BY_HINT[station] ?? ["1002"];
  const arrivals: RawArrival[] = [];

  for (const subwayId of lines) {
    for (let dirIdx = 0; dirIdx < 2; dirIdx++) {
      const count = 2;
      for (let i = 0; i < count; i++) {
        const base = 60 + Math.floor(rng() * 120);
        const sec = base + i * (200 + Math.floor(rng() * 120)) + dirIdx * 40;
        const dest =
          MOCK_DEST[subwayId]?.[dirIdx] ?? (dirIdx === 0 ? "상행종착" : "하행종착");
        const isLoop = subwayId === "1002";
        arrivals.push({
          subwayId,
          updnLine: isLoop
            ? dirIdx === 0
              ? "내선"
              : "외선"
            : dirIdx === 0
              ? "상행"
              : "하행",
          trainLineNm: `${dest}행 - ${dest}방면`,
          bstatnNm: dest,
          barvlDt: sec,
          arvlMsg2:
            sec <= 30 ? "곧 도착" : `${Math.round(sec / 60)}분 후 (${dest} 방면)`,
          arvlMsg3: dest,
          arvlCd: sec <= 30 ? "1" : "99",
          recptnDt: now,
        });
      }
    }
  }

  arrivals.sort((a, b) => a.barvlDt - b.barvlDt);
  return { station, mock: true, fetchedAt: now, arrivals };
}

const MOCK_LINE_BY_HINT: Record<string, string[]> = {
  강남: ["1002", "1077"],
  잠실: ["1002", "1008"],
  삼성: ["1002"],
  역삼: ["1002"],
  선릉: ["1002", "1075"],
  왕십리: ["1002", "1005", "1063", "1075"],
  서울역: ["1001", "1004"],
  시청: ["1001", "1002"],
  건대입구: ["1002", "1007"],
  홍대입구: ["1002", "1063"],
  고속터미널: ["1003", "1007", "1009"],
  사당: ["1002", "1004"],
};

const MOCK_DEST: Record<string, [string, string]> = {
  "1001": ["광운대", "인천"],
  "1002": ["성수", "신도림"],
  "1003": ["대화", "오금"],
  "1004": ["불암산", "오이도"],
  "1005": ["방화", "하남검단산"],
  "1006": ["응암", "신내"],
  "1007": ["장암", "석남"],
  "1008": ["별내", "모란"],
  "1009": ["개화", "중앙보훈병원"],
  "1063": ["수색", "용문"],
  "1075": ["청량리", "죽전"],
  "1077": ["신사", "광교"],
  "1092": ["북한산우이", "신설동"],
};

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Seoul API 응답 타입 (필요한 부분만) ──────────────────────────
interface SeoulResponse {
  errorMessage?: { code?: string; message?: string; status?: number };
  status?: number;
  realtimeArrivalList?: SeoulArrival[];
}
interface SeoulArrival {
  subwayId?: string;
  updnLine?: string;
  trainLineNm?: string;
  bstatnNm?: string;
  barvlDt?: string;
  arvlMsg2?: string;
  arvlMsg3?: string;
  arvlCd?: string;
  recptnDt?: string;
}
