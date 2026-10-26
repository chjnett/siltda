import { DISTANCE_ZERO_KM, MATCH_WEIGHTS, SCHEDULE_PENALTY_PER_MONTH } from "@/src/config/assumptions";
import { distanceKm } from "./geo";
import type { Deal, Fit, Listing, Port, Site } from "@/src/types";
import { bestAlternative, evaluateAlternatives, type AltResult, type CostParams } from "./economics";
import { judgeUse, type Judgement } from "./suitability";
import { requiredVolume } from "./shoreline";

export const matchedVolumeOfListing = (listingId: string, deals: Deal[]) => deals.filter((d) => d.listingId === listingId).reduce((s, d) => s + d.volumeM3, 0);
export const securedVolumeOfSite = (siteId: string, deals: Deal[]) => deals.filter((d) => d.siteId === siteId).reduce((s, d) => s + d.volumeM3, 0);

export interface ScheduleCheck {
  /** 준설이 복원 시작보다 먼저 끝나 적치해야 하는 개월 */
  storageMonths: number;
  /** 준설이 복원 종료 후에 시작해 맞출 수 없는 개월 */
  lateMonths: number;
  score: number;
  /** 시프트가 반영된 준설 구간 */
  dredgeStart: number;
  dredgeEnd: number;
}

export function checkSchedule(listing: Pick<Listing, "dredgeStart" | "dredgeEnd">, site: Pick<Site, "needStart" | "needEnd">, shiftMonths = 0): ScheduleCheck {
  const ds = listing.dredgeStart + shiftMonths;
  const de = listing.dredgeEnd + shiftMonths;
  const storageMonths = Math.max(0, site.needStart - de);
  const lateMonths = Math.max(0, ds - site.needEnd);
  const score = lateMonths > 0 ? 0 : Math.max(0, 100 - SCHEDULE_PENALTY_PER_MONTH * storageMonths);
  return { storageMonths, lateMonths, score, dredgeStart: ds, dredgeEnd: de };
}

export interface Candidate {
  listing: Listing;
  port: Port;
  km: number;
  judgement: Judgement;
  qualityScore: number;
  schedule: ScheduleCheck;
  distanceScore: number;
  /** 이 매물에서 아직 매칭되지 않은 물량 */
  availableM3: number;
  /** 후보지 잔여 필요량 중 이 매물이 채울 수 있는 비율(0~1) */
  coverage: number;
  volumeScore: number;
  total: number;
  unfit: boolean;
  alternatives: AltResult[];
  best: AltResult | null;
  /** 목록에 표시할 예상 순편익(최선 대안, 없으면 가장 높은 실행 가능 대안) */
  netEok: number;
  useVolumeM3: number;
}

const qualityScoreOf = (fit: Fit, medianMm: number, range: [number, number]) => {
  if (fit === "unfit") return 0;
  const base = fit === "fit" ? 100 : 55;
  const mid = (range[0] + range[1]) / 2;
  const dev = Math.min(1, Math.abs(medianMm - mid) / Math.max(mid, 0.01));
  return Math.round(base - dev * 10);
};

export interface RankOptions {
  params?: CostParams;
  /** 매물별 일정 이동(개월) — 간트 드래그 */
  shiftOf?: (listingId: string) => number;
}

export function evaluateCandidate(site: Site, listing: Listing, port: Port, deals: Deal[], opts: RankOptions = {}): Candidate {
  const km = distanceKm(port.coordinate, site.coordinate);
  const judgement = judgeUse(listing.quality, site.use, { maxFinesPct: site.requirement.maxFinesPct, medianMm: site.requirement.medianMm });
  const qualityScore = qualityScoreOf(judgement.fit, listing.quality.medianMm, site.requirement.medianMm);
  const schedule = checkSchedule(listing, site, opts.shiftOf?.(listing.id) ?? 0);
  const distanceScore = Math.max(0, Math.round(100 - (km / DISTANCE_ZERO_KM) * 100));
  const availableM3 = Math.max(0, listing.volumeM3 - matchedVolumeOfListing(listing.id, deals));
  const remaining = Math.max(0, requiredVolume(site) - securedVolumeOfSite(site.id, deals));
  const coverage = remaining > 0 ? Math.min(1, availableM3 / remaining) : 0;
  const volumeScore = Math.round(coverage * 100);
  const total = Math.round(
    qualityScore * MATCH_WEIGHTS.quality + schedule.score * MATCH_WEIGHTS.schedule + distanceScore * MATCH_WEIGHTS.distance + volumeScore * MATCH_WEIGHTS.volume,
  );
  const useVolumeM3 = Math.min(availableM3, remaining);
  const alternatives = evaluateAlternatives({ volumeM3: useVolumeM3, distanceKm: km, storageMonths: schedule.storageMonths, lateMonths: schedule.lateMonths, params: opts.params });
  const best = bestAlternative(alternatives);
  const netEok = best?.netEok ?? Math.max(...alternatives.filter((a) => a.id !== "D" && a.feasible).map((a) => a.netEok), -Infinity);
  return {
    listing, port, km, judgement, qualityScore, schedule, distanceScore, availableM3, coverage, volumeScore, total,
    unfit: judgement.fit === "unfit", alternatives, best, netEok: Number.isFinite(netEok) ? netEok : 0, useVolumeM3,
  };
}

/** 적합도 점수순. 품질 부적합·이미 포설 완료·가용 물량 없음 매물은 하단(회색). */
export function rankCandidates(site: Site, listings: Listing[], ports: Port[], deals: Deal[], opts: RankOptions = {}): Candidate[] {
  const portById = new Map(ports.map((p) => [p.id, p]));
  const result: Candidate[] = [];
  for (const listing of listings) {
    const port = portById.get(listing.portId);
    if (!port || listing.stage === "placed") continue;
    result.push(evaluateCandidate(site, listing, port, deals, opts));
  }
  const rank = (c: Candidate) => (c.unfit ? 1 : 0);
  return result.sort((a, b) => rank(a) - rank(b) || b.total - a.total);
}

/** 매물 기준 복원 후보 Top N (품질 부적합 제외) */
export function topSitesForListing(listing: Listing, sites: Site[], ports: Port[], deals: Deal[], n = 3) {
  const port = ports.find((p) => p.id === listing.portId);
  if (!port) return [];
  return sites
    .filter((s) => s.status === "open")
    .map((site) => ({ site, candidate: evaluateCandidate(site, listing, port, deals) }))
    .filter((x) => !x.candidate.unfit)
    .sort((a, b) => b.candidate.total - a.candidate.total)
    .slice(0, n);
}
