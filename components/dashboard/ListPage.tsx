"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";
import { downloadCsv } from "@/src/domain/csv";
import { fmtInt, fmtSignedEok, monthRange, stageLabels, stageOrder, urgencyLabels, verificationLabels } from "@/src/domain/format";
import { requiredVolume } from "@/src/domain/shoreline";
import { suitableUses } from "@/src/domain/suitability";
import { useStore } from "@/src/state/DealStore";
import type { Stage } from "@/src/types";
import { EmptyState, StageBadge, UrgencyBadge, VerificationBadge } from "./ui";

type Tab = "supply" | "demand" | "deals";
const altNames = { A: "직송", B: "임시적치 후 공급", C: "장거리 운송" } as const;

interface Col<T> { key: string; label: string; value: (r: T) => string | number; render?: (r: T) => ReactNode; num?: boolean }
interface Row { id: string; stage: Stage; cells: Array<string | number>; raw: Record<string, string | number>; onOpen: () => void; render: Record<string, ReactNode> }

export default function ListPage() {
  const router = useRouter();
  const { state, setStageFilter, openPassport, selectSite, selectListing } = useStore();
  const { data, base } = state;
  const [tab, setTab] = useState<Tab>("supply");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [asc, setAsc] = useState(false);

  const port = (id: string) => data.ports.find((p) => p.id === id)?.name ?? "";
  const site = (id: string) => data.sites.find((s) => s.id === id);
  const listing = (id: string) => data.listings.find((l) => l.id === id);

  const { columns, rows, filename }: { columns: Array<{ key: string; label: string; num?: boolean }>; rows: Row[]; filename: string } = useMemo(() => {
    if (tab === "supply") {
      return {
        filename: "싣다_공급목록.csv",
        columns: [
          { key: "id", label: "매물 ID" }, { key: "port", label: "항만" }, { key: "project", label: "사업" }, { key: "volume", label: "물량(m³)", num: true },
          { key: "period", label: "준설 시기" }, { key: "verification", label: "검증" }, { key: "uses", label: "적합 용도" }, { key: "stage", label: "단계" },
        ],
        rows: data.listings.map((l) => {
          const raw = {
            id: l.id, port: port(l.portId), project: l.project, volume: l.volumeM3, period: monthRange(base, l.dredgeStart, l.dredgeEnd),
            verification: verificationLabels[l.verification], uses: suitableUses(l.quality).join("/"), stage: stageLabels[l.stage],
          };
          return {
            id: l.id, stage: l.stage, raw, cells: Object.values(raw), onOpen: () => openPassport(l.id),
            render: { volume: fmtInt(l.volumeM3), verification: <VerificationBadge v={l.verification} />, stage: <StageBadge stage={l.stage} /> },
          };
        }),
      };
    }
    if (tab === "demand") {
      return {
        filename: "싣다_수요목록.csv",
        columns: [
          { key: "id", label: "후보지" }, { key: "region", label: "지역" }, { key: "urgency", label: "긴급도" }, { key: "need", label: "필요 토량(m³)", num: true },
          { key: "period", label: "복원 시기" }, { key: "secured", label: "확보 토량(m³)", num: true }, { key: "status", label: "상태" },
        ],
        rows: data.sites.map((s) => {
          const secured = data.deals.filter((d) => d.siteId === s.id).reduce((a, d) => a + d.volumeM3, 0);
          const raw = {
            id: s.name, region: s.region, urgency: s.status === "completed" ? "-" : urgencyLabels[s.urgency], need: Math.round(requiredVolume(s)),
            period: monthRange(base, s.needStart, s.needEnd), secured, status: s.status === "completed" ? "복원 완료" : "수요 발생",
          };
          return {
            id: s.id, stage: "registered" as Stage, raw, cells: Object.values(raw), onOpen: () => { selectSite(s.id); router.push("/dashboard/candidates"); },
            render: { need: fmtInt(requiredVolume(s)), secured: fmtInt(secured), urgency: s.status === "completed" ? "-" : <UrgencyBadge u={s.urgency} /> },
          };
        }),
      };
    }
    return {
      filename: "싣다_거래내역.csv",
      columns: [
        { key: "id", label: "거래 ID" }, { key: "from", label: "공급(항만·사업)" }, { key: "to", label: "수요(후보지)" }, { key: "volume", label: "물량(m³)", num: true },
        { key: "alt", label: "선택 대안" }, { key: "net", label: "순편익(억원)", num: true }, { key: "split", label: "정산 비율(공급:수요)" }, { key: "stage", label: "단계" },
      ],
      rows: data.deals.map((d) => {
        const l = listing(d.listingId);
        const raw = {
          id: d.id, from: l ? `${port(l.portId)} · ${l.project}` : "", to: site(d.siteId)?.name ?? "", volume: d.volumeM3,
          alt: `${d.alternative}. ${altNames[d.alternative]}`, net: Number(d.netBenefitEok.toFixed(2)),
          split: `${Math.round(d.supplierShare * 100)}:${Math.round((1 - d.supplierShare) * 100)}`, stage: stageLabels[d.stage],
        };
        return {
          id: d.id, stage: d.stage, raw, cells: Object.values(raw),
          onOpen: () => { if (l) selectListing(l.id); selectSite(d.siteId); router.push("/dashboard/candidates"); },
          render: { volume: fmtInt(d.volumeM3), net: fmtSignedEok(d.netBenefitEok), stage: <StageBadge stage={d.stage} /> },
        };
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, data, base]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => (tab === "demand" || !state.stageFilter || r.stage === state.stageFilter) && (!q || r.cells.some((c) => String(c).toLowerCase().includes(q))));
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const x = a.raw[sortKey];
        const y = b.raw[sortKey];
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ko");
        return asc ? cmp : -cmp;
      });
    }
    return list;
  }, [rows, query, sortKey, asc, state.stageFilter, tab]);

  const sortBy = (key: string) => { if (sortKey === key) setAsc(!asc); else { setSortKey(key); setAsc(true); } };
  const exportCsv = () => downloadCsv(filename, columns.map((c) => c.label), filtered.map((r) => r.cells));

  return (
    <div className="dash-list">
      <section className="dash-card">
        <header className="dash-card-head">
          <div className="dash-tabs" role="tablist" aria-label="목록 종류">
            {([["supply", "공급"], ["demand", "수요"], ["deals", "매칭·거래 내역"]] as Array<[Tab, string]>).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className="dash-chip" data-active={tab === id || undefined} onClick={() => { setTab(id); setSortKey(null); }}>{label}</button>
            ))}
          </div>
          <div className="dash-head-actions">
            <label className="dash-search"><Search size={14} aria-hidden="true" />
              <input type="search" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="목록 검색" />
            </label>
            <button type="button" className="dash-btn" onClick={exportCsv}><Download size={14} aria-hidden="true" /> CSV 내보내기</button>
          </div>
        </header>

        {tab !== "demand" && (
          <div className="dash-stage-filter" role="group" aria-label="단계 필터">
            <button type="button" className="dash-chip" data-active={!state.stageFilter || undefined} onClick={() => setStageFilter(null)}>전체 단계</button>
            {stageOrder.map((s) => (
              <button key={s} type="button" className="dash-chip" data-active={state.stageFilter === s || undefined} onClick={() => setStageFilter(state.stageFilter === s ? null : s)}>{stageLabels[s]}</button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState title="표시할 항목이 없습니다" hint="검색어나 단계 필터를 바꿔 보세요." />
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" data-num={c.num || undefined} aria-sort={sortKey === c.key ? (asc ? "ascending" : "descending") : "none"}>
                      <button type="button" onClick={() => sortBy(c.key)}>{c.label}{sortKey === c.key && (asc ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} tabIndex={0} onClick={r.onOpen} onKeyDown={(e) => { if (e.key === "Enter") r.onOpen(); }}>
                    {columns.map((c) => <td key={c.key} data-num={c.num || undefined}>{r.render[c.key] ?? String(r.raw[c.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="dash-muted">{filtered.length}건 · 행을 누르면 {tab === "supply" ? "퇴적물 여권" : "연안 복원 후보 화면"}으로 이동합니다. 모든 데이터는 시연용입니다.</p>
      </section>
    </div>
  );
}
