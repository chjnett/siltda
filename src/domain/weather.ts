import { WORK_CAUTION_MARGIN, WORK_LIMITS } from "@/src/config/assumptions";
import type { LonLat } from "@/src/types";

/**
 * 해상기상: Open-Meteo(키 불필요) 시간별 예보 + 해양(유의파고) API.
 * 값은 수치 예보 모델 결과이며 실측이 아니다. 조회에 실패하면 시연용 값으로 대체하고 isDemo로 표시한다.
 */
export type WeatherCondition = "clear" | "partly-cloudy" | "cloudy" | "rain" | "shower" | "snow" | "storm";

export interface WeatherPoint { id: string; coordinate: LonLat }

export interface HourRow {
  /** KST YYYY-MM-DDTHH:00 */
  time: string;
  tempC: number;
  windMs: number;
  /** 바람이 불어오는 방향(도) */
  windDirDeg: number;
  precipMm: number;
  waveM: number | null;
  condition: WeatherCondition;
}

export interface WeatherBundle {
  issuedAt: string;
  isDemo: boolean;
  source: string;
  hours: Record<string, HourRow[]>;
}

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
export const WEATHER_SOURCE = "Open-Meteo";
export const HOURS_7D = 168;

export function conditionFromCode(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code <= 2) return "partly-cloudy";
  if (code === 3 || code === 45 || code === 48) return "cloudy";
  if ((code >= 51 && code <= 57) || (code >= 80 && code <= 82)) return "shower";
  if (code >= 61 && code <= 67) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Open-Meteo 오류 (${response.status})`);
  return (await response.json()) as T;
}
const asArray = <T,>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);
const round1 = (v: number) => Math.round(v * 10) / 10;
const coords = (pts: WeatherPoint[]) => ({ lat: pts.map((p) => p.coordinate[1]).join(","), lon: pts.map((p) => p.coordinate[0]).join(",") });

interface HourlyResponse {
  hourly: { time: string[]; temperature_2m: number[]; wind_speed_10m: number[]; wind_direction_10m: number[]; precipitation: Array<number | null>; weather_code: number[] };
}
interface MarineResponse { hourly?: { wave_height?: Array<number | null> } }

/** 오늘 00시(KST)부터 7일(168시간) */
export async function fetchWeather(points: WeatherPoint[], waveIds: Set<string>, signal?: AbortSignal): Promise<WeatherBundle> {
  const { lat, lon } = coords(points);
  const waveTargets = points.filter((p) => waveIds.has(p.id));
  const wave = coords(waveTargets);
  const common = "timezone=Asia%2FSeoul&forecast_days=7";
  const [forecast, marine] = await Promise.all([
    getJson<HourlyResponse | HourlyResponse[]>(
      `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&${common}&wind_speed_unit=ms&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code`, signal),
    waveTargets.length
      ? getJson<MarineResponse | MarineResponse[]>(`${MARINE_URL}?latitude=${wave.lat}&longitude=${wave.lon}&${common}&hourly=wave_height`, signal).catch((e: unknown) => {
          if ((e as Error).name === "AbortError") throw e;
          return null;
        })
      : Promise.resolve(null),
  ]);
  const forecasts = asArray(forecast);
  if (forecasts.length !== points.length) throw new Error("Open-Meteo 응답 형식이 예상과 다릅니다.");
  const marines = marine ? asArray(marine) : [];
  const waveIndex = new Map(waveTargets.map((p, i) => [p.id, i]));
  const hours: Record<string, HourRow[]> = {};
  points.forEach((p, idx) => {
    const h = forecasts[idx].hourly;
    const ws = marines[waveIndex.get(p.id) ?? -1]?.hourly?.wave_height;
    hours[p.id] = h.time.slice(0, HOURS_7D).map((time, i) => {
      const w = ws?.[i];
      return {
        time,
        tempC: Math.round(h.temperature_2m[i]),
        windMs: round1(h.wind_speed_10m[i]),
        windDirDeg: Math.round(h.wind_direction_10m[i]),
        precipMm: h.precipitation[i] ?? 0,
        waveM: typeof w === "number" ? round1(w) : null,
        condition: conditionFromCode(h.weather_code[i]),
      };
    });
  });
  return { issuedAt: new Date().toISOString(), isDemo: false, source: WEATHER_SOURCE, hours };
}

function seeded(seed: string) {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 예보 조회 실패 시 쓰는 시연용 시간별 값(위치별 시드, 실제 예보 아님) */
export function buildDemoWeather(points: WeatherPoint[], waveIds: Set<string>, now = new Date()): WeatherBundle {
  const hours: Record<string, HourRow[]> = {};
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const p of points) {
    const rand = seeded(p.id);
    const phase = rand() * 6;
    const dirBase = rand() * 360;
    hours[p.id] = Array.from({ length: HOURS_7D }, (_, i) => {
      const t = new Date(start.getTime() + i * 3600_000);
      const wave = Math.sin(i / 14 + phase);
      const rainy = Math.sin(i / 23 + phase * 2) > 0.7;
      const pad = (n: number) => String(n).padStart(2, "0");
      return {
        time: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:00`,
        tempC: Math.round(18 - (p.coordinate[1] - 33) * 1.2 + Math.sin((i % 24 - 6) / 24 * Math.PI * 2) * 3),
        windMs: round1(5 + wave * 3 + rand()),
        windDirDeg: Math.round((dirBase + i * 2) % 360),
        precipMm: rainy ? round1(rand() * 3) : 0,
        waveM: waveIds.has(p.id) ? round1(1 + wave * 0.6 + (rainy ? 0.4 : 0)) : null,
        condition: rainy ? "rain" : wave > 0.3 ? "cloudy" : "clear",
      };
    });
  }
  return { issuedAt: now.toISOString(), isDemo: true, source: "시연용", hours };
}

