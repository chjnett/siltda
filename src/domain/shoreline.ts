import type { LonLat, Site } from "@/src/types";

/** 필요 토량 = 침식 면적 × 복원 두께 × 손실 보정 */
export const requiredVolume = (site: Pick<Site, "areaM2" | "thicknessM" | "lossFactor">) => site.areaM2 * site.thicknessM * site.lossFactor;

const M_PER_DEG_LAT = 111320;

function offset(origin: LonLat, bearingDeg: number, meters: number): LonLat {
  const rad = (bearingDeg * Math.PI) / 180;
  const dx = Math.sin(rad) * meters;
  const dy = Math.cos(rad) * meters;
  return [origin[0] + dx / (M_PER_DEG_LAT * Math.cos((origin[1] * Math.PI) / 180)), origin[1] + dy / M_PER_DEG_LAT];
}

/** 해당 연도(소수 가능)의 누적 후퇴량(m). 표의 범위 밖은 양 끝값. */
export function retreatAt(site: Site, year: number) {
  const table = site.shoreline.retreatM;
  if (year <= table[0].year) return table[0].m;
  const last = table[table.length - 1];
  if (year >= last.year) return last.m;
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (year >= a.year && year <= b.year) return a.m + ((b.m - a.m) * (year - a.year)) / (b.year - a.year);
  }
  return last.m;
}

/** 기준(첫 해) 해안선: 중심을 지나는 직선을 해안선 방향으로 펼친 개략 선. 실제 해안선이 아닌 시연용 모델. */
export function baselineShoreline(site: Site, points = 9): LonLat[] {
  const { axisDeg, lengthM } = site.shoreline;
  return Array.from({ length: points }, (_, i) => offset(site.coordinate, axisDeg, (i / (points - 1) - 0.5) * lengthM));
}

export function shorelineAt(site: Site, year: number): LonLat[] {
  const m = retreatAt(site, year) - site.shoreline.retreatM[0].m;
  return baselineShoreline(site).map((p) => offset(p, site.shoreline.landwardDeg, m));
}

/** 기준 해안선과 해당 연도 해안선 사이의 침식 구역 */
export function erosionPolygon(site: Site, year: number): LonLat[] {
  const base = baselineShoreline(site);
  const now = shorelineAt(site, year);
  return [...base, ...[...now].reverse()];
}

export const yearRange = (site: Site): [number, number] => [site.shoreline.retreatM[0].year, site.shoreline.retreatM[site.shoreline.retreatM.length - 1].year];

/** 복원 후(포설) 모습: 해안선을 바다 쪽으로 gainM만큼 되돌린 선 */
export function restoredShoreline(site: Site, gainM: number): LonLat[] {
  const now = shorelineAt(site, yearRange(site)[1]);
  return now.map((p) => offset(p, (site.shoreline.landwardDeg + 180) % 360, gainM));
}
