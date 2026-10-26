import { TIMELINE_MISMATCH_RATIO } from "@/src/config/assumptions";
import type { Dataset, Stage } from "@/src/types";
import { monthRange, stageOrder, type BaseMonth } from "./format";
import { matchedVolumeOfListing, rankCandidates } from "./matching";
import { requiredVolume } from "./shoreline";
import { judgeUse } from "./suitability";

export type SignalId = "direct" | "stockpile" | "substitute";

export interface Signal {
  id: SignalId;
  label: string;
  basis: string[];
}

export interface PipelineStep {
  stage: Stage;
  count: number;
  volumeM3: number;
}

export interface TimelineMonth {
  month: number;
  supply: number;
  demand: number;
  /** 누적 임시적치 필요량 */
  storage: number;
  mismatch: boolean;
  suppliers: Array<{ name: string; volumeM3: number }>;
  demanders: Array<{ name: string; volumeM3: number }>;
}

export interface Overview {
  demandTotal: number;
  matchedVolume: number;
  /** 잔여 부족량(양수 = 부족) */
  shortage: number;
  /** 미매칭 공급 = 처분 위기 물량 */
  unmatchedSupply: number;
  /** 미매칭 공급 중 양빈·갯벌 용도로 쓸 수 있는 물량 */
  usableSupply: number;
  signal: Signal;
  pipeline: PipelineStep[];
  timeline: TimelineMonth[];
  kpis: { waitingSupply: number; fulfillmentPct: number | null; netBenefitEok: number; avoidedDisposal: number; dealCount: number };
}

export const SIGNAL_LABELS: Record<SignalId, string> = { direct: "직송 가능", stockpile: "임시적치 권장", substitute: "대체 자재 조달 필요" };

export function computeOverview(data: Dataset, base: BaseMonth): Overview {
  const { listings, sites, deals, ports } = data;
  const openSites = sites.filter((s) => s.status === "open");
  const openIds = new Set(openSites.map((s) => s.id));
  const active = listings.filter((l) => l.stage !== "placed");

  const demandTotal = openSites.reduce((s, x) => s + requiredVolume(x), 0);
  const matchedVolume = deals.filter((d) => openIds.has(d.siteId)).reduce((s, d) => s + d.volumeM3, 0);
  const shortage = Math.max(0, demandTotal - matchedVolume);
  const unmatchedSupply = active.reduce((s, l) => s + Math.max(0, l.volumeM3 - matchedVolumeOfListing(l.id, deals)), 0);
  const usableSupply = active
    .filter((l) => judgeUse(l.quality, "beach").fit !== "unfit" || judgeUse(l.quality, "tidal").fit !== "unfit")
    .reduce((s, l) => s + Math.max(0, l.volumeM3 - matchedVolumeOfListing(l.id, deals)), 0);

  // 조정 신호: 사이트별 최적 후보의 일정 차이와 전체 물량 차이로 판단
  const storageLines: string[] = [];
  let needsStorage = false;
  for (const site of openSites) {
    const best = rankCandidates(site, listings, ports, deals).find((c) => !c.unfit && c.availableM3 > 0 && c.schedule.lateMonths === 0);
    if (!best) continue;
    const s = best.schedule;
    if (s.storageMonths > 0) {
      needsStorage = true;
      storageLines.push(`${site.name}: 최적 후보 '${best.listing.project}' 준설 ${monthRange(base, s.dredgeStart, s.dredgeEnd)} / 복원 필요 ${monthRange(base, site.needStart, site.needEnd)} → 임시적치 ${s.storageMonths}개월`);
    } else {
      storageLines.push(`${site.name}: 최적 후보 '${best.listing.project}' 일정 일치(준설 ${monthRange(base, s.dredgeStart, s.dredgeEnd)})`);
    }
  }
  const volumeLine = `물량 차이: 복원 수요 ${Math.round(demandTotal).toLocaleString("ko-KR")} − 매칭 ${Math.round(matchedVolume).toLocaleString("ko-KR")} = 잔여 부족 ${Math.round(shortage).toLocaleString("ko-KR")} m³ / 활용 가능한 미매칭 공급 ${Math.round(usableSupply).toLocaleString("ko-KR")} m³`;
  let signalId: SignalId;
  if (shortage > usableSupply) signalId = "substitute";
  else if (needsStorage) signalId = "stockpile";
  else signalId = "direct";
  const signal: Signal = { id: signalId, label: SIGNAL_LABELS[signalId], basis: [volumeLine, ...storageLines] };

  const pipeline: PipelineStep[] = stageOrder.map((stage) => {
    const ls = listings.filter((l) => l.stage === stage);
    return { stage, count: ls.length, volumeM3: ls.reduce((s, l) => s + l.volumeM3, 0) };
  });

  const timeline: TimelineMonth[] = Array.from({ length: 12 }, (_, month) => {
    const suppliers = active
      .filter((l) => month >= l.dredgeStart && month <= l.dredgeEnd)
      .map((l) => ({ name: l.project, volumeM3: l.volumeM3 / (l.dredgeEnd - l.dredgeStart + 1) }));
    const demanders = openSites
      .filter((s) => month >= s.needStart && month <= s.needEnd)
      .map((s) => ({ name: s.name, volumeM3: requiredVolume(s) / (s.needEnd - s.needStart + 1) }));
    const supply = suppliers.reduce((a, b) => a + b.volumeM3, 0);
    const demand = demanders.reduce((a, b) => a + b.volumeM3, 0);
    const hi = Math.max(supply, demand);
    const lo = Math.min(supply, demand);
    const mismatch = hi > 0 && (lo === 0 || hi / lo > TIMELINE_MISMATCH_RATIO);
    return { month, supply, demand, storage: 0, mismatch, suppliers, demanders };
  });
  let running = 0;
  for (const m of timeline) {
    running = Math.max(0, running + m.supply - m.demand);
    m.storage = running;
  }

  const netBenefitEok = deals.reduce((s, d) => s + d.netBenefitEok, 0);
  const avoidedDisposal = deals.reduce((s, d) => s + d.volumeM3, 0);
  return {
    demandTotal, matchedVolume, shortage, unmatchedSupply, usableSupply, signal, pipeline, timeline,
    kpis: { waitingSupply: usableSupply, fulfillmentPct: demandTotal > 0 ? (matchedVolume / demandTotal) * 100 : null, netBenefitEok, avoidedDisposal, dealCount: deals.length },
  };
}
