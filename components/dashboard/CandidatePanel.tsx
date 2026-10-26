"use client";

import { useState } from "react";
import { CalendarRange, FileCheck2, Scale } from "lucide-react";
import { MATCH_WEIGHTS } from "@/src/config/assumptions";
import { fmt1, fmtInt, fmtSignedEok } from "@/src/domain/format";
import type { Candidate } from "@/src/domain/matching";
import { FitBadge, Pill, VerificationBadge } from "./ui";

interface Props {
  candidates: Candidate[];
  selectedId: string | null;
  onSelect: (listingId: string) => void;
  onHover: (portId: string | null) => void;
  onPassport: () => void;
  onSimulate: () => void;
  onSchedule: () => void;
}

export default function CandidatePanel({ candidates, selectedId, onSelect, onHover, onPassport, onSimulate, onSchedule }: Props) {
  const [scoreOpen, setScoreOpen] = useState<string | null>(null);
  const selected = candidates.find((c) => c.listing.id === selectedId) ?? null;

  return (
    <div className="dash-cands">
      <ul className="dash-cand-list" aria-label="항구별 준설토 후보 목록(적합도 점수순)">
        {candidates.map((c) => {
          const isSel = c.listing.id === selectedId;
          const open = scoreOpen === c.listing.id;
          return (
            <li key={c.listing.id} className="dash-cand" data-selected={isSel || undefined} data-unfit={c.unfit || undefined} onMouseEnter={() => onHover(c.port.id)} onMouseLeave={() => onHover(null)}>
              <button type="button" className="dash-cand-main" onClick={() => onSelect(c.listing.id)} aria-pressed={isSel} onFocus={() => onHover(c.port.id)} onBlur={() => onHover(null)}>
                <span className="dash-cand-head">
                  <b className="dash-mono">{c.listing.id}</b>
                  <VerificationBadge v={c.listing.verification} />
                  {c.unfit ? <Pill tone="red">품질 부적합</Pill> : <span className="dash-cand-score" title="적합도 점수">{c.total}<small>점</small></span>}
                </span>
                <strong>{c.port.name} · {c.listing.project}</strong>
                <span className="dash-cand-grid">
                  <span>공급 가능 <b>{fmtInt(c.availableM3)} m³</b></span>
                  <span>거리 <b>{fmt1(c.km)} km</b></span>
                  <span>일정 정합도 <b>{c.schedule.score}</b></span>
                  <span>품질 적합도 <b>{c.qualityScore}</b></span>
                  <span className="dash-cand-net" data-neg={c.netEok <= 0 || undefined}>예상 순편익 <b>{fmtSignedEok(c.netEok)}</b></span>
                </span>
                <span className="dash-cover" role="img" aria-label={`충당 비율 ${Math.round(c.coverage * 100)}%`}>
                  <span style={{ width: `${Math.round(c.coverage * 100)}%` }} />
                  <em>충당 {Math.round(c.coverage * 100)}%</em>
                </span>
              </button>
              {c.unfit && <p className="dash-cand-reason">부적합 사유: {c.judgement.reasons.join(" · ")}</p>}
              {!c.unfit && c.schedule.storageMonths > 0 && <p className="dash-cand-note">일정 불일치 — 임시적치 {c.schedule.storageMonths}개월 필요</p>}
              {!c.unfit && c.schedule.lateMonths > 0 && <p className="dash-cand-reason">일정 불일치 — 준설이 복원 종료 {c.schedule.lateMonths}개월 뒤 시작</p>}
              <button type="button" className="dash-link-btn" onClick={() => setScoreOpen(open ? null : c.listing.id)} aria-expanded={open}>
                <Scale size={12} aria-hidden="true" /> 점수 계산 보기
              </button>
              {open && (
                <div className="dash-score-box">
                  <Row label="품질 적합" score={c.qualityScore} weight={MATCH_WEIGHTS.quality} note={`판정: ${c.judgement.fit === "fit" ? "적합" : c.judgement.fit === "conditional" ? "조건부" : "부적합"}`} />
                  <Row label="일정 정합" score={c.schedule.score} weight={MATCH_WEIGHTS.schedule} note={`적치 ${c.schedule.storageMonths}개월`} />
                  <Row label="거리" score={c.distanceScore} weight={MATCH_WEIGHTS.distance} note={`${fmt1(c.km)} km`} />
                  <Row label="물량" score={c.volumeScore} weight={MATCH_WEIGHTS.volume} note={`충당 ${Math.round(c.coverage * 100)}%`} />
                  <p>총점 = 품질 {c.qualityScore}×{MATCH_WEIGHTS.quality} + 일정 {c.schedule.score}×{MATCH_WEIGHTS.schedule} + 거리 {c.distanceScore}×{MATCH_WEIGHTS.distance} + 물량 {c.volumeScore}×{MATCH_WEIGHTS.volume} = <b>{c.total}점</b></p>
                  <p className="dash-muted">가중치는 시연용 가정값입니다. 거리는 직선거리 기준입니다.</p>
                </div>
              )}
              {c.judgement.fit !== "unfit" && <FitBadge fit={c.judgement.fit} />}
            </li>
          );
        })}
        {candidates.length === 0 && <li className="dash-muted">표시할 후보 매물이 없습니다.</li>}
      </ul>
      <div className="dash-cand-actions" data-demo="cand-actions">
        <button type="button" className="dash-btn dash-btn-primary dash-btn-block" onClick={onSimulate} disabled={!selected || selected.unfit} title={selected?.unfit ? "품질 부적합 매물은 평가할 수 없습니다" : undefined}>
          활용 타당성 평가 및 매칭 요청
        </button>
        <div className="dash-cand-actions-sub">
          <button type="button" className="dash-btn" onClick={onPassport} disabled={!selected}><FileCheck2 size={14} aria-hidden="true" /> 퇴적물 여권 보기</button>
          <button type="button" className="dash-btn" onClick={onSchedule} disabled={!selected}><CalendarRange size={14} aria-hidden="true" /> 일정 비교</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, score, weight, note }: { label: string; score: number; weight: number; note: string }) {
  return (
    <div className="dash-score-row">
      <span>{label} <small>({note})</small></span>
      <span className="dash-score-bar"><i style={{ width: `${score}%` }} /></span>
      <b>{score}</b>
      <small>×{weight}</small>
    </div>
  );
}
