"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDashed, Clock3 } from "lucide-react";
import { ASSUMPTION_LABEL, CONTAMINANTS, USE_CRITERIA } from "@/src/config/assumptions";
import { fmt1, fmtInt, fmtM3, monthLabel, monthRange, stageLabels, useLabels } from "@/src/domain/format";
import { topSitesForListing } from "@/src/domain/matching";
import { requiredVolume } from "@/src/domain/shoreline";
import { judgeAll, finesPct, suitableUses } from "@/src/domain/suitability";
import { useStore } from "@/src/state/DealStore";
import type { Listing, Port } from "@/src/types";
import { Gauge } from "./charts";
import { DetailList, Drawer, FitBadge, StageBadge, UseBadge, VerificationBadge } from "./ui";
import { useLeaflet } from "./useLeaflet";

/** 퇴적물 여권 — 어느 화면에서든 store.passportId가 있으면 열린다. */
export default function PassportDrawer() {
  const { state, openPassport } = useStore();
  const listing = state.data.listings.find((l) => l.id === state.passportId);
  const port = listing && state.data.ports.find((p) => p.id === listing.portId);
  if (!listing || !port) return null;
  return <Passport listing={listing} port={port} onClose={() => openPassport(null)} />;
}

function MiniMap({ port }: { port: Port }) {
  const ref = useRef<HTMLDivElement>(null);
  const { ready, mapRef, leafletRef } = useLeaflet(ref, { center: [port.coordinate[1], port.coordinate[0]], zoom: 9, tile: "osm", minZoom: 4 });
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    const marker = L.circleMarker([port.coordinate[1], port.coordinate[0]], { radius: 8, color: "#fff", weight: 2, fillColor: "#3358f4", fillOpacity: 1 }).addTo(map);
    return () => { marker.remove(); };
  }, [ready, port, leafletRef, mapRef]);
  return <div ref={ref} className="dash-minimap" role="img" aria-label={`${port.name} 발생지 위치`} />;
}

