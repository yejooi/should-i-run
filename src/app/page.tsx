"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArrivalList from "@/components/ArrivalList";
import DestinationInput from "@/components/DestinationInput";
import ThemeToggle from "@/components/ThemeToggle";
import VerdictCard from "@/components/VerdictCard";
import { buildArrivals } from "@/lib/arrivals";
import { formatDistance } from "@/lib/geo";
import { clockHHMM } from "@/lib/format";
import { lineBadgeLabel, lineColor } from "@/lib/lines-meta";
import { STATION_LINES } from "@/lib/network";
import { planRoute } from "@/lib/route";
import { nearestStations } from "@/lib/stations";
import type { Coord, NearestStation, RawArrival } from "@/lib/types";
import { judge } from "@/lib/verdict";

type GeoStatus = "idle" | "loading" | "ok" | "denied" | "error";

const POLL_MS = 15_000;

export default function Home() {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [pos, setPos] = useState<Coord | null>(null);
  const [destination, setDestination] = useState<string | null>(null);

  // 위치 거부 시 수동 승차역
  const [manualOrigin, setManualOrigin] = useState<string | null>(null);
  const [manualWalkMin, setManualWalkMin] = useState(3);

  const [raws, setRaws] = useState<RawArrival[]>([]);
  const [mock, setMock] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [arrErr, setArrErr] = useState<string | null>(null);
  const [loadingArr, setLoadingArr] = useState(false);

  const [now, setNow] = useState(() => Date.now());

  // 1초 카운트다운 틱
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const requestGeo = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoStatus("ok");
      },
      (err) => {
        setGeoStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15_000 },
    );
  }, []);

  useEffect(() => {
    // 마운트 시 위치 요청 시작 (외부 시스템과의 동기화)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    requestGeo();
  }, [requestGeo]);

  const chooseDestination = useCallback((station: string) => {
    setRaws([]);
    setArrErr(null);
    setFetchedAt(0);
    setDestination(station);
  }, []);

  const clearDestination = useCallback(() => {
    setRaws([]);
    setArrErr(null);
    setFetchedAt(0);
    setDestination(null);
  }, []);

  const nearest = useMemo<NearestStation[]>(() => {
    if (pos) return nearestStations(pos, 3);
    if (manualOrigin) {
      return [
        {
          station: manualOrigin,
          lines: STATION_LINES.get(manualOrigin) ?? [],
          distanceM: 0,
          walkMin: manualWalkMin,
        },
      ];
    }
    return [];
  }, [pos, manualOrigin, manualWalkMin]);

  const planResult = useMemo(() => {
    if (!destination || nearest.length === 0) return null;
    return planRoute({ nearest, destination });
  }, [destination, nearest]);

  const firstLeg = planResult?.plan.legs[0] ?? null;
  const boardStation = firstLeg?.boardStation ?? planResult?.origin.station ?? null;
  const lineHint = firstLeg?.subwayId ?? "";
  const walkMin = planResult?.origin.walkMin ?? manualWalkMin;
  const accentLineColor = firstLeg ? lineColor(firstLeg.lineKey) : "#6B7280";

  const fetchArrivals = useCallback(async (station: string, lines: string) => {
    setLoadingArr(true);
    setArrErr(null);
    try {
      const qs = new URLSearchParams({ station });
      if (lines) qs.set("lines", lines);
      const r = await fetch(`/api/arrivals?${qs.toString()}`);
      const j = await r.json();
      setRaws(j.arrivals ?? []);
      setMock(Boolean(j.mock));
      setFetchedAt(j.fetchedAt ?? Date.now());
      setArrErr(j.error ?? null);
    } catch (e) {
      setArrErr(`도착 정보를 불러오지 못했어요: ${(e as Error).message}`);
    } finally {
      setLoadingArr(false);
    }
  }, []);

  // 승차역이 정해지면 폴링 시작
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!boardStation) return;
    // 승차역이 정해지면 도착 정보 fetch 시작 (외부 데이터 동기화)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchArrivals(boardStation, lineHint);
    pollRef.current = setInterval(() => {
      if (document.visibilityState === "visible")
        fetchArrivals(boardStation, lineHint);
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible")
        fetchArrivals(boardStation, lineHint);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [boardStation, lineHint, fetchArrivals]);

  const arrivals = useMemo(
    () => buildArrivals(raws, firstLeg),
    [raws, firstLeg],
  );

  const verdict = useMemo(() => {
    if (!planResult || arrivals.length === 0) return null;
    return judge(walkMin, arrivals, now);
  }, [planResult, arrivals, walkMin, now]);

  const secondsAgo = fetchedAt ? Math.max(0, Math.round((now - fetchedAt) / 1000)) : 0;

  const ticker = useMemo(() => {
    if (!planResult || !firstLeg) return "";
    const { plan, origin } = planResult;
    const dist = origin.distanceM > 0 ? ` · ${formatDistance(origin.distanceM)}` : "";
    const transferText = plan.transfers > 0 ? `환승 ${plan.transfers}회` : "환승 없음";
    return `가장 가까운 역 ${origin.station} · 도보 ${origin.walkMin}분${dist} · ${firstLeg.lineName} ${firstLeg.wayLabel} · ${destination}까지 ${plan.totalStops}개 역 · 약 ${plan.roughMinutes}분 · ${transferText}`;
  }, [planResult, firstLeg, destination]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3.5 px-4 pb-10 pt-5">
      {/* 상단 바: 승차역 식별 or 워드마크 + 시계 + 테마 */}
      <header className="flex items-center justify-between">
        {firstLeg ? (
          <div className="flex items-center gap-2">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: accentLineColor }}
            >
              {lineBadgeLabel(firstLeg.lineKey)}
            </span>
            <span className="font-display text-[15px] leading-none text-ink">
              {boardStation}역
            </span>
          </div>
        ) : (
          <span className="font-digital text-[11px] tracking-[.14em] text-accent">
            SHOULD I RUN?
          </span>
        )}
        <div className="flex items-center gap-2.5">
          <span className="font-digital text-[13px] leading-none text-dim">
            {clockHHMM(new Date(now))}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <DestinationInput
        value={destination}
        onSelect={chooseDestination}
        onClear={clearDestination}
      />

      {/* 위치 상태 */}
      {geoStatus === "loading" && (
        <p className="text-[12px] text-dim">현위치 확인 중…</p>
      )}
      {geoStatus === "ok" && !planResult && nearest[0] && (
        <p className="text-[12px] text-dim">
          현위치 확인됨 · 가까운 역 <b className="text-ink">{nearest[0].station}</b>
        </p>
      )}
      {(geoStatus === "denied" || geoStatus === "error") && (
        <ManualOrigin
          geoStatus={geoStatus}
          manualOrigin={manualOrigin}
          manualWalkMin={manualWalkMin}
          onOrigin={setManualOrigin}
          onWalkMin={setManualWalkMin}
          onRetry={requestGeo}
        />
      )}

      {/* 결과 */}
      {planResult && (
        <div className="flex flex-col gap-3.5">
          {verdict ? (
            <VerdictCard verdict={verdict} now={now} />
          ) : (
            <div className="rounded-[18px] border border-line bg-head p-5 text-[13px] text-dim">
              {loadingArr ? "도착 정보 불러오는 중…" : "도착 정보를 찾지 못했어요."}
            </div>
          )}

          {ticker && (
            <div className="overflow-hidden border-y border-line py-2">
              <div className="marquee-track">
                <span className="font-display pr-10 text-[13px]" style={{ color: "var(--accent)" }}>
                  {ticker}
                </span>
                <span className="font-display pr-10 text-[13px]" style={{ color: "var(--accent)" }} aria-hidden>
                  {ticker}
                </span>
              </div>
            </div>
          )}

          {planResult.plan.transfers > 0 && (
            <div className="flex flex-col gap-1.5">
              {planResult.plan.legs.map((leg, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: lineColor(leg.lineKey) }}
                  >
                    {lineBadgeLabel(leg.lineKey)}
                  </span>
                  <span className="text-dim">
                    {leg.boardStation} → {leg.alightStation}
                  </span>
                  <span className="text-faint">· {leg.wayLabel}</span>
                </div>
              ))}
            </div>
          )}

          <section>
            <div className="mb-1.5 flex items-baseline justify-between">
              <h2 className="font-display text-[12px] text-dim">
                {boardStation}역 다음 열차
              </h2>
              <span className="font-digital text-[10px] text-faint">
                {loadingArr ? "갱신 중…" : `UPD ${secondsAgo}S`}
              </span>
            </div>
            <ArrivalList
              arrivals={arrivals}
              now={now}
              walkMin={walkMin}
              lineColorHex={accentLineColor}
            />
          </section>

          {arrErr && (
            <p className="rounded-[10px] bg-head px-3.5 py-2.5 text-[11px] text-dim">{arrErr}</p>
          )}
        </div>
      )}

      {!planResult && destination && nearest.length === 0 && (
        <p className="text-[12px] text-dim">출발 위치를 확인하면 경로를 계산할게요.</p>
      )}

      {!planResult && destination && nearest.length > 0 && (
        <p className="text-[12px] text-dim">
          {destination}까지 가는 경로를 찾지 못했어요. 다른 역으로 시도해 보세요.
        </p>
      )}

      <footer className="mt-auto flex flex-col items-center gap-1.5 pt-6 text-center">
        <span className="font-digital rounded-full border border-pill-line px-2.5 py-1 text-[10px] text-accent">
          {mock ? "MOCK DATA · 실시간 아님" : "LIVE · 서울시 열린데이터광장"}
        </span>
        <span className="text-[10px] text-faint">도보 시간은 추정치입니다</span>
      </footer>
    </div>
  );
}

