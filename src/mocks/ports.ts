import type { Port, Stockpile } from "@/src/types";

/** 시연용 항만·적치장. 좌표는 대략적인 위치이며 측량값이 아니다. */
export const mockPorts: Port[] = [
  { id: "busan-new", name: "부산신항", region: "부산", coordinate: [128.82, 35.065] },
  { id: "busan-north", name: "부산항 북항", region: "부산", coordinate: [129.05, 35.1] },
  { id: "incheon", name: "인천항", region: "인천", coordinate: [126.6, 37.45] },
  { id: "pyeongtaek", name: "평택·당진항", region: "경기", coordinate: [126.82, 36.97] },
  { id: "daesan", name: "대산항", region: "충남", coordinate: [126.42, 37.0] },
  { id: "gunsan", name: "군산항", region: "전북", coordinate: [126.72, 35.98] },
  { id: "mokpo", name: "목포항", region: "전남", coordinate: [126.38, 34.78] },
  { id: "gwangyang", name: "광양항", region: "전남", coordinate: [127.74, 34.9] },
  { id: "ulsan", name: "울산항", region: "울산", coordinate: [129.38, 35.5] },
  { id: "pohang", name: "포항항", region: "경북", coordinate: [129.38, 36.05] },
  { id: "donghae", name: "동해항", region: "강원", coordinate: [129.12, 37.5] },
  { id: "jeju", name: "제주항", region: "제주", coordinate: [126.54, 33.52] },
];

export const mockStockpiles: Stockpile[] = [
  { id: "sp-busan", name: "부산신항 배후 임시적치장", coordinate: [128.86, 35.09], capacityM3: 120000 },
  { id: "sp-pyeongtaek", name: "평택항 임시적치장", coordinate: [126.86, 36.99], capacityM3: 90000 },
  { id: "sp-pohang", name: "영일만 임시적치장", coordinate: [129.34, 36.08], capacityM3: 60000 },
];
