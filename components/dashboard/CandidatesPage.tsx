"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { USE_CRITERIA } from "@/src/config/assumptions";
import { fmt1, fmtInt, fmtPct, fmtSigned, monthLabel, monthRange, urgencyLabels, useLabels } from "@/src/domain/format";
import { rankCandidates, securedVolumeOfSite } from "@/src/domain/matching";
import { requiredVolume, retreatAt, yearRange } from "@/src/domain/shoreline";
import { useStore } from "@/src/state/DealStore";
import CandidatePanel from "./CandidatePanel";
import ErosionRiskLine from "./ErosionRiskLine";
import FeasibilityModal from "./FeasibilityModal";
import MrvPanel from "./MrvPanel";
import SatelliteMap, { type RouteLine } from "./SatelliteMap";
import ScheduleGantt from "./ScheduleGantt";
import SiteRecommend from "./SiteRecommend";
import WeekWeather from "./WeekWeather";
import { Donut } from "./charts";
import { DetailList, Formula, Pill, UrgencyBadge } from "./ui";

export default function CandidatesPage() {
  const { state, selectSite, selectListing, openPassport, setSimulatorOpen } = useStore();
  const { data, base } = state;
  const site = data.sites.find((s) => s.id === state.selectedSiteId) ?? data.sites[0];

  const [tab, setTab] = useState<"match" | "mrv">("match");
  const [shifts, setShifts] = useState<Record<string, number>>({});
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const ganttRef = useRef<HTMLElement>(null);

  const [y0, y1] = yearRange(site);
  const [year, setYear] = useState(y1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setYear(yearRange(site)[1]); setPlaying(false); }, [site]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setYear((y) => {
        if (y >= y1) { setPlaying(false); return y1; }
        return Math.min(y1, +(y + 0.1).toFixed(2));
      });
    }, 90);
    return () => clearInterval(timer);
  }, [playing, y1]);
  const togglePlay = () => { if (!playing && year >= y1) setYear(y0); setPlaying((p) => !p); };

  const shiftOf = useCallback((id: string) => shifts[id] ?? 0, [shifts]);
  const candidates = useMemo(() => rankCandidates(site, data.listings, data.ports, data.deals, { shiftOf }), [site, data, shiftOf]);
  const selected = candidates.find((c) => c.listing.id === state.selectedListingId) ?? candidates.find((c) => !c.unfit) ?? candidates[0] ?? null;

  const required = requiredVolume(site);
  const secured = securedVolumeOfSite(site.id, data.deals);
  const fulfil = required > 0 ? (secured / required) * 100 : null;
  const siteDeals = data.deals.filter((d) => d.siteId === site.id);
  const routes = useMemo<RouteLine[]>(
    () => siteDeals.flatMap((d) => {
      const l = data.listings.find((x) => x.id === d.listingId);
      const p = l && data.ports.find((x) => x.id === l.portId);
      return p ? [{ id: d.id, from: p.coordinate, to: site.coordinate }] : [];
    }),
    [siteDeals, data, site],
  );
  const mapPorts = useMemo(() => {
    const ids = new Set(candidates.filter((c) => !c.unfit).map((c) => c.port.id));
    return data.ports.filter((p) => ids.has(p.id));
  }, [candidates, data.ports]);

  // 착공 가능 예상일 = (확보 완료 시) 매칭 매물 중 가장 늦은 준설 종료 + 1개월(운송), 복원 시작 이전이면 복원 시작월
  const startEstimate = useMemo(() => {
    if (siteDeals.length === 0) return { text: "매칭 후 산정", lines: ["매칭된 매물이 없어 산정할 수 없습니다."] };
    const lastDredge = Math.max(...siteDeals.map((d) => data.listings.find((l) => l.id === d.listingId)?.dredgeEnd ?? 0));
    const month = Math.max(site.needStart, lastDredge + 1);
    const text = fulfil !== null && fulfil >= 99.5 ? monthLabel(base, month) : `${monthLabel(base, month)} (물량 ${fmtPct(fulfil ?? 0)} 확보)`;
    return { text, lines: [`착공 가능 월 = max(복원 필요 시작월 ${monthLabel(base, site.needStart)}, 매칭 매물 중 가장 늦은 준설 종료월 ${monthLabel(base, lastDredge)} + 운송 1개월) = ${monthLabel(base, month)}`, fulfil !== null && fulfil < 99.5 ? `필요 토량의 ${fmtPct(fulfil)}만 확보되어 잔여 ${fmtInt(required - secured)} m³ 추가 확보가 필요합니다.` : "필요 토량을 모두 확보했습니다."] };
  }, [siteDeals, data.listings, site, base, fulfil, required, secured]);

  const sample = data.sites.find((s) => s.status === "completed") ?? null;
  const [confirmedPulse, setConfirmedPulse] = useState(false);
  const handleConfirmed = useCallback(() => {
    setSimulatorOpen(false);
    setFocusToken((n) => n + 1);
    setConfirmedPulse(true);
  }, [setSimulatorOpen]);
  useEffect(() => { if (confirmedPulse) { const t = setTimeout(() => setConfirmedPulse(false), 6000); return () => clearTimeout(t); } }, [confirmedPulse]);

  const req = site.use === "beach"
    ? `${useLabels.beach}: 실트·점토 ≤ ${site.requirement.maxFinesPct}%, 중앙입경 ${site.requirement.medianMm[0]}–${site.requirement.medianMm[1]} mm, 오염 항목 기준선 이내`
    : `${useLabels.tidal}: 실트·점토 ≥ ${USE_CRITERIA.tidal.minFinesPct}%, 오염 항목 기준선 이내`;

  const retreat = retreatAt(site, year) - retreatAt(site, y0);

  return (
    <div className="dash-candidates">
      <SiteRecommend />

      <div className="dash-site-pick">
        <h2 className="dash-site-pick-title">내 복원지 선택하기</h2>
        <p className="dash-muted">추천 복원지 또는 아래 목록에서 복원지를 고르면, 선택한 복원지 기준으로 아래 매칭·일정·경제성 단계가 진행됩니다.</p>
      <div className="dash-site-tabs" role="tablist" aria-label="내 복원지 선택" data-demo="site-tabs">
        {data.sites.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === site.id} className="dash-chip" data-active={s.id === site.id || undefined} onClick={() => { selectSite(s.id); setTab("match"); }}>
            {s.name} {s.status === "completed" ? "· 복원 완료" : ""}
          </button>
        ))}
      </div>
      </div>

      <div className="dash-cand-layout">
        <div className="dash-cand-left">
          <section className="dash-card" aria-label="위성 지도" data-demo="sat-map">
            <header className="dash-card-head">
              <div><h2>{site.name} — {site.region}</h2><p>침식 구역과 수요 신호</p></div>
              <div className="dash-tabs" role="tablist">
                <button role="tab" aria-selected={tab === "match"} className="dash-chip" data-active={tab === "match" || undefined} onClick={() => setTab("match")}>매칭 지도</button>
                <button role="tab" aria-selected={tab === "mrv"} className="dash-chip" data-active={tab === "mrv" || undefined} onClick={() => setTab("mrv")}>복원 성과(MRV)</button>
              </div>
            </header>
            {tab === "match" ? (
              <>
                <SatelliteMap site={site} year={year} ports={mapPorts} hoveredPortId={hoveredPort} routes={routes} focusRoutesToken={focusToken} />
                <div className="dash-scrubber" data-demo="scrubber">
                  <button type="button" className="dash-icon-btn" onClick={togglePlay} aria-label={playing ? "해안선 재생 정지" : "해안선 후퇴 재생"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
                  <input type="range" min={y0} max={y1} step={0.1} value={year} onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }} aria-label="연도 타임라인" />
                  <span className="dash-scrubber-label"><b>{Math.floor(year)}년</b> · 기준({y0}) 대비 해안선 후퇴 {fmt1(retreat)} m</span>
                </div>
                {confirmedPulse && <p className="dash-confirmed-banner" role="status">매칭 확정 — 지도에 운송 경로(파란 점선 애니메이션)를 표시했습니다.</p>}
              </>
            ) : (
              <MrvPanel site={site} sample={sample} />
            )}
          </section>

          <section className="dash-card" aria-label="수요 신호">
            <header className="dash-card-head">
              <div><h2>수요 신호</h2><p>지자체 복원 수요가 탐지·등록된 근거</p></div>
              <UrgencyBadge u={site.urgency} />
            </header>
            <DetailList rows={[
              ["탐지 근거", <span key="d" className="dash-pill-row">{site.detection.map((d) => <Pill key={d} tone="blue">{d}</Pill>)}</span>],
              ["필요 토량", <span key="v">{fmtInt(required)} m³ <Formula title="필요 토량" lines={[
                `필요 토량 = 침식 면적 ${fmtInt(site.areaM2)}㎡ × 복원 두께 ${site.thicknessM}m × 손실 보정 ${site.lossFactor}`,
                `= ${fmtInt(required)} m³`,
              ]} /></span>],
              ["필요 시기", monthRange(base, site.needStart, site.needEnd)],
              ["요구 품질", req],
              ["긴급도", urgencyLabels[site.urgency]],
              ["침식 위험등급(ML)", <ErosionRiskLine key="r" studioCandidateId={site.studioCandidateId} />],
            ]} />
            <p className="dash-muted">침식 면적·두께·손실 보정·탐지 근거는 시연용 가정입니다.</p>
          </section>
        </div>

        <aside className="dash-card dash-cand-right" aria-label="항구별 준설토 후보" data-demo="cand-panel">
          <header className="dash-card-head">
            <div><h2>항구별 준설토 후보</h2><p>적합도 점수순 · 품질 부적합은 하단(회색)</p></div>
          </header>
          <CandidatePanel
            candidates={candidates}
            selectedId={selected?.listing.id ?? null}
            onSelect={selectListing}
            onHover={setHoveredPort}
            onPassport={() => selected && openPassport(selected.listing.id)}
            onSimulate={() => setSimulatorOpen(true)}
            onSchedule={() => ganttRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          />
        </aside>
      </div>

      <section className="dash-card" ref={ganttRef} aria-label="일정 비교" data-demo="gantt">
        <header className="dash-card-head">
          <div><h2>일정 비교</h2><p>{selected ? `${selected.port.name} · ${selected.listing.project}` : "후보를 선택하세요"} vs {site.name} 복원 사업</p></div>
        </header>
        {selected ? (
          <ScheduleGantt listing={selected.listing} site={site} base={base} shift={shiftOf(selected.listing.id)} schedule={selected.schedule} volumeM3={selected.useVolumeM3} onShift={(m) => setShifts((s) => ({ ...s, [selected.listing.id]: m }))} />
        ) : <p className="dash-muted">비교할 후보가 없습니다.</p>}
      </section>

      <div className="dash-cand-bottom">
        <section className="dash-card" aria-label="후보지 KPI">
          <header className="dash-card-head"><div><h2>{site.name} KPI</h2><p>이 후보지 기준</p></div></header>
          <div className="dash-kpi-grid">
            <div className="dash-kpi"><p className="dash-kpi-label">필요 토량 <Formula title="필요 토량" lines={[`침식 면적 ${fmtInt(site.areaM2)}㎡ × ${site.thicknessM}m × ${site.lossFactor} = ${fmtInt(required)} m³`]} /></p><p className="dash-kpi-value">{fmtInt(required)}<small> m³</small></p></div>
            <div className="dash-kpi"><p className="dash-kpi-label">확보 토량 <Formula title="확보 토량" lines={siteDeals.length ? [...siteDeals.map((d) => `${d.id}: ${fmtInt(d.volumeM3)} m³`), `합계 ${fmtInt(secured)} m³`] : ["매칭 확정된 거래가 없습니다."]} /></p><p className="dash-kpi-value">{fmtInt(secured)}<small> m³</small></p></div>
            <div className="dash-kpi"><p className="dash-kpi-label">충족률 <Formula title="충족률" lines={[`확보 ${fmtInt(secured)} ÷ 필요 ${fmtInt(required)} × 100 = ${fulfil === null ? "계산 불가" : fmtPct(fulfil)}`, `부족(−) ${fmtSigned(secured - required, " m³")}`]} /></p>
              <div className="dash-kpi-donut"><Donut pct={fulfil} label="충족률" size={72} /><span className="dash-muted">잔여 {fmtSigned(secured - required, " m³")}</span></div></div>
            <div className="dash-kpi"><p className="dash-kpi-label">착공 가능 예상일 <Formula title="착공 가능 예상일" lines={startEstimate.lines} /></p><p className="dash-kpi-value dash-kpi-value--sm">{startEstimate.text}</p></div>
          </div>
        </section>
        <section className="dash-card" aria-label="일주일 해상기상">
          <header className="dash-card-head"><div><h2>일주일 해상기상</h2><p>{site.name} 기준</p></div></header>
          <WeekWeather id={`site:${site.id}`} name={site.name} coordinate={site.coordinate} />
        </section>
      </div>

      {state.simulatorOpen && selected && !selected.unfit && (
        <FeasibilityModal
          listing={selected.listing} port={selected.port} site={site} volumeM3={selected.useVolumeM3}
          shift={shiftOf(selected.listing.id)} base={base} onClose={() => setSimulatorOpen(false)} onConfirmed={handleConfirmed}
        />
      )}
    </div>
  );
}
