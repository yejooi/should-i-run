"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArrivalList from "@/components/ArrivalList";
import DestinationInput from "@/components/DestinationInput";
import ThemeToggle from "@/components/ThemeToggle";
import VerdictCard from "@/components/VerdictCard";
import { buildArrivals } from "@/lib/arrivals";
import { formatDistance } from "@/lib/geo";
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-16 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">지금 뛰어야 하나?</h1>
          <p className="text-xs text-dim">목적지만 넣으면 뛸지 말지 알려드려요</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="mt-5">
        <DestinationInput
          value={destination}
          onSelect={chooseDestination}
          onClear={clearDestination}
        />
      </div>

      {/* 위치 상태 */}
      <div className="mt-3">
        {geoStatus === "loading" && (
          <p className="text-sm text-dim">현위치 확인 중…</p>
        )}
        {geoStatus === "ok" && nearest[0] && (
          <p className="text-sm text-dim">
            현위치 확인됨 · 가까운 역 <b className="text-fg">{nearest[0].station}</b>
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
      </div>

      {/* 결과 */}
      {planResult && (
        <div className="mt-5 flex flex-col gap-4">
          {verdict ? (
            <VerdictCard verdict={verdict} />
          ) : loadingArr ? (
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-dim">
              도착 정보 불러오는 중…
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-dim">
              도착 정보를 찾지 못했어요.
            </div>
          )}

          <RouteSummary result={planResult} />

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-dim">
                {boardStation}역 다음 열차
              </h2>
              <span className="text-xs text-faint">
                {loadingArr ? "갱신 중…" : `${secondsAgo}초 전`}
              </span>
            </div>
            <ArrivalList arrivals={arrivals} now={now} walkMin={walkMin} />
          </section>

          {arrErr && (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-dim">
              {arrErr}
            </p>
          )}
        </div>
      )}

      {!planResult && destination && nearest.length === 0 && (
        <p className="mt-5 text-sm text-dim">
          출발 위치를 확인하면 경로를 계산할게요.
        </p>
      )}

      {!planResult && destination && nearest.length > 0 && (
        <p className="mt-5 text-sm text-dim">
          {destination}까지 가는 경로를 찾지 못했어요. 다른 역으로 시도해 보세요.
        </p>
      )}

      <footer className="mt-auto pt-8 text-center text-[11px] text-faint">
        {mock ? (
          <span className="rounded-full border border-border px-2 py-1">
            목업 데이터 · 실시간 아님 (SEOUL_SUBWAY_KEY 설정 시 실데이터)
          </span>
        ) : (
          <span>실시간 도착: 서울시 열린데이터광장</span>
        )}
        <div className="mt-2">도보 시간은 직선거리 기반 추정치입니다</div>
      </footer>
    </div>
  );
}

function RouteSummary({
  result,
}: {
  result: NonNullable<ReturnType<typeof planRoute>>;
}) {
  const { plan, origin } = result;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-dim">가장 가까운 역</span>
        <span className="font-semibold">
          {origin.station}
          <span className="ml-2 font-normal text-dim">
            도보 약 {origin.walkMin}분
            {origin.distanceM > 0 && ` · ${formatDistance(origin.distanceM)}`}
          </span>
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {plan.legs.map((leg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold">
              {leg.lineName}
            </span>
            <span className="text-dim">
              {leg.boardStation} → {leg.alightStation}
            </span>
            <span className="text-faint">·</span>
            <span>{leg.wayLabel}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-faint">
        {plan.transfers > 0 ? `환승 ${plan.transfers}회 · ` : "환승 없음 · "}
        약 {plan.roughMinutes}분 · {plan.totalStops}개 역
      </div>
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
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-dim">
          {geoStatus === "denied"
            ? "위치 권한이 없어요. 출발역을 직접 고르세요."
            : "위치를 못 찾았어요. 출발역을 직접 고르세요."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-dim hover:text-fg"
        >
          다시 시도
        </button>
      </div>

      <div className="mt-3">
        <DestinationInput
          value={manualOrigin}
          onSelect={onOrigin}
          onClear={() => onOrigin(null)}
          label="출발역"
          placeholder="현재 위치에서 가까운 역"
        />
      </div>

      {manualOrigin && (
        <label className="mt-3 flex items-center justify-between text-sm">
          <span className="text-dim">역까지 도보</span>
          <span className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={15}
              value={manualWalkMin}
              onChange={(e) => onWalkMin(Number(e.target.value))}
              className="w-32"
            />
            <b className="tabular-nums">{manualWalkMin}분</b>
          </span>
        </label>
      )}
    </div>
  );
}
