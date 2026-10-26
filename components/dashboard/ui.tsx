"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Info, Inbox, Loader2, X } from "lucide-react";
import { ASSUMPTION_LABEL } from "@/src/config/assumptions";
import { fitLabels, stageLabels, urgencyLabels, useLabels, verificationLabels } from "@/src/domain/format";
import type { Fit, Stage, Urgency, UseKind, Verification } from "@/src/types";

export type Tone = "teal" | "blue" | "gray" | "amber" | "red";

export function Pill({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return <span className="dash-pill" data-tone={tone} title={title}>{children}</span>;
}

const fitTone: Record<Fit, Tone> = { fit: "teal", conditional: "amber", unfit: "red" };
export const FitBadge = ({ fit }: { fit: Fit }) => <Pill tone={fitTone[fit]}>{fitLabels[fit]}</Pill>;

const verTone: Record<Verification, Tone> = { unverified: "gray", "in-review": "amber", verified: "teal" };
export const VerificationBadge = ({ v }: { v: Verification }) => <Pill tone={verTone[v]}>{verificationLabels[v]}</Pill>;

const stageTone: Record<Stage, Tone> = { registered: "gray", quality: "amber", matched: "blue", transport: "blue", placed: "teal" };
export const StageBadge = ({ stage }: { stage: Stage }) => <Pill tone={stageTone[stage]}>{stageLabels[stage]}</Pill>;

const urgencyTone: Record<Urgency, Tone> = { critical: "red", high: "amber", normal: "gray" };
export const UrgencyBadge = ({ u }: { u: Urgency }) => <Pill tone={urgencyTone[u]}>{urgencyLabels[u]}</Pill>;

export const UseBadge = ({ use }: { use: UseKind }) => <span className="dash-use" data-use={use}>{useLabels[use]}</span>;

export function LoadingState({ label = "불러오는 중" }: { label?: string }) {
  return (
    <div className="dash-state" role="status">
      <Loader2 size={22} className="dash-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="dash-state">
      <Inbox size={22} aria-hidden="true" />
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="dash-state" role="alert" data-tone="error">
      <AlertTriangle size={22} aria-hidden="true" />
      <strong>데이터를 불러오지 못했습니다</strong>
      <span>{message}</span>
      <button type="button" className="dash-btn" onClick={onRetry}>다시 시도</button>
    </div>
  );
}

export function AssumptionNote({ children }: { children?: ReactNode }) {
  return <p className="dash-assumption" title={ASSUMPTION_LABEL}>{children ?? "시연용 가정값"} — 법령·고시상 확정 기준이 아닙니다.</p>;
}

/** 우측 슬라이드 패널(퇴적물 여권 등). Esc/바깥 클릭으로 닫힌다. */
export function Drawer({ title, subtitle, onClose, children, wide = false, demoId }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean; demoId?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="dash-drawer-layer">
      <button type="button" className="dash-drawer-backdrop" aria-label="패널 닫기" tabIndex={-1} onClick={onClose} />
      <section className="dash-drawer" data-wide={wide || undefined} data-demo={demoId} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button ref={closeRef} type="button" className="dash-icon-btn" aria-label="닫기" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="dash-drawer-body">{children}</div>
      </section>
    </div>
  );
}

/** 중앙 모달(경제성 시뮬레이터 등) */
export function Modal({ title, subtitle, onClose, children, demoId }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; demoId?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="dash-modal-layer">
      <button type="button" className="dash-drawer-backdrop" aria-label="모달 닫기" tabIndex={-1} onClick={onClose} />
      <section className="dash-modal" role="dialog" aria-modal="true" aria-label={title} data-demo={demoId}>
        <header>
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button ref={closeRef} type="button" className="dash-icon-btn" aria-label="닫기" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="dash-modal-body">{children}</div>
      </section>
    </div>
  );
}

export function DetailList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="dash-detail-list">
      {rows.map(([label, value]) => (<div key={label}><dt>{label}</dt><dd>{value}</dd></div>))}
    </dl>
  );
}

/** ⓘ — 누르면 계산식이 실제 값과 함께 펼쳐진다 */
export function Formula({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span className="dash-formula" ref={wrap}>
      <button type="button" className="dash-info-btn" aria-label={`${title} 계산식 보기`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <span className="dash-formula-panel" id={id} role="note">
          <strong>{title}</strong>
          {lines.map((line, i) => <span key={i}>{line}</span>)}
        </span>
      )}
    </span>
  );
}

/** 진입 시 0에서 value까지 카운트업 */
export function useCountUp(value: number, durationMs = 900) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setShown(from + (value - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);
  return shown;
}