export async function loadWeather(points: WeatherPoint[], waveIds: Set<string>, signal?: AbortSignal): Promise<WeatherBundle> {
  try {
    return await fetchWeather(points, waveIds, signal);
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    return buildDemoWeather(points, waveIds);
  }
}

// ---- 일별 집계 / 작업 가능 판정 ----
export interface DayWeather {
  date: string;
  condition: WeatherCondition;
  tempMaxC: number;
  tempMinC: number;
  windMaxMs: number;
  waveMaxM: number | null;
  precipSumMm: number;
  startIndex: number;
}

export function summarizeDays(rows: HourRow[]): DayWeather[] {
  const days = new Map<string, HourRow[]>();
  rows.forEach((r) => days.set(r.time.slice(0, 10), [...(days.get(r.time.slice(0, 10)) ?? []), r]));
  const severity: WeatherCondition[] = ["clear", "partly-cloudy", "cloudy", "shower", "rain", "snow", "storm"];
  let index = 0;
  return [...days.entries()].map(([date, list]) => {
    const waves = list.map((r) => r.waveM).filter((w): w is number => w !== null);
    const day: DayWeather = {
      date,
      condition: list.reduce((a, r) => (severity.indexOf(r.condition) > severity.indexOf(a) ? r.condition : a), "clear" as WeatherCondition),
      tempMaxC: Math.max(...list.map((r) => r.tempC)),
      tempMinC: Math.min(...list.map((r) => r.tempC)),
      windMaxMs: Math.max(...list.map((r) => r.windMs)),
      waveMaxM: waves.length ? Math.max(...waves) : null,
      precipSumMm: round1(list.reduce((s, r) => s + r.precipMm, 0)),
      startIndex: index,
    };
    index += list.length;
    return day;
  });
}

export type WorkLevel = "ok" | "caution" | "no";
export type WorkKind = keyof typeof WORK_LIMITS;
export const workLevelLabels: Record<WorkLevel, string> = { ok: "가능", caution: "주의", no: "불가" };

/** 풍속·파고·강수 중 가장 나쁜 항목으로 판정. 파고 자료가 없으면 파고는 판정에서 제외한다. */
export function workLevel(day: DayWeather, kind: WorkKind): WorkLevel {
  const limit = WORK_LIMITS[kind];
  const ratios = [day.windMaxMs / limit.windMs, day.precipSumMm / limit.rainMm];
  if (day.waveMaxM !== null) ratios.push(day.waveMaxM / limit.waveM);
  const worst = Math.max(...ratios);
  return worst <= 1 ? "ok" : worst <= WORK_CAUTION_MARGIN ? "caution" : "no";
}

export const workLimitText = (kind: WorkKind) => {
  const l = WORK_LIMITS[kind];
  return `${l.label} 기준(시연용 가정값): 풍속 ≤ ${l.windMs} m/s, 파고 ≤ ${l.waveM} m, 일 강수 ≤ ${l.rainMm} mm. 기준의 ${WORK_CAUTION_MARGIN}배 이내는 '주의', 초과는 '불가'.`;
};
