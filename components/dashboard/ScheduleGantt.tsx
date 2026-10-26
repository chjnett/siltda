"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { DEFAULT_COSTS } from "@/src/config/assumptions";
import { fmt2, monthLabel, monthRange, type BaseMonth } from "@/src/domain/format";
import type { Listing, Site } from "@/src/types";
import type { ScheduleCheck } from "@/src/domain/matching";
import type { CostParams } from "@/src/domain/economics";

interface Props {
  listing: Listing;
  site: Site;
  base: BaseMonth;
  shift: number;
  schedule: ScheduleCheck;
  volumeM3: number;
  params?: CostParams;
  onShift: (months: number) => void;
}

/** 준설 일정 vs 복원 사업 일정 간트. 준설 막대를 드래그(또는 ←/→ 키)하면 임시적치 기간·비용이 재계산된다. */
export default function ScheduleGantt({ listing, site, base, shift, schedule, volumeM3, params = DEFAULT_COSTS, onShift }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; shift: number } | null>(null);

  const lo = Math.min(listing.dredgeStart, site.needStart, schedule.dredgeStart) - 1;
  const hi = Math.max(listing.dredgeEnd + 2, site.needEnd, schedule.dredgeEnd) + 2;
  const span = Math.max(12, hi - lo + 1);
  const pct = (m: number) => `${((m - lo) / span) * 100}%`;
  const width = (a: number, b: number) => `${((b - a + 1) / span) * 100}%`;

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, shift };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || !track) return;
    const monthPx = track.clientWidth / span;
    const next = d.shift + Math.round((e.clientX - d.x) / monthPx);
    if (next !== shift) onShift(next);
  };
  const onUp = () => { drag.current = null; };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); onShift(shift - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); onShift(shift + 1); }
  };

  const storageCostEok = (volumeM3 * schedule.storageMonths * params.storagePerM3Month) / 1e8;
  const gapStart = schedule.dredgeEnd + 1;
  const gapEnd = site.needStart - 1;
  const months = Array.from({ length: span }, (_, i) => lo + i);

  return (
    <div className="dash-gantt">
      <div className="dash-gantt-axis" aria-hidden="true">
        {months.map((m, i) => (i % 2 === 0 ? <span key={m} style={{ left: pct(m) }}>{monthLabel(base, m).slice(2)}</span> : null))}
      </div>
      <div className="dash-gantt-track" ref={trackRef}>
        <div className="dash-gantt-row">
          <span className="dash-gantt-label">준설</span>
          {schedule.storageMonths > 0 && <div className="dash-gantt-gap" style={{ left: pct(gapStart), width: width(gapStart, gapEnd) }} aria-hidden="true" />}
          <div
            className="dash-gantt-bar dash-gantt-bar--dredge"
            style={{ left: pct(schedule.dredgeStart), width: width(schedule.dredgeStart, schedule.dredgeEnd) }}
            tabIndex={0}
            role="slider"
            aria-label="준설 일정 이동(개월)"
            aria-valuenow={shift}
            aria-valuetext={`${monthRange(base, schedule.dredgeStart, schedule.dredgeEnd)}${shift ? ` (원 일정 대비 ${shift > 0 ? "+" : "−"}${Math.abs(shift)}개월)` : ""}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onKeyDown={onKey}
          >
            ⇄ {monthRange(base, schedule.dredgeStart, schedule.dredgeEnd)}
          </div>
        </div>
        <div className="dash-gantt-row">
          <span className="dash-gantt-label">복원</span>
          {schedule.storageMonths > 0 && <div className="dash-gantt-gap" style={{ left: pct(gapStart), width: width(gapStart, gapEnd) }} aria-hidden="true" />}
          <div className="dash-gantt-bar dash-gantt-bar--restore" style={{ left: pct(site.needStart), width: width(site.needStart, site.needEnd) }}>
            {monthRange(base, site.needStart, site.needEnd)}
          </div>
        </div>
      </div>
      <div className="dash-gantt-result" data-bad={schedule.storageMonths > 0 || schedule.lateMonths > 0 || undefined}>
        {schedule.lateMonths > 0 ? (
          <strong>일정 불일치: 준설이 복원 종료보다 {schedule.lateMonths}개월 늦게 시작합니다. 일정을 앞당겨 보세요.</strong>
        ) : schedule.storageMonths > 0 ? (
          <strong>임시적치 {schedule.storageMonths}개월 필요 · 예상 적치비 {fmt2(storageCostEok)}억원 ({volumeM3.toLocaleString("ko-KR")} m³ × {schedule.storageMonths}개월 × {params.storagePerM3Month.toLocaleString("ko-KR")}원)</strong>
        ) : (
          <strong>일정 일치 — 임시적치 없이 직송 가능</strong>
        )}
        <span className="dash-muted">준설 막대를 좌우로 드래그하거나 ←/→ 키로 옮겨 보세요{shift !== 0 && <> · 원 일정 대비 {shift > 0 ? "+" : "−"}{Math.abs(shift)}개월 <button type="button" className="dash-link-btn" onClick={() => onShift(0)}>되돌리기</button></>}</span>
      </div>
    </div>
  );
}
