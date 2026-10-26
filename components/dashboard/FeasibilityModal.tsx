"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ASSUMPTION_LABEL, DEFAULT_COSTS } from "@/src/config/assumptions";
import { bestAlternative, evaluateAlternatives, settle, type CostParams } from "@/src/domain/economics";
import { fmt1, fmt2, fmtInt, fmtSignedEok, monthRange, type BaseMonth } from "@/src/domain/format";
import { checkSchedule } from "@/src/domain/matching";
import type { Listing, Port, Site } from "@/src/types";
import { distanceKm } from "@/src/domain/geo";
import { useStore } from "@/src/state/DealStore";
import { Waterfall } from "./charts";
import { Formula, Modal, Pill } from "./ui";

interface Props {
  listing: Listing;
  port: Port;
  site: Site;
  /** 매칭 가능한 최대 물량(m³) */
  volumeM3: number;
  shift: number;
  base: BaseMonth;
  onClose: () => void;
  onConfirmed: (dealId: string) => void;
}

const costFields: Array<{ key: keyof CostParams; label: string; unit: string; step: number }> = [
  { key: "transportPerM3Km", label: "운송 단가", unit: "원/m³·km", step: 5 },
  { key: "sandPurchasePerM3", label: "모래 구매 단가", unit: "원/m³", step: 500 },
  { key: "disposalPerM3", label: "처분비(회피 대상)", unit: "원/m³", step: 500 },
  { key: "storagePerM3Month", label: "임시적치 단가", unit: "원/m³·월", step: 100 },
];

