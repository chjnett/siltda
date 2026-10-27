"use client";

import { useState } from "react";
import { fmt2, fmtInt, monthShort, type BaseMonth } from "@/src/domain/format";
import type { AltItems } from "@/src/domain/economics";
import type { TimelineMonth } from "@/src/domain/overview";

/** 퍼센트 도넛 */
export function Donut({ pct, label, size = 96 }: { pct: number | null; label: string; size?: number }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const shown = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${pct === null ? "계산 불가" : `${pct.toFixed(1)}%`}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={10} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#22c55e" strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${(c * shown) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray .8s ease" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.2} fontWeight={650} fill="#fafafa">
        {pct === null ? "—" : `${pct.toFixed(0)}%`}
      </text>
    </svg>
  );
}

/** 순편익 워터폴: 회피 처분비 + 자재 조달 절감 − 운송비 − 품질검사비 − 임시적치비 = 순편익 */
export function Waterfall({ items, net, muted = false }: { items: AltItems; net: number; muted?: boolean }) {
  const steps: Array<{ label: string; value: number; total?: boolean }> = [
    { label: "회피 처분비", value: items.avoidedDisposal },
    { label: "자재 절감", value: items.materialSaving },
    { label: "운송비", value: -items.transport },
    { label: "품질검사", value: -items.inspection },
    { label: "임시적치", value: -items.storage },
    { label: "순편익", value: net, total: true },
  ];
  const W = 300;
  const H = 150;
  const padB = 28;
  const padT = 12;
  let run = 0;
  const bars = steps.map((s) => {
    const from = s.total ? 0 : run;
    const to = s.total ? s.value : run + s.value;
    if (!s.total) run = to;
    return { ...s, lo: Math.min(from, to), hi: Math.max(from, to) };
  });
  const max = Math.max(0.01, ...bars.map((b) => b.hi));
  const min = Math.min(0, ...bars.map((b) => b.lo));
  const y = (v: number) => padT + ((max - v) / (max - min)) * (H - padT - padB);
  const bw = W / steps.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dash-waterfall" role="img" aria-label={`순편익 워터폴, 순편익 ${fmt2(net)}억원`} data-muted={muted || undefined}>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#35353a" />
      {bars.map((b, i) => {
        const fill = b.total ? (b.value > 0 ? "#d4d4d8" : "#ef4444") : b.value >= 0 ? "#22c55e" : "#f59e0b";
        const top = y(b.hi);
        const h = Math.max(1.5, y(b.lo) - y(b.hi));
        return (
          <g key={b.label}>
            <rect x={i * bw + 6} y={top} width={bw - 12} height={h} rx={2} fill={fill} opacity={muted ? 0.45 : 1} />
            <text x={i * bw + bw / 2} y={top - 3} textAnchor="middle" fontSize={9} fontWeight={600} fill="#fafafa">{b.value >= 0 ? "" : "−"}{fmt2(Math.abs(b.value))}</text>
            <text x={i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize={8.5} fill="#a1a1aa">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export interface GaugeMarker { label: string; value: number }

/** 항목 값과 용도별 기준선을 한 줄에 표시 */
export function Gauge({ label, value, unit, max, markers, status }: { label: string; value: number; unit: string; max: number; markers: GaugeMarker[]; status?: "ok" | "caution" | "bad" }) {
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div className="dash-gauge" data-status={status}>
      <div className="dash-gauge-head"><span>{label}</span><strong>{value}{unit}</strong></div>
      <div className="dash-gauge-track" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <span className="dash-gauge-fill" style={{ width: pos(value) }} />
        {markers.map((m) => <span key={m.label} className="dash-gauge-mark" style={{ left: pos(m.value) }} title={`${m.label} 기준선 ${m.value}${unit}(가정값)`}><i>{m.label}</i></span>)}
      </div>
    </div>
  );
}

/** HOME 12개월 수급 타임라인: 공급 vs 수요 막대, 어긋난 구간 강조, 임시적치 필요량 라인, hover 툴팁 */
export function TimelineChart({ months, base }: { months: TimelineMonth[]; base: BaseMonth }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 240;
  const padL = 44;
  const padB = 26;
  const padT = 14;
  const max = Math.max(1, ...months.flatMap((m) => [m.supply, m.demand, m.storage])) * 1.1;
  const slot = (W - padL) / months.length;
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const line = months.map((m, i) => `${i === 0 ? "M" : "L"}${padL + i * slot + slot / 2},${y(m.storage)}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const active = hover !== null ? months[hover] : null;
  return (
    <div className="dash-timeline">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="12개월 준설 발생 예정량과 복원 필요량 비교 막대 차트">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#29292d" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#a1a1aa">{fmtInt(t / 1000)}k</text>
          </g>
        ))}
        {months.map((m, i) => {
          const x = padL + i * slot;
          const bw = slot * 0.32;
          return (
            <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${monthShort(base, m.month)} 공급 ${fmtInt(m.supply)} 수요 ${fmtInt(m.demand)} 세제곱미터`}>
              {m.mismatch && <rect x={x + 1} y={padT} width={slot - 2} height={H - padT - padB} fill="#ef4444" opacity={0.16} />}
              {hover === i && <rect x={x + 1} y={padT} width={slot - 2} height={H - padT - padB} fill="#27272a" opacity={0.8} />}
              <rect x={x + slot / 2 - bw - 1} y={y(m.supply)} width={bw} height={Math.max(0, y(0) - y(m.supply))} rx={2} fill="#22d3ee" />
              <rect x={x + slot / 2 + 1} y={y(m.demand)} width={bw} height={Math.max(0, y(0) - y(m.demand))} rx={2} fill="#f59e0b" />
              <text x={x + slot / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#a1a1aa">{monthShort(base, m.month)}</text>
              <rect x={x} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
            </g>
          );
        })}
        <path d={line} fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 3" />
      </svg>
      <ul className="dash-timeline-legend">
        <li><i style={{ background: "#22d3ee" }} /> 준설 발생 예정량(공급)</li>
        <li><i style={{ background: "#f59e0b" }} /> 복원 사업 필요량(수요)</li>
        <li><i style={{ background: "#ef4444" }} /> 임시적치 필요량(누적)</li>
        <li><i style={{ background: "rgba(239, 68, 68, 0.35)" }} /> 시점 어긋남 구간</li>
      </ul>
      {active && (
        <div className="dash-tooltip" role="tooltip">
          <strong>{monthShort(base, active.month)}{active.mismatch ? " · 시점 어긋남" : ""}</strong>
          <span>공급 {fmtInt(active.supply)} m³ · 수요 {fmtInt(active.demand)} m³ · 적치 필요 {fmtInt(active.storage)} m³</span>
          <b>공급처</b>
          {active.suppliers.length ? active.suppliers.map((s) => <span key={s.name}>· {s.name} {fmtInt(s.volumeM3)} m³</span>) : <span>· 없음</span>}
          <b>수요처</b>
          {active.demanders.length ? active.demanders.map((s) => <span key={s.name}>· {s.name} {fmtInt(s.volumeM3)} m³</span>) : <span>· 없음</span>}
        </div>
      )}
    </div>
  );
}
