import type { CandidateSite } from "./types";

const MATCH_WEIGHTS = { quality: 0.4, schedule: 0.25, distance: 0.2, volume: 0.15 } as const;
const COSTS = {
  disposalPerM3: 16000,
  sandPurchasePerM3: 29000,
  transportPerM3Km: 85,
  inspectionFixedWon: 20_000_000,
  inspectionPerM3: 300,
  storagePerM3Month: 1200,
} as const;

export const timelineMonths = ["10월", "11월", "12월", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월"];

export interface MatchInsight {
  matchedVolume: number;
  coveragePct: number;
  storageMonths: number;
  lateMonths: number;
  scheduleScore: number;
  distanceScore: number;
  volumeScore: number;
  totalScore: number;
  netBenefitEok: number;
  strategy: "직송" | "임시적치" | "일정 조정";
}

export function getMatchInsight(deposit: CandidateSite, erosion: CandidateSite, distanceKm: number): MatchInsight {
  const matchedVolume = Math.min(deposit.volume, erosion.volume);
  const coveragePct = erosion.volume > 0 ? Math.min(100, matchedVolume / erosion.volume * 100) : 0;
  const storageMonths = Math.max(0, erosion.operation.startMonth - deposit.operation.endMonth);
  const lateMonths = Math.max(0, deposit.operation.startMonth - erosion.operation.endMonth);
  const scheduleScore = lateMonths > 0 ? 0 : Math.max(0, 100 - storageMonths * 12);
  const distanceScore = Math.max(0, Math.round(100 - distanceKm / 600 * 100));
  const volumeScore = Math.round(coveragePct);
  const totalScore = Math.round(
    deposit.matchScore * MATCH_WEIGHTS.quality
      + scheduleScore * MATCH_WEIGHTS.schedule
      + distanceScore * MATCH_WEIGHTS.distance
      + volumeScore * MATCH_WEIGHTS.volume,
  );

  const avoided = matchedVolume * (COSTS.disposalPerM3 + COSTS.sandPurchasePerM3);
  const transport = matchedVolume * distanceKm * COSTS.transportPerM3Km;
  const inspection = COSTS.inspectionFixedWon + matchedVolume * COSTS.inspectionPerM3;
  const storage = matchedVolume * storageMonths * COSTS.storagePerM3Month;
  const netBenefitEok = (avoided - transport - inspection - storage) / 100_000_000;

  return {
    matchedVolume,
    coveragePct,
    storageMonths,
    lateMonths,
    scheduleScore,
    distanceScore,
    volumeScore,
    totalScore,
    netBenefitEok,
    strategy: lateMonths > 0 ? "일정 조정" : storageMonths > 0 ? "임시적치" : "직송",
  };
}

export function timelineStyle(site: CandidateSite) {
  const start = Math.max(0, Math.min(11, site.operation.startMonth));
  const end = Math.max(start, Math.min(11, site.operation.endMonth));
  return {
    left: `${start / 12 * 100}%`,
    width: `${Math.max(1, end - start + 1) / 12 * 100}%`,
  };
}
