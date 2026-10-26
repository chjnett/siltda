"use client";

import { useMemo } from "react";
import { RECOMMEND_WEIGHTS, recommendSites } from "@/src/domain/recommend";
import { fmt1, fmtInt, monthRange, urgencyLabels } from "@/src/domain/format";
import { requiredVolume } from "@/src/domain/shoreline";
import { useStore } from "@/src/state/DealStore";
import { Formula, UrgencyBadge } from "./ui";

const STEPS = [
  ["1", "복원지 선택", "추천 복원지 또는 목록에서 내 복원지를 고릅니다"],
  ["2", "준설토 후보 매칭", "항구별 후보를 품질·일정·거리·물량으로 비교합니다"],
  ["3", "일정·경제성 검토", "일정 비교와 시뮬레이터로 대안을 검토합니다"],
  ["4", "매칭 확정·정산", "공급자와 수요자가 조건에 합의합니다"],
  ["5", "복원 성과(MRV)", "포설 후 해안선·면적 변화를 확인합니다"],
] as const;

/** 연안 복원 후보 화면 상단: 진행 순서 안내와 추천 복원지 */
export default function SiteRecommend() {
  const { state, selectSite } = useStore();
  const { data, base } = state;
  const recs = useMemo(() => recommendSites(data), [data]);
  const w = RECOMMEND_WEIGHTS;

  return (
    <section className="dash-card dash-recommend" aria-label="복원지 추천과 진행 순서">
      <header className="dash-card-head">
        <div><h2>복원지 추천</h2><p>시급성·해안선 후퇴 속도·미확보 토량·공급 가능 항구를 합산한 순위입니다 (점수 기준은 시연용 가정값)
          <Formula title="추천 점수" lines={[
            `= 시급성(매우 시급 ${w.urgency.critical} · 시급 ${w.urgency.high} · 보통 ${w.urgency.normal})`,
            `+ 후퇴 속도(최근 3년 평균 m/년 × ${w.retreatPerM}, 최대 ${w.retreatMax})`,
            `+ 미확보 토량 비율 × ${w.unmetMax}`,
            `+ 품질·일정이 맞는 후보 항구 수(최대 3곳) × ${w.supplyPerPort.toFixed(1)}`,
            "최대 100점. 가중치는 시연용 가정값이며 정책 기준이 아닙니다.",
          ]} />
        </p></div>
      </header>

      <ol className="dash-rec-list">
        {recs.slice(0, 3).map((r, i) => (
          <li key={r.site.id} className="dash-rec-card" data-selected={state.selectedSiteId === r.site.id || undefined}>
            <span className="dash-rec-rank">추천 {i + 1}</span>
            <b>{r.site.name}</b>
            <span className="dash-muted">{r.site.region} · <UrgencyBadge u={r.site.urgency} /></span>
            <dl>
              <div><dt>점수</dt><dd>{fmt1(r.score)}점</dd></div>
              <div><dt>필요 토량</dt><dd>{fmtInt(requiredVolume(r.site))} m³</dd></div>
              <div><dt>필요 시기</dt><dd>{monthRange(base, r.site.needStart, r.site.needEnd)}</dd></div>
              <div><dt>후퇴 속도</dt><dd>{fmt1(r.retreatRate)} m/년</dd></div>
              <div><dt>맞는 후보 항구</dt><dd>{r.fitPorts}곳</dd></div>
            </dl>
            <p className="dash-muted">긴급도 {urgencyLabels[r.site.urgency]} {r.parts.urgency}점 + 후퇴 {fmt1(r.parts.retreat)} + 미확보 {fmt1(r.parts.unmet)} + 공급 {fmt1(r.parts.supply)}</p>
            <button type="button" className="dash-btn dash-btn-primary" onClick={() => selectSite(r.site.id)} aria-pressed={state.selectedSiteId === r.site.id}>
              {state.selectedSiteId === r.site.id ? "선택됨" : "이 복원지로 진행"}
            </button>
          </li>
        ))}
      </ol>

      <ol className="dash-steps" aria-label="복원지를 고른 뒤 진행되는 과정">
        {STEPS.map(([n, title, desc]) => (
          <li key={n}><span>{n}</span><b>{title}</b><small>{desc}</small></li>
        ))}
      </ol>
    </section>
  );
}