export default function FeasibilityModal({ listing, port, site, volumeM3: volumeProp, shift, base, onClose, onConfirmed }: Props) {
  // 확정 중 가용 물량이 줄어들어도 화면 수치가 흔들리지 않도록 열릴 때의 물량을 고정한다.
  const [volumeM3] = useState(volumeProp);
  const { state, confirmDeal } = useStore();
  const [params, setParams] = useState<CostParams>({ ...DEFAULT_COSTS });
  const [share, setShare] = useState(DEFAULT_COSTS.supplierShare);
  const [chosen, setChosen] = useState<"A" | "B" | "C" | null>(null);
  const [dealId, setDealId] = useState<string | null>(null);

  const km = distanceKm(port.coordinate, site.coordinate);
  const schedule = useMemo(() => checkSchedule(listing, site, shift), [listing, site, shift]);
  const alts = useMemo(() => evaluateAlternatives({ volumeM3, distanceKm: km, storageMonths: schedule.storageMonths, lateMonths: schedule.lateMonths, params }), [volumeM3, km, schedule, params]);
  const best = bestAlternative(alts);
  const selected = alts.find((a) => a.id === (chosen ?? best?.id)) ?? null;
  const confirmable = !!selected && selected.id !== "D" && selected.recommended && !dealId;
  const settlement = selected ? settle(selected, share) : null;

  const confirming = state.confirming;
  const progress = dealId ? (confirming?.dealId === dealId ? confirming.pct : 100) : 0;
  useEffect(() => {
    if (dealId && !confirming) onConfirmed(dealId);
  }, [dealId, confirming, onConfirmed]);

  const confirm = () => {
    if (!selected || selected.id === "D") return;
    const id = confirmDeal({ listingId: listing.id, siteId: site.id, volumeM3, alternative: selected.id, netBenefitEok: selected.netEok, supplierShare: share });
    setDealId(id);
  };

  return (
    <Modal title="활용 타당성 평가 — 거래 경제성 시뮬레이터" subtitle={`${port.name} · ${listing.project} → ${site.name}`} onClose={onClose} demoId="simulator">
      <div className="dash-sim-summary">
        <span>매칭 물량 <b>{fmtInt(volumeM3)} m³</b></span>
        <span>직선거리 <b>{fmt1(km)} km</b></span>
        <span>준설 <b>{monthRange(base, schedule.dredgeStart, schedule.dredgeEnd)}</b></span>
        <span>복원 <b>{monthRange(base, site.needStart, site.needEnd)}</b></span>
        <span>임시적치 <b>{schedule.storageMonths}개월</b></span>
      </div>

      <fieldset className="dash-sim-inputs" disabled={!!dealId}>
        <legend>입력값(바꾸면 즉시 재계산) — {ASSUMPTION_LABEL}</legend>
        {costFields.map((f) => (
          <label key={f.key}>
            <span>{f.label} <small>({f.unit})</small></span>
            <input
              type="number" min={0} step={f.step} value={params[f.key]}
              onChange={(e) => setParams((p) => ({ ...p, [f.key]: Math.max(0, Number(e.target.value) || 0) }))}
            />
          </label>
        ))}
      </fieldset>

      <div className="dash-alt-grid">
        {alts.map((a) => {
          const isSel = selected?.id === a.id;
          const selectable = a.id !== "D";
          return (
            <div key={a.id} className="dash-alt" data-selected={isSel || undefined} data-bad={(!a.recommended && a.id !== "D") || undefined}>
              <header>
                <label>
                  {selectable && <input type="radio" name="alt" checked={isSel} onChange={() => setChosen(a.id as "A" | "B" | "C")} disabled={!!dealId} />}
                  <b>{a.id}. {a.label}</b>
                </label>
                {a.id === "D" ? <Pill tone="gray">기준선</Pill> : a.recommended ? (best?.id === a.id ? <Pill tone="teal">최적 대안</Pill> : <Pill tone="blue">실행 가능</Pill>) : <Pill tone="red">{a.feasible ? "실행 비권장" : "일정상 불가 · 실행 비권장"}</Pill>}
              </header>
              <p className="dash-muted">{a.description}</p>
              {a.id === "D" && a.baseline ? (
                <div className="dash-baseline">
                  <span>공급자 처분비 지출 <b>{fmt2(a.baseline.disposal)}억원</b></span>
                  <span>수요자 모래 구매비 지출 <b>{fmt2(a.baseline.purchase)}억원</b></span>
                  <small>다른 대안은 이 지출을 줄이는 만큼을 편익으로 계산합니다.</small>
                </div>
              ) : (
                <Waterfall items={a.items} net={a.netEok} muted={!a.recommended} />
              )}
              <div className="dash-alt-net">
                순편익 <b data-neg={a.netEok <= 0 || undefined}>{fmtSignedEok(a.netEok)}</b>
                {a.id !== "D" && (
                  <Formula
                    title={`대안 ${a.id} 순편익`}
                    lines={[
                      `회피 처분비 ${fmt2(a.items.avoidedDisposal)} + 자재 절감 ${fmt2(a.items.materialSaving)}`,
                      `− 운송비 ${fmt2(a.items.transport)} − 품질검사비 ${fmt2(a.items.inspection)} − 임시적치비 ${fmt2(a.items.storage)}`,
                      `= ${fmt2(a.netEok)}억원 (물량 ${fmtInt(volumeM3)} m³)`,
                    ]}
                  />
                )}
              </div>
              {a.notes.map((n) => <small key={n} className="dash-alt-note">{n}</small>)}
            </div>
          );
        })}
      </div>

      {selected && selected.id !== "D" && settlement && (
        <section className="dash-settle" data-demo="settlement">
          <h3>정산 배분 — 대안 {selected.id} 순편익 {fmtSignedEok(selected.netEok)} <Formula title="정산 배분" lines={[
            `공급자 순이익 = 순편익 ${fmt2(selected.netEok)} × 공급자 몫 ${Math.round(share * 100)}% = ${fmt2(settlement.supplierNet)}억원`,
            `수요자 순이익 = 순편익 − 공급자 순이익 = ${fmt2(settlement.demanderNet)}억원`,
            `정산금(수요자→공급자) = 공급자 순이익 − (회피 처분비 ${fmt2(selected.items.avoidedDisposal)} − 공급자 부담 ${fmt2(settlement.supplierBorne)}) = ${fmt2(settlement.transferToSupplier)}억원`,
            "가정: 공급자가 품질검사비·적치비, 수요자가 운송비를 부담",
          ]} /></h3>
          <label className="dash-share">
            <span>공급자 {Math.round(share * 100)}% : 수요자 {Math.round((1 - share) * 100)}%</span>
            <input type="range" min={0} max={100} step={5} value={Math.round(share * 100)} onChange={(e) => setShare(Number(e.target.value) / 100)} disabled={!!dealId} aria-label="공급자:수요자 배분 비율" />
          </label>
          <div className="dash-settle-grid">
            <div>
              <h4>공급자(항만·준설업체)</h4>
              <p>회피 처분비 <b>+{fmt2(selected.items.avoidedDisposal)}</b></p>
              <p>부담 비용(검사·적치) <b>−{fmt2(settlement.supplierBorne)}</b></p>
              <p>{settlement.transferToSupplier >= 0 ? "정산금 수령" : "정산금 지불"} <b>{settlement.transferToSupplier >= 0 ? "+" : "−"}{fmt2(Math.abs(settlement.transferToSupplier))}</b></p>
              <p className="dash-settle-total">실제 순이익 {fmtSignedEok(settlement.supplierNet)}</p>
            </div>
            <div>
              <h4>수요자(지자체)</h4>
              <p>자재 구매 절감 <b>+{fmt2(selected.items.materialSaving)}</b></p>
              <p>부담 비용(운송) <b>−{fmt2(settlement.demanderBorne)}</b></p>
              <p>{settlement.transferToSupplier >= 0 ? "정산금 지불" : "정산금 수령"} <b>{settlement.transferToSupplier >= 0 ? "−" : "+"}{fmt2(Math.abs(settlement.transferToSupplier))}</b></p>
              <p className="dash-settle-total">실제 순이익 {fmtSignedEok(settlement.demanderNet)}</p>
            </div>
          </div>
        </section>
      )}

      {dealId && (
        <div className="dash-confirm-progress" role="status">
          <div className="dash-progress"><span style={{ width: `${progress}%` }} /></div>
          <p>{progress < 100 ? <>매칭 확정 처리 중… {progress}%</> : <><CheckCircle2 size={16} aria-hidden="true" /> 매칭 확정 완료 — 운송 단계로 전환했습니다. 지도에서 운송 경로를 표시합니다.</>}</p>
        </div>
      )}

      <footer className="dash-sim-footer">
        <span className="dash-muted">{selected && selected.id !== "D" && !selected.recommended ? "순편익이 0 이하이거나 일정상 불가한 대안은 매칭 확정할 수 없습니다." : "모든 금액은 시연용 가정값 기반 계산입니다."}</span>
        <button type="button" className="dash-btn" onClick={onClose}>닫기</button>
        <button type="button" className="dash-btn dash-btn-primary" onClick={confirm} disabled={!confirmable} data-demo="confirm-match">매칭 확정</button>
      </footer>
    </Modal>
  );
}
