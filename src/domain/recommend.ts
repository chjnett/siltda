import { rankCandidates, securedVolumeOfSite } from "@/src/domain/matching";
import { requiredVolume, retreatAt, yearRange } from "@/src/domain/shoreline";
import type { Dataset, Site, Urgency } from "@/src/types";

/** 복원지 추천 점수 가중치 — 모두 시연용 가정값(실제 정책 기준 아님) */
export const RECOMMEND_WEIGHTS = {
  urgency: { critical: 40, high: 25, normal: 10 } as Record<Urgency, number>,
  /** 최근 3년 평균 후퇴 속도(m/년) 1m당 점수, 최대 30점 */
  retreatPerM: 10,
  retreatMax: 30,
  /** 필요 토량 중 아직 확보하지 못한 비율 × 이 값 */
  unmetMax: 20,
  /** 품질·일정 적합 후보 항만 1곳당 점수, 최대 3곳 */
  supplyPerPort: 10 / 3,
} as const;

export interface SiteRecommendation {
  site: Site;
  score: number;
  retreatRate: number;
  unmetPct: number;
  fitPorts: number;
  parts: { urgency: number; retreat: number; unmet: number; supply: number };
}

/** 열린 복원 수요를 시급성·후퇴 속도·미확보 비율·공급 가능 후보 수로 점수화해 높은 순으로 정렬한다. */
export function recommendSites(data: Dataset): SiteRecommendation[] {
  const w = RECOMMEND_WEIGHTS;
  return data.sites
    .filter((s) => s.status === "open")
    .map((site) => {
      const [, y1] = yearRange(site);
      const retreatRate = (retreatAt(site, y1) - retreatAt(site, y1 - 3)) / 3;
      const required = requiredVolume(site);
      const unmetPct = required > 0 ? Math.max(0, 1 - securedVolumeOfSite(site.id, data.deals) / required) : 0;
      const fitPorts = new Set(rankCandidates(site, data.listings, data.ports, data.deals).filter((c) => !c.unfit && c.schedule.lateMonths === 0 && c.availableM3 > 0).map((c) => c.port.id)).size;
      const parts = {
        urgency: w.urgency[site.urgency],
        retreat: Math.min(w.retreatMax, Math.max(0, retreatRate) * w.retreatPerM),
        unmet: unmetPct * w.unmetMax,
        supply: Math.min(3, fitPorts) * w.supplyPerPort,
      };
      return { site, retreatRate, unmetPct, fitPorts, parts, score: parts.urgency + parts.retreat + parts.unmet + parts.supply };
    })
    .sort((a, b) => b.score - a.score);
}