function Passport({ listing, port, onClose }: { listing: Listing; port: Port; onClose: () => void }) {
  const router = useRouter();
  const { state, selectListing, selectSite } = useStore();
  const { data, base } = state;
  const q = listing.quality;
  const judgements = judgeAll(q);
  const uses = suitableUses(q);
  const tops = topSitesForListing(listing, data.sites, data.ports, data.deals, 3);
  const deals = data.deals.filter((d) => d.listingId === listing.id);
  const fines = finesPct(q);
  const limit = (key: string) => CONTAMINANTS.find((c) => c.key === key)!;

  const goSite = (siteId: string) => {
    selectListing(listing.id);
    selectSite(siteId);
    onClose();
    router.push("/dashboard/candidates");
  };

  return (
    <Drawer title={`퇴적물 여권 · ${listing.id}`} subtitle={`${port.name} · ${listing.project}`} onClose={onClose} wide demoId="passport">
      <section className="dash-pp-section">
        <h3>기본 정보</h3>
        <MiniMap port={port} />
        <DetailList rows={[
          ["발생지", `${port.region} ${port.name}`],
          ["준설 주체", listing.contractor],
          ["예정 물량", fmtM3(listing.volumeM3)],
          ["예정 시기", monthRange(base, listing.dredgeStart, listing.dredgeEnd)],
          ["진행 단계", <StageBadge key="s" stage={listing.stage} />],
          ["검증 상태", <VerificationBadge key="v" v={listing.verification} />],
          ["적합 용도", <span key="u" className="dash-pill-row">{uses.map((u) => <UseBadge key={u} use={u} />)}</span>],
        ]} />
      </section>

      <section className="dash-pp-section">
        <h3>품질 항목 <small>(기준선: {ASSUMPTION_LABEL})</small></h3>
        <div className="dash-grain" aria-label="입도 분포">
          <div className="dash-grain-bar" role="img" aria-label={`모래 ${q.sandPct}%, 실트 ${q.siltPct}%, 점토 ${q.clayPct}%`}>
            <span style={{ width: `${q.sandPct}%`, background: "#f1c27d" }}>모래 {q.sandPct}%</span>
            <span style={{ width: `${q.siltPct}%`, background: "#94a3b8" }}>실트 {q.siltPct}%</span>
            <span style={{ width: `${q.clayPct}%`, background: "#64748b" }}>점토 {q.clayPct}%</span>
          </div>
          <small className="dash-muted">입도 분포 · 중앙입경 {q.medianMm} mm · 실트·점토 합 {fines}%</small>
        </div>
        <Gauge label="실트·점토 비율" value={fines} unit="%" max={100} status={fines <= USE_CRITERIA.beach.maxFinesPct ? "ok" : fines <= USE_CRITERIA.beach.conditionalFinesPct ? "caution" : "bad"}
          markers={[{ label: "양빈 ≤", value: USE_CRITERIA.beach.maxFinesPct }, { label: "갯벌 ≥", value: USE_CRITERIA.tidal.minFinesPct }]} />
        <Gauge label="염분" value={q.salinityPsu} unit=" psu" max={50} status={q.salinityPsu <= USE_CRITERIA.beach.maxSalinityPsu ? "ok" : "caution"}
          markers={[{ label: "양빈", value: USE_CRITERIA.beach.maxSalinityPsu }, { label: "갯벌", value: USE_CRITERIA.tidal.maxSalinityPsu }, { label: "매립", value: USE_CRITERIA.reclamation.maxSalinityPsu }]} />
        {q.contaminants.map((c) => {
          const l = limit(c.key);
          const ratio = c.value / l.limit;
          return (
            <Gauge key={c.key} label={`${l.label} 오염도`} value={c.value} unit={` ${l.unit}`} max={l.limit * 2} status={ratio <= 1 ? "ok" : ratio <= 1.25 ? "caution" : "bad"}
              markers={[{ label: "양빈·갯벌", value: l.limit }, { label: "매립", value: l.limit * USE_CRITERIA.reclamation.contaminantFactor }]} />
          );
        })}
      </section>

      <section className="dash-pp-section" data-demo="use-judgement">
        <h3>용도 적합성 판정</h3>
        <ul className="dash-judge">
          {judgements.map((j) => (
            <li key={j.use} data-fit={j.fit}>
              <header><b>{useLabels[j.use]}</b><FitBadge fit={j.fit} /></header>
              <ul>{j.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-pp-section">
        <h3>인허가·환경검증 체크리스트</h3>
        <ul className="dash-checklist">
          {listing.permits.map((p) => (
            <li key={p.label} data-status={p.status}>
              {p.status === "done" ? <Check size={15} aria-hidden="true" /> : p.status === "progress" ? <Clock3 size={15} aria-hidden="true" /> : <CircleDashed size={15} aria-hidden="true" />}
              <span>{p.label}</span>
              <em>{p.status === "done" ? "완료" : p.status === "progress" ? "진행" : "미착수"}</em>
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-pp-section">
        <h3>이동 이력</h3>
        <ol className="dash-history">
          {listing.movements.map((m) => {
            const label = { dredge: "준설", stockpile: "임시적치", transport: "운송", placement: "포설" }[m.phase];
            const placeText = m.phase === "placement" && deals.length ? deals.map((d) => data.sites.find((s) => s.id === d.siteId)?.name).filter(Boolean).join(", ") : m.place;
            const done = m.monthOffset <= 0 || (m.phase !== "placement" && listing.stage === "placed");
            return (
              <li key={m.phase} data-done={done || undefined}>
                <b>{label}</b>
                <span>{placeText}</span>
                <span className="dash-muted">{monthLabel(base, m.monthOffset)} · {fmtInt(m.volumeM3)} m³ · {done ? "완료" : "예정"}</span>
              </li>
            );
          })}
        </ol>
        <p className="dash-muted">현재 단계: {stageLabels[listing.stage]}. 일정은 시연 기준월에서 환산한 값입니다.</p>
      </section>

      <section className="dash-pp-section" data-demo="top3">
        <h3>이 매물에 맞는 복원 후보 Top 3</h3>
        {tops.length === 0 && <p className="dash-muted">품질·일정 조건을 통과하는 후보지가 없습니다.</p>}
        <ol className="dash-top3">
          {tops.map(({ site, candidate }, i) => (
            <li key={site.id}>
              <button type="button" onClick={() => goSite(site.id)}>
                <b>{i + 1}. {site.name}</b>
                <span>적합도 {candidate.total}점 · {fmt1(candidate.km)} km · 필요 {fmtInt(requiredVolume(site))} m³</span>
                <FitBadge fit={candidate.judgement.fit} />
              </button>
            </li>
          ))}
        </ol>
      </section>
    </Drawer>
  );
}
