"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudSun, Snowflake, Sun, type LucideIcon } from "lucide-react";
import { WORK_LIMITS } from "@/src/config/assumptions";
import { fmt1, NO_INFO } from "@/src/domain/format";
import { loadWeather, summarizeDays, workLevel, workLevelLabels, workLimitText, type HourRow, type WeatherCondition, type WorkKind, type WorkLevel } from "@/src/domain/weather";
import type { LonLat } from "@/src/types";
import { useAsync } from "@/src/state/useAsync";
import { ErrorState, LoadingState, Pill, type Tone } from "./ui";

export const conditionMeta: Record<WeatherCondition, { label: string; icon: LucideIcon }> = {
  clear: { label: "맑음", icon: Sun },
  "partly-cloudy": { label: "구름 조금", icon: CloudSun },
  cloudy: { label: "흐림", icon: Cloud },
  rain: { label: "비", icon: CloudRain },
  shower: { label: "소나기", icon: CloudDrizzle },
  snow: { label: "눈", icon: Snowflake },
  storm: { label: "뇌우", icon: CloudLightning },
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const levelTone: Record<WorkLevel, Tone> = { ok: "teal", caution: "amber", no: "red" };
const kinds: WorkKind[] = ["dredge", "transport", "placement"];

interface Props {
  id: string;
  name: string;
  coordinate: LonLat;
}

export default function WeekWeather({ id, name, coordinate }: Props) {
  const [hour, setHour] = useState(12);
  useEffect(() => {
    const update = () => setHour(new Date().getHours());
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);
  const lon = coordinate[0];
  const lat = coordinate[1];
  const load = useCallback((signal: AbortSignal) => loadWeather([{ id, coordinate: [lon, lat] }], new Set([id]), signal), [id, lon, lat]);
  const { state, reload } = useAsync(load);

  const rows = state.status === "ready" ? state.data.hours[id] ?? [] : [];
  const days = useMemo(() => summarizeDays(rows), [rows]);

  if (state.status === "loading") return <LoadingState label="해상기상을 불러오는 중" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={reload} />;
  if (rows.length === 0) return <LoadingState label="기상 데이터가 없습니다" />;

  const bundle = state.data;
  const idx = Math.min(hour, rows.length - 1);

  return (
    <div className="dash-weather">
      <div className="dash-weather-meta">
        <strong>{name}</strong>
        <span className="dash-muted">기준 {new Date(bundle.issuedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        {bundle.isDemo ? <Pill tone="amber">시연용 데이터 (예보 조회 실패)</Pill> : <Pill tone="teal">{bundle.source} 모델 예보</Pill>}
      </div>

      <ul className="dash-weather-days">
        {days.map((day, i) => {
          const meta = conditionMeta[day.condition];
          const Icon = meta.icon;
          const [y, m, d] = day.date.split("-").map(Number);
          const selected = idx >= day.startIndex && idx < day.startIndex + 24;
          return (
            <li key={day.date}>
              <div className="dash-weather-day" data-selected={selected || undefined}>
                <span className="dash-weather-date">{i === 0 ? "오늘" : weekdays[new Date(y, m - 1, d).getDay()]}<small>{m}.{d}</small></span>
                <Icon size={24} aria-hidden="true" />
                <span className="dash-muted">{meta.label}</span>
                <strong>{day.tempMaxC}°<span className="dash-muted"> / {day.tempMinC}°</span></strong>
                <span className="dash-weather-stat">풍속 {fmt1(day.windMaxMs)} m/s</span>
                <span className="dash-weather-stat">파고 {day.waveMaxM === null ? NO_INFO : `${fmt1(day.waveMaxM)} m`}</span>
                <span className="dash-weather-stat">강수 {fmt1(day.precipSumMm)} mm</span>
                <span className="dash-work-badges">
                  {kinds.map((k) => {
                    const level = workLevel(day, k);
                    return <Pill key={k} tone={levelTone[level]} title={workLimitText(k)}>{WORK_LIMITS[k].label} {workLevelLabels[level]}</Pill>;
                  })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <HourlyChart rows={rows} index={idx} />
    </div>
  );
}

/** 시간별 풍속(선)·유의파고(선)·강수(막대) 그래프 */
function HourlyChart({ rows, index }: { rows: HourRow[]; index: number }) {
  const W = 720;
  const H = 150;
  const padL = 30;
  const padB = 18;
  const padT = 8;
  const n = rows.length;
  const maxWind = Math.max(12, ...rows.map((r) => r.windMs));
  const maxWave = Math.max(2, ...rows.map((r) => r.waveM ?? 0));
  const maxRain = Math.max(2, ...rows.map((r) => r.precipMm));
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL);
  const yv = (v: number, max: number) => padT + (1 - v / max) * (H - padT - padB);
  const wind = rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(i)},${yv(r.windMs, maxWind)}`).join(" ");
  const waveRows = rows.map((r, i) => ({ i, v: r.waveM })).filter((p): p is { i: number; v: number } => p.v !== null);
  const wave = waveRows.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i)},${yv(p.v, maxWave)}`).join(" ");
  const dayStarts = rows.map((r, i) => (r.time.endsWith("T00:00") ? i : -1)).filter((i) => i >= 0);
  return (
    <div className="dash-hourly">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="시간별 풍속, 유의파고, 강수 그래프">
        {dayStarts.map((i) => <line key={i} x1={x(i)} x2={x(i)} y1={padT} y2={H - padB} stroke="#29292d" />)}
        {rows.map((r, i) => (r.precipMm > 0 ? <rect key={i} x={x(i) - 1} y={yv(r.precipMm, maxRain)} width={2} height={H - padB - yv(r.precipMm, maxRain)} fill="#52525b" /> : null))}
        <path d={wind} fill="none" stroke="#e4e4e7" strokeWidth={1.6} />
        {wave && <path d={wave} fill="none" stroke="#a1a1aa" strokeWidth={1.6} />}
        <line x1={x(index)} x2={x(index)} y1={padT} y2={H - padB} stroke="#fafafa" strokeWidth={1.5} />
        {dayStarts.map((i) => <text key={i} x={x(i) + 3} y={H - 4} fontSize={9} fill="#a1a1aa">{rows[i].time.slice(5, 10).replace("-", ".")}</text>)}
        <text x={2} y={padT + 8} fontSize={9} fill="#a1a1aa">{maxWind.toFixed(0)}</text>
      </svg>
      <ul className="dash-timeline-legend">
        <li><i style={{ background: "#e4e4e7" }} /> 풍속(m/s)</li>
        <li><i style={{ background: "#a1a1aa" }} /> 유의파고(m)</li>
        <li><i style={{ background: "#52525b" }} /> 강수(mm/h)</li>
      </ul>
    </div>
  );
}
