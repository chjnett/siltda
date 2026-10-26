import type { Site } from "@/src/types";

/**
 * 시연용 복원 후보지. 침식 면적·해안선 후퇴량·탐지 근거는 시연을 위한 가상 값이며 실제 관측 결과가 아니다.
 * 필요 토량 = 침식 면적 × 복원 두께 × 손실 보정(domain/volume.ts)
 */
const retreat = (values: number[]) => values.map((m, i) => ({ year: 2018 + i, m }));

export const mockSites: Site[] = [
  {
    id: "dadaepo", name: "다대포 해변", region: "부산", coordinate: [128.966, 35.047], status: "open", urgency: "critical",
    areaM2: 80000, thicknessM: 1.4, lossFactor: 1.35, needStart: 3, needEnd: 6,
    detection: ["위성 영상(시계열)", "수심 측량"], use: "beach", requirement: { maxFinesPct: 15, medianMm: [0.12, 0.48] },
    shoreline: { axisDeg: 130, landwardDeg: 40, lengthM: 1400, retreatM: retreat([0, 3, 6, 10, 13, 18, 22, 26, 31]) },
    mrv: [], studioCandidateId: "dadaepo-erosion",
  },
  {
    id: "songjeong", name: "송정 해변", region: "부산", coordinate: [129.199, 35.178], status: "open", urgency: "high",
    areaM2: 54000, thicknessM: 1.7, lossFactor: 1.34, needStart: 5, needEnd: 8,
    detection: ["위성 영상(시계열)", "드론 정사영상"], use: "beach", requirement: { maxFinesPct: 15, medianMm: [0.25, 0.62] },
    shoreline: { axisDeg: 40, landwardDeg: 310, lengthM: 1100, retreatM: retreat([0, 2, 5, 7, 11, 14, 17, 21, 24]) },
    mrv: [], studioCandidateId: "songjeong-erosion",
  },
  {
    id: "gyeongpo", name: "경포 해변", region: "강원", coordinate: [128.91, 37.8], status: "open", urgency: "high",
    areaM2: 42000, thicknessM: 1.8, lossFactor: 1.3, needStart: 2, needEnd: 5,
    detection: ["드론 정사영상", "수심 측량"], use: "beach", requirement: { maxFinesPct: 15, medianMm: [0.2, 0.6] },
    shoreline: { axisDeg: 0, landwardDeg: 270, lengthM: 1200, retreatM: retreat([0, 1, 4, 6, 9, 13, 15, 19, 22]) },
    mrv: [],
  },
  {
    id: "manripo", name: "만리포 해변", region: "충남", coordinate: [126.14, 36.79], status: "open", urgency: "critical",
    areaM2: 36000, thicknessM: 1.7, lossFactor: 1.25, needStart: 1, needEnd: 3,
    detection: ["위성 영상(시계열)", "드론 정사영상", "수심 측량"], use: "beach", requirement: { maxFinesPct: 15, medianMm: [0.2, 0.6] },
    shoreline: { axisDeg: 10, landwardDeg: 90, lengthM: 900, retreatM: retreat([0, 4, 7, 12, 15, 21, 26, 30, 36]) },
    mrv: [],
  },
  {
    id: "gyeokpo", name: "격포 갯벌 복원지", region: "전북", coordinate: [126.47, 35.62], status: "open", urgency: "normal",
    areaM2: 25000, thicknessM: 1.8, lossFactor: 1.2, needStart: 7, needEnd: 10,
    detection: ["위성 영상(시계열)"], use: "tidal", requirement: { maxFinesPct: 100, medianMm: [0.02, 0.2] },
    shoreline: { axisDeg: 20, landwardDeg: 100, lengthM: 800, retreatM: retreat([0, 1, 2, 4, 5, 7, 8, 10, 11]) },
    mrv: [],
  },
  {
    id: "maengbang", name: "맹방 해변", region: "강원", coordinate: [129.21, 37.38], status: "completed", urgency: "normal",
    areaM2: 50000, thicknessM: 1.9, lossFactor: 1.18, needStart: -8, needEnd: -4,
    detection: ["위성 영상(시계열)", "드론 정사영상"], use: "beach", requirement: { maxFinesPct: 15, medianMm: [0.2, 0.6] },
    shoreline: { axisDeg: 5, landwardDeg: 275, lengthM: 1000, retreatM: retreat([0, 5, 11, 17, 24, 30, 38, 46, 34]) },
    mrv: [
      { label: "포설 직후", shorelineChangeM: 12, areaChangeM2: 11000, volumeChangeM3: 104000 },
      { label: "3개월 후", shorelineChangeM: 10, areaChangeM2: 9200, volumeChangeM3: 96500 },
      { label: "6개월 후", shorelineChangeM: 9, areaChangeM2: 8400, volumeChangeM3: 91000 },
      { label: "12개월 후", shorelineChangeM: 8, areaChangeM2: 7600, volumeChangeM3: 85500 },
    ],
  },
];
