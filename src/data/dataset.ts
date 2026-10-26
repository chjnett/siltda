import { mockDealSeeds } from "@/src/mocks/deals";
import { mockListings } from "@/src/mocks/listings";
import { mockPorts, mockStockpiles } from "@/src/mocks/ports";
import { mockSites } from "@/src/mocks/sites";
import { evaluateAlternatives } from "@/src/domain/economics";
import { distanceKm } from "@/src/domain/geo";
import { checkSchedule } from "@/src/domain/matching";
import type { Dataset, Deal } from "@/src/types";

/**
 * 데이터 공급 지점. 지금은 mock을 그대로 돌려주며, 실제 API가 생기면 이 함수만 교체한다.
 * 초기 거래의 순편익은 경제성 모델(domain/economics.ts)로 계산해 화면의 다른 수치와 일관되게 한다.
 */
export function loadDataset(): Dataset {
  const deals: Deal[] = [];
  for (const seed of mockDealSeeds) {
    const listing = mockListings.find((l) => l.id === seed.listingId);
    const site = mockSites.find((s) => s.id === seed.siteId);
    const port = listing && mockPorts.find((p) => p.id === listing.portId);
    if (!listing || !site || !port) continue;
    const schedule = checkSchedule(listing, site);
    const alts = evaluateAlternatives({
      volumeM3: seed.volumeM3,
      distanceKm: distanceKm(port.coordinate, site.coordinate),
      storageMonths: schedule.storageMonths,
      lateMonths: schedule.lateMonths,
    });
    const alt = alts.find((a) => a.id === seed.alternative) ?? alts[0];
    deals.push({ ...seed, netBenefitEok: alt.netEok });
  }
  return { ports: mockPorts, listings: mockListings, sites: mockSites, stockpiles: mockStockpiles, deals };
}
