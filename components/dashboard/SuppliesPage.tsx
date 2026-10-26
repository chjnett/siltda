"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, GitCompareArrows, Heart, MapPin, ShieldCheck, Truck } from "lucide-react";
import { fmt1, fmtInt, fmtM3, fmtSignedEok, monthRange, useLabels, type BaseMonth } from "@/src/domain/format";
import { distanceKm } from "@/src/domain/geo";
import { matchedVolumeOfListing, topSitesForListing } from "@/src/domain/matching";
import { grainClass, grainClassLabels, judgeAll, suitableUses, finesPct } from "@/src/domain/suitability";
import { useStore } from "@/src/state/DealStore";
import type { Listing, Port, Verification, UseKind } from "@/src/types";
import SedimentPhoto from "./SedimentPhoto";
import { EmptyState, FitBadge, Formula, Modal, UseBadge, VerificationBadge } from "./ui";

const PAGE = 12;
type Sort = "volume" | "period" | "distance" | "benefit";
const periodOptions: Array<[string, string, (l: Listing) => boolean]> = [
  ["3", "3개월 이내 시작", (l) => l.dredgeStart <= 3],
  ["6", "6개월 이내 시작", (l) => l.dredgeStart <= 6],
  ["12", "12개월 이내 시작", (l) => l.dredgeStart <= 12],
  ["later", "12개월 이후", (l) => l.dredgeStart > 12],
];
const categories: Array<["" | UseKind, string]> = [["", "전체"], ["beach", "양빈용 모래"], ["tidal", "갯벌·염습지"], ["reclamation", "매립용"]];

