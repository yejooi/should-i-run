# 지금 뛰어야 하나? 🏃

늦었을 때 **목적지만 입력**하면

1. 현위치에서 **가장 가까운 지하철역까지 도보 몇 분**인지
2. 내가 **타야 할 다음 열차가 몇 분 뒤**에 오는지 (실시간)

를 알려주고, 둘을 비교해 **"뛰어" / "빠르게 걸으면 탐" / "여유"** 를 판정합니다.
수도권 지하철 기준.

## 동작 방식

| 부분 | 방식 |
| --- | --- |
| 현위치 | 브라우저 Geolocation API |
| 가장 가까운 역 | 내장 역 좌표(`src/data/stations.json`) + Haversine |
| 도보 시간 | 직선거리 × 우회계수(1.3) ÷ 75m/분 + 진입 1분 (오차 ±1~2분) |
| 타야 할 호선·방면·환승 | 내장 노선 그래프(`src/data/lines.json`) + Dijkstra |
| 다음 열차 도착 | **서울시 열린데이터광장** 지하철 실시간 도착정보 API (`/api/arrivals` 프록시) |

외부 길찾기(ODsay)·지오코딩(Kakao) 미사용. 발급할 API 키는 **1개뿐**이고, 없으면
**목업 모드**로 전체 UI/로직이 그대로 동작합니다.

## 시작하기

```bash
npm install
npm run dev        # http://localhost:3000
```

키 없이 바로 실행하면 **목업 데이터**로 뜹니다(하단에 배지 표시).

### 실시간 데이터 켜기

1. <https://data.seoul.go.kr> 로그인 → 마이페이지 → 인증키 신청
   → **일반 인증키(TYPE: JSON)** 즉시 발급
2. 프로젝트 루트에 `.env.local` 생성:

   ```bash
   cp .env.example .env.local
   # SEOUL_SUBWAY_KEY=발급받은_키
   ```

3. 개발 서버 재시작. 목업 배지가 사라지고 실제 도착 시간이 표시됩니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run lint` | ESLint |
| `node scripts/check-route.mjs` | 내장 노선 데이터 무결성 + 방면 계산 검증 |
| `SEOUL_SUBWAY_KEY=… npm run build:stations` | 서울 API로 역 좌표 채우기/갱신 (개발용) |

## 데이터 범위와 한계 (MVP)

- 내장 노선: **1~9호선 + 신분당·수인분당·경의중앙·우이신설** 핵심 구간.
  - 1호선은 경인선 축(인천~광운대) 중심, 경부·경원 외곽 구간 생략
  - 2호선 성수/신정 지선, 5호선 마천지선(별도 항목), 4호선 진접선 등 일부 지선 생략
  - 수인분당·경의중앙은 서울 도심 핵심 구간만
- 역 좌표는 근사값(가장 가까운 역 판별에는 충분). `build:stations` 로 갱신 가능.
- 도보 시간은 실제 도보 경로가 아닌 직선거리 추정.
- 방면(내선/외선·상하행) 매칭은 실시간 API 문자열 파싱 기반이라, 못 맞추면
  해당 역의 모든 열차를 표시하고 "다른 방면" 으로 표시합니다.
- `src/lib/lines-meta.ts` 의 `subwayId` 매핑은 서울 API 문서 기준값. 최신 문서로 재확인 권장.

## 구조

```
src/
  app/
    page.tsx                메인 화면 (client)
    api/arrivals/route.ts   서울 API 프록시 + 목업
    layout.tsx, globals.css
  components/                DestinationInput, VerdictCard, ArrivalList, ThemeToggle
  data/                      lines.json, stations.json, landmarks.json
  lib/
    geo.ts        haversine, 도보시간 추정
    network.ts    데이터 로드 + 노선 그래프
    stations.ts   최근접 역, 자동완성
    route.ts      Dijkstra, 첫 승차 구간/방면
    arrivals.ts   API 응답 정규화 + 방면 매칭
    verdict.ts    판정
scripts/
  check-route.mjs      데이터/라우팅 검증
  build-stations.mjs   좌표 갱신
```
