import type { LonLat } from "@/src/types";

/** 두 지점 사이의 대원거리(km) — 직선거리이며 실제 항로 거리가 아니다. */
export function distanceKm(a: LonLat, b: LonLat) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
