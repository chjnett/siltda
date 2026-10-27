"use client";

import { useState } from "react";
import { fmtInt, fmtSigned } from "@/src/domain/format";
import type { Site } from "@/src/types";
import { Pill } from "./ui";

/** 복원 성과(MRV): 전/후 스와이프 + 모니터링 시점별 변화량. 복원 전 후보지는 완료 사례(시연 데이터)를 보여준다. */
export default function MrvPanel({ site, sample }: { site: Site; sample: Site | null }) {
  const source = site.status === "completed" ? site : sample;
  const [pos, setPos] = useState(50);
  const [snapIdx, setSnapIdx] = useState(0);
  if (!source) return <p className="dash-muted">완료된 복원 사례가 없습니다.</p>;
  const isSample = source.id !== site.id;
  const snap = source.mrv[Math.min(snapIdx, source.mrv.length - 1)];

  return (
    <div className="dash-mrv" data-demo="mrv">
      {isSample && (
        <p className="dash-demo-notice">'{site.name}'은(는) 복원 전 단계라 성과 데이터가 없습니다. 완료 사례인 '{source.name}'의 <b>시연 데이터</b>로 MRV 화면을 보여 드립니다.</p>
      )}
      <div className="dash-swipe" style={{ ["--pos" as string]: `${pos}%` }}>
        <Scene kind="before" />
        <div className="dash-swipe-after"><Scene kind="after" /></div>
        <span className="dash-swipe-tag dash-swipe-tag--l">복원 전</span>
        <span className="dash-swipe-tag dash-swipe-tag--r">복원 후</span>
        <span className="dash-swipe-handle" aria-hidden="true" />
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="복원 전후 비교 슬라이더" />
      </div>
      <p className="dash-muted">모식도(시연용): 실제 위성·드론 영상이 아닙니다. 슬라이더를 움직여 전/후를 비교합니다.</p>

      <div className="dash-mrv-tabs" role="tablist" aria-label="모니터링 시점">
        {source.mrv.map((m, i) => (
          <button key={m.label} role="tab" aria-selected={i === snapIdx} className="dash-chip" data-active={i === snapIdx || undefined} onClick={() => setSnapIdx(i)}>{m.label}</button>
        ))}
      </div>
      {snap && (
        <div className="dash-mrv-cards">
          <div><span>해안선 변화량</span><b>{fmtSigned(snap.shorelineChangeM, " m")}</b></div>
          <div><span>백사장 면적 변화</span><b>{fmtSigned(snap.areaChangeM2, " ㎡")}</b></div>
          <div><span>지형(모래 체적) 변화</span><b>{fmtSigned(snap.volumeChangeM3, " m³")}</b></div>
          <div><span>기준 포설량 대비 잔존</span><b>{fmtInt((snap.volumeChangeM3 / source.mrv[0].volumeChangeM3) * 100)}%</b></div>
        </div>
      )}
      <div className="dash-mrv-ext" aria-label="확장 예정">
        <Pill tone="gray">확장 예정</Pill>
        <button type="button" disabled>블루카본 연계</button>
        <button type="button" disabled>복원 크레딧 연계</button>
      </div>
    </div>
  );
}

function Scene({ kind }: { kind: "before" | "after" }) {
  const sandTop = kind === "before" ? 128 : 96;
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="dash-scene" aria-hidden="true">
      <rect width="400" height="200" fill="#0E3A46" />
      <path d={`M0 ${sandTop - 10} Q100 ${sandTop - 24} 200 ${sandTop - 10} T400 ${sandTop - 12} V200 H0Z`} fill="#A8956A" />
      <path d={`M0 ${sandTop + 34} Q100 ${sandTop + 20} 200 ${sandTop + 34} T400 ${sandTop + 30} V200 H0Z`} fill="#4D6B44" />
      {kind === "before" && <path d="M0 106 Q100 92 200 106 T400 104 L400 118 Q300 120 200 118 T0 120Z" fill="#ef4444" opacity=".35" />}
      <path d={`M0 ${sandTop - 10} Q100 ${sandTop - 24} 200 ${sandTop - 10} T400 ${sandTop - 12}`} fill="none" stroke="#22d3ee" strokeWidth="3" />
    </svg>
  );
}