export default function SuppliesPage() {
  const router = useRouter();
  const { state, openPassport, selectListing, selectSite } = useStore();
  const { data, base } = state;
  const site = data.sites.find((s) => s.id === state.selectedSiteId) ?? data.sites[0];

  const [region, setRegion] = useState("");
  const [period, setPeriod] = useState("");
  const [grain, setGrain] = useState("");
  const [use, setUse] = useState<"" | UseKind>("");
  const [verification, setVerification] = useState<"" | Verification>("");
  const [sort, setSort] = useState<Sort>("volume");
  const [shown, setShown] = useState(PAGE);
  const [checked, setChecked] = useState<string[]>([]);
  const [wish, setWish] = useState<string[]>([]);
  const [wishOnly, setWishOnly] = useState(false);
  const [comparing, setComparing] = useState(false);

  const portById = useMemo(() => new Map(data.ports.map((p) => [p.id, p])), [data.ports]);
  const regions = useMemo(() => [...new Set(data.ports.map((p) => p.region))].sort(), [data.ports]);

  // 매물별 최적 복원 후보(상품 카드의 '추천 수요처'와 예상 편익에 사용)
  const best = useMemo(() => {
    const m = new Map<string, ReturnType<typeof topSitesForListing>[number] | undefined>();
    for (const l of data.listings) m.set(l.id, topSitesForListing(l, data.sites, data.ports, data.deals, 1)[0]);
    return m;
  }, [data]);

  const items = useMemo(() => {
    const periodFn = periodOptions.find((o) => o[0] === period)?.[2];
    const list = data.listings.filter((l) => {
      const port = portById.get(l.portId);
      if (!port || l.stage === "placed") return false;
      return (!region || port.region === region)
        && (!periodFn || periodFn(l))
        && (!grain || grainClass(l.quality) === grain)
        && (!use || suitableUses(l.quality).includes(use))
        && (!verification || l.verification === verification)
        && (!wishOnly || wish.includes(l.id));
    });
    const dist = (l: Listing) => distanceKm(portById.get(l.portId)!.coordinate, site.coordinate);
    const benefit = (l: Listing) => best.get(l.id)?.candidate.netEok ?? -Infinity;
    return list.sort((a, b) => (sort === "volume" ? b.volumeM3 - a.volumeM3 : sort === "period" ? a.dredgeStart - b.dredgeStart : sort === "benefit" ? benefit(b) - benefit(a) : dist(a) - dist(b)));
  }, [data.listings, portById, region, period, grain, use, verification, sort, site, wishOnly, wish, best]);

  const matchedOf = (l: Listing) => matchedVolumeOfListing(l.id, data.deals);
  const usable = items.reduce((s, l) => s + Math.max(0, l.volumeM3 - matchedOf(l)), 0);
  const verifiedCount = data.listings.filter((l) => l.stage !== "placed" && l.verification === "verified").length;
  const totalActive = data.listings.filter((l) => l.stage !== "placed").length;
  const toggleCheck = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));
  const toggleWish = (id: string) => setWish((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const resetFilters = () => { setRegion(""); setPeriod(""); setGrain(""); setUse(""); setVerification(""); setWishOnly(false); };

  const viewCandidates = (l: Listing) => {
    const top = best.get(l.id);
    selectListing(l.id);
    if (top) selectSite(top.site.id);
    router.push("/dashboard/candidates");
  };

  return (
    <div className="dash-supplies">
      <section className="dash-shop-hero" data-demo="supply-header">
        <div>
          <p className="dash-shop-eyebrow">검증된 준설토 마켓</p>
          <h2>복원 현장에 바로 쓰는 준설토, 품질 검증부터 정산까지</h2>
          <p>품질 검증 결과와 용도별 적합 판정을 확인하고, 일정·거리·예상 편익이 맞는 매물을 골라 매칭을 요청하세요.</p>
        </div>
        <dl className="dash-shop-stats">
          <div><dt>등록 매물</dt><dd>{totalActive}건</dd></div>
          <div><dt>검증 완료</dt><dd>{verifiedCount}건</dd></div>
          <div>
            <dt>활용 가능 토량 <Formula title="전체 활용 가능 토량" lines={[
              `= Σ (매물 예정 물량 − 이미 매칭된 물량), 포설 완료 제외, 현재 필터 ${items.length}건`,
              `= ${fmtInt(items.reduce((s, l) => s + l.volumeM3, 0))} − ${fmtInt(items.reduce((s, l) => s + matchedOf(l), 0))} = ${fmtInt(usable)} m³`,
            ]} /></dt>
            <dd>{fmtInt(usable)} m³</dd>
          </div>
        </dl>
      </section>

      <div className="dash-shop-cats" role="tablist" aria-label="용도 카테고리">
        {categories.map(([k, label]) => (
          <button key={k || "all"} role="tab" aria-selected={use === k} className="dash-chip" data-active={use === k || undefined} onClick={() => { setUse(k); setShown(PAGE); }}>{label}</button>
        ))}
      </div>

      <div className="dash-shop-layout">
        <aside className="dash-card dash-shop-filters" aria-label="매물 필터">
          <h3>상세 조건</h3>
          <Select label="지역" value={region} onChange={setRegion} options={regions.map((r) => [r, r])} />
          <Select label="준설 시기" value={period} onChange={setPeriod} options={periodOptions.map((o) => [o[0], o[1]])} />
          <Select label="입도 등급" value={grain} onChange={setGrain} options={Object.entries(grainClassLabels)} />
          <Select label="검증 상태" value={verification} onChange={(v) => setVerification(v as "" | Verification)} options={[["verified", "검증 완료"], ["in-review", "검증 중"], ["unverified", "미검증"]]} />
          <label className="dash-compare-check"><input type="checkbox" checked={wishOnly} onChange={(e) => setWishOnly(e.target.checked)} /> 관심 매물만 ({wish.length})</label>
          <button type="button" className="dash-btn dash-btn-sm" onClick={resetFilters}>조건 초기화</button>
          <p className="dash-muted">사진은 매물 유형을 보여 주는 참고 이미지(Wikimedia Commons, 작가·라이선스 표기)이며 해당 항만의 실제 현장이 아닙니다.</p>
          <p className="dash-muted">거리·편익은 <b>{site.name}</b> 기준으로 계산됩니다. 금액은 시연용 가정값입니다.</p>
        </aside>

        <div className="dash-shop-main">
          <div className="dash-shop-toolbar">
            <span><b>{items.length}</b>건의 매물</span>
            <div className="dash-shop-sort" role="group" aria-label="정렬">
              {([["volume", "물량 많은 순"], ["benefit", "예상 편익 높은 순"], ["period", "준설 빠른 순"], ["distance", "가까운 순"]] as Array<[Sort, string]>).map(([k, label]) => (
                <button key={k} type="button" className="dash-chip" data-active={sort === k || undefined} onClick={() => setSort(k)}>{label}</button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState title="조건에 맞는 매물이 없습니다" hint="조건 초기화를 눌러 보세요." />
          ) : (
            <ul className="dash-listing-grid" data-demo="listing-grid">
              {items.slice(0, shown).map((l) => (
                <ListingCard
                  key={l.id} l={l} port={portById.get(l.portId) as Port} base={base} site={site.name}
                  top={best.get(l.id)} available={Math.max(0, l.volumeM3 - matchedOf(l))}
                  wished={wish.includes(l.id)} checked={checked.includes(l.id)} checkDisabled={!checked.includes(l.id) && checked.length >= 3}
                  onWish={() => toggleWish(l.id)} onCheck={() => toggleCheck(l.id)}
                  onPassport={() => openPassport(l.id)} onCandidates={() => viewCandidates(l)}
                />
              ))}
            </ul>
          )}

          {items.length > shown && (
            <div className="dash-more-row"><button type="button" className="dash-btn dash-btn-ghost" onClick={() => setShown((n) => n + PAGE)}>+ 더보기 ({items.length - shown}건 남음)</button></div>
          )}
        </div>
      </div>

      {checked.length >= 2 && (
        <div className="dash-compare-bar" role="region" aria-label="매물 비교">
          <span><GitCompareArrows size={16} aria-hidden="true" /> {checked.length}개 매물 선택됨(최대 3개)</span>
          <button type="button" className="dash-btn dash-btn-primary" onClick={() => setComparing(true)}>나란히 비교</button>
          <button type="button" className="dash-btn" onClick={() => setChecked([])}>선택 해제</button>
        </div>
      )}
      {comparing && <CompareModal ids={checked} base={base} onClose={() => setComparing(false)} />}
    </div>
  );
}

interface CardProps {
  l: Listing;
  port: Port;
  base: BaseMonth;
  site: string;
  top: ReturnType<typeof topSitesForListing>[number] | undefined;
  available: number;
  wished: boolean;
  checked: boolean;
  checkDisabled: boolean;
  onWish: () => void;
  onCheck: () => void;
  onPassport: () => void;
  onCandidates: () => void;
}

function ListingCard({ l, port, base, site, top, available, wished, checked, checkDisabled, onWish, onCheck, onPassport, onCandidates }: CardProps) {
  const uses = suitableUses(l.quality);
  const gc = grainClass(l.quality);
  const done = l.permits.filter((p) => p.status === "done").length;
  const cand = top?.candidate;
  const soon = l.dredgeStart <= 2;
  const badges: string[] = [];
  if (soon) badges.push("곧 준설 시작");
  if (l.volumeM3 >= 200000) badges.push("대형 물량");
  if (cand && cand.coverage >= 1) badges.push("수요 전량 충족");

  return (
    <li className="dash-listing" data-wished={wished || undefined}>
      <div className="dash-listing-photo">
        <SedimentPhoto id={l.id} grain={gc} label={`${port.name} ${l.project}`} />
        <div className="dash-ribbons">{badges.map((b) => <span key={b}>{b}</span>)}</div>
        <button type="button" className="dash-wish" aria-pressed={wished} aria-label={wished ? "관심 매물 해제" : "관심 매물 담기"} onClick={onWish}>
          <Heart size={16} aria-hidden="true" fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="dash-listing-body">
        <div className="dash-listing-head">
          <p className="dash-listing-port"><MapPin size={13} aria-hidden="true" /> {port.region} {port.name} <span className="dash-mono">{l.id}</span></p>
          <VerificationBadge v={l.verification} />
        </div>
        <h3>{l.project}</h3>
        <p className="dash-supply-volume">{fmtInt(available)}<small> m³ 구매 가능 <span className="dash-muted">/ 총 {fmtM3(l.volumeM3)}</span></small></p>

        <div className="dash-price-box">
          {cand ? (
            <>
              <span className="dash-price-label">추천 수요처 · {top!.site.name}</span>
              <b data-neg={cand.netEok <= 0 || undefined}>예상 순편익 {fmtSignedEok(cand.netEok)}</b>
              <small>직선 {fmt1(cand.km)} km · 회피 처분비 − 운송·검사·적치비 기준, 시연용 가정값</small>
            </>
          ) : (
            <span className="dash-price-label">조건을 만족하는 복원 후보지가 아직 없습니다</span>
          )}
        </div>

        <p className="dash-pill-row">{uses.map((u) => <UseBadge key={u} use={u} />)}</p>
        <ul className="dash-spec-chips">
          <li>{grainClassLabels[gc]}</li>
          <li>실트·점토 {finesPct(l.quality)}%</li>
          <li>준설 {monthRange(base, l.dredgeStart, l.dredgeEnd)}</li>
          <li>{fmt1(distanceKm(port.coordinate, top?.site.coordinate ?? port.coordinate))} km · {top?.site.name ?? site}</li>
        </ul>
        <p className="dash-trust"><ShieldCheck size={14} aria-hidden="true" /> 인허가·환경검증 {done}/{l.permits.length} 완료
          {l.verification === "verified" && <span><BadgeCheck size={14} aria-hidden="true" /> 품질 검증 완료</span>}
        </p>

        <label className="dash-compare-check"><input type="checkbox" checked={checked} onChange={onCheck} disabled={checkDisabled} /> 비교 담기</label>
        <div className="dash-listing-actions">
          <button type="button" className="dash-btn" onClick={onPassport} data-demo="open-passport">퇴적물 여권</button>
          <button type="button" className="dash-btn dash-btn-primary" onClick={onCandidates}><Truck size={14} aria-hidden="true" /> 매칭 요청하기</button>
        </div>
      </div>
    </li>
  );
}

function Select({ label, value, onChange, options, allowAll = true }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>; allowAll?: boolean }) {
  return (
    <label className="dash-filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowAll && <option value="">전체</option>}
        {options.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
    </label>
  );
}

function CompareModal({ ids, base, onClose }: { ids: string[]; base: BaseMonth; onClose: () => void }) {
  const { state } = useStore();
  const { data } = state;
  const listings = ids.map((id) => data.listings.find((l) => l.id === id)).filter((l): l is Listing => !!l);
  const rows: Array<[string, (l: Listing) => React.ReactNode]> = [
    ["항구·사업", (l) => `${data.ports.find((p) => p.id === l.portId)?.name} · ${l.project}`],
    ["예정 물량", (l) => fmtM3(l.volumeM3)],
    ["준설 시기", (l) => monthRange(base, l.dredgeStart, l.dredgeEnd)],
    ["검증 상태", (l) => <VerificationBadge v={l.verification} />],
    ["입도 등급", (l) => grainClassLabels[grainClass(l.quality)]],
    ["실트·점토 / 중앙입경", (l) => `${finesPct(l.quality)}% / ${l.quality.medianMm} mm`],
    ["염분", (l) => `${l.quality.salinityPsu} psu`],
    ["양빈 판정", (l) => <FitBadge fit={judgeAll(l.quality)[0].fit} />],
    ["갯벌·염습지 판정", (l) => <FitBadge fit={judgeAll(l.quality)[1].fit} />],
    ["매립 판정", (l) => <FitBadge fit={judgeAll(l.quality)[2].fit} />],
    ["최적 복원 후보", (l) => { const t = topSitesForListing(l, data.sites, data.ports, data.deals, 1)[0]; return t ? `${t.site.name} (${t.candidate.total}점)` : "없음"; }],
  ];
  return (
    <Modal title="매물 나란히 비교" subtitle={`판정 기준은 시연용 가정값입니다 · 용도: ${useLabels.beach}/${useLabels.tidal}/${useLabels.reclamation}`} onClose={onClose}>
      <table className="dash-table dash-compare-table">
        <thead><tr><th scope="col">항목</th>{listings.map((l) => <th key={l.id} scope="col">{l.id}</th>)}</tr></thead>
        <tbody>{rows.map(([label, fn]) => <tr key={label}><th scope="row">{label}</th>{listings.map((l) => <td key={l.id}>{fn(l)}</td>)}</tr>)}</tbody>
      </table>
    </Modal>
  );
}
