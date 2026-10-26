import type { Deal } from "@/src/types";

/** 시연용 초기 매칭·거래. 순편익은 data/dataset.ts에서 경제성 모델로 계산해 채운다. */
export type DealSeed = Omit<Deal, "netBenefitEok">;

export const mockDealSeeds: DealSeed[] = [
  { id: "DL-001", listingId: "L03", siteId: "manripo", volumeM3: 60000, alternative: "A", supplierShare: 0.4, stage: "transport", createdAtLabel: "3주 전" },
  { id: "DL-002", listingId: "L05", siteId: "maengbang", volumeM3: 88000, alternative: "B", supplierShare: 0.45, stage: "placed", createdAtLabel: "3개월 전" },
  { id: "DL-003", listingId: "L02", siteId: "dadaepo", volumeM3: 30000, alternative: "A", supplierShare: 0.4, stage: "matched", createdAtLabel: "5일 전" },
];
