import type { CandidateSite, ProjectState } from "./types";

export const candidates: CandidateSite[] = [
  {
    id: "busan-new-port-a",
    kind: "deposit",
    name: "부산신항 준설 후보 A",
    subtitle: "항로 유지 준설 · 2026년 4분기",
    polygon: [[128.811, 35.061], [128.824, 35.058], [128.831, 35.066], [128.821, 35.073], [128.809, 35.069]],
    soil: "세립사 혼합 실트",
    grain: "모래 62% · 실트 31% · 점토 7%",
    volume: 182000,
    matchScore: 92,
  },
  {
    id: "busan-north-port-b",
    kind: "deposit",
    name: "부산항 북항 후보 B",
    subtitle: "부두 전면 수심 확보",
    polygon: [[129.044, 35.099], [129.052, 35.098], [129.056, 35.104], [129.049, 35.108], [129.042, 35.104]],
    soil: "중립사",
    grain: "모래 78% · 실트 19% · 점토 3%",
    volume: 96000,
    matchScore: 86,
  },
  {
    id: "dadaepo-erosion",
    kind: "erosion",
    name: "다대포 침식 복원지",
    subtitle: "완충사구 및 연안습지 복원",
    polygon: [[128.960, 35.048], [128.972, 35.047], [128.977, 35.053], [128.968, 35.058], [128.958, 35.054]],
    soil: "세립사 우세",
    grain: "요구 입도 0.12–0.48 mm",
    volume: 151000,
    erosionRate: 1.8,
    matchScore: 92,
  },
  {
    id: "songjeong-erosion",
    kind: "erosion",
    name: "송정 해안 복원지",
    subtitle: "계절성 해빈 침식 대응",
    polygon: [[129.193, 35.174], [129.201, 35.171], [129.205, 35.176], [129.198, 35.181], [129.191, 35.179]],
    soil: "중립사 우세",
    grain: "요구 입도 0.25–0.62 mm",
    volume: 123000,
    erosionRate: 1.2,
    matchScore: 84,
  },
];

export const initialProject: ProjectState = {
  selectedDepositId: "busan-new-port-a",
  selectedErosionId: "dadaepo-erosion",
  dredgePolygon: [[128.815, 35.064], [128.823, 35.062], [128.827, 35.067], [128.820, 35.070], [128.814, 35.068]],
  restorationPolygon: [[128.963, 35.050], [128.971, 35.049], [128.974, 35.053], [128.968, 35.056], [128.962, 35.054]],
  dredgeDepth: 2.8,
  fillThickness: 1.4,
};