function ManualOrigin({
  geoStatus,
  manualOrigin,
  manualWalkMin,
  onOrigin,
  onWalkMin,
  onRetry,
}: {
  geoStatus: GeoStatus;
  manualOrigin: string | null;
  manualWalkMin: number;
  onOrigin: (s: string | null) => void;
  onWalkMin: (n: number) => void;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-head p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-dim">
          {geoStatus === "denied"
            ? "위치 권한이 없어요. 출발역을 직접 고르세요."
            : "위치를 못 찾았어요. 출발역을 직접 고르세요."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="font-digital shrink-0 rounded-full border border-chip-line px-2.5 py-1 text-[9px] text-dim hover:text-ink"
        >
          다시 시도
        </button>
      </div>

      <div className="mt-2.5">
        <DestinationInput
          value={manualOrigin}
          onSelect={onOrigin}
          onClear={() => onOrigin(null)}
          label="출발역"
          placeholder="현재 위치에서 가까운 역"
        />
      </div>

      {manualOrigin && (
        <label className="mt-2.5 flex items-center justify-between text-[12px]">
          <span className="text-dim">역까지 도보</span>
          <span className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={15}
              value={manualWalkMin}
              onChange={(e) => onWalkMin(Number(e.target.value))}
              className="w-28"
            />
            <b className="font-digital text-ink">{manualWalkMin}분</b>
          </span>
        </label>
      )}
    </div>
  );
}
