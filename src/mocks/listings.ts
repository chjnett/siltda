import type { Listing, MovementStep, PermitStep, Quality, Stage, Verification } from "@/src/types";
import { mockPorts } from "./ports";

/** 시연용 준설토 매물. 물량·품질·일정은 모두 임의의 시연 값이다. */

type QualityRow = [sand: number, silt: number, clay: number, medianMm: number, salinity: number, cu: number, pb: number, zn: number, cd: number];

const q = ([sandPct, siltPct, clayPct, medianMm, salinityPsu, cu, pb, zn, cd]: QualityRow): Quality => ({
  sandPct, siltPct, clayPct, medianMm, salinityPsu,
  contaminants: [{ key: "cu", value: cu }, { key: "pb", value: pb }, { key: "zn", value: zn }, { key: "cd", value: cd }],
});

const SAND: QualityRow = [88, 9, 3, 0.32, 32, 38, 34, 105, 0.5];
const SAND_FINE: QualityRow = [86, 11, 3, 0.2, 31, 36, 33, 100, 0.5];
const SAND_SILTY: QualityRow = [82, 14, 4, 0.28, 33, 45, 40, 130, 0.7];
const SAND_WIDE: QualityRow = [90, 8, 2, 0.45, 32, 32, 30, 95, 0.4];
const MIX: QualityRow = [55, 35, 10, 0.18, 34, 52, 48, 160, 0.9];
const SILT: QualityRow = [30, 50, 20, 0.06, 35, 60, 55, 185, 1.2];
const DIRTY: QualityRow = [75, 18, 7, 0.25, 33, 118, 72, 260, 2.1];
const DIRTY_MILD: QualityRow = [78, 16, 6, 0.27, 33, 80, 66, 215, 1.1];

const permitSteps = ["해양환경 영향 사전검토", "퇴적물 품질 조사", "활용 계획 협의", "관계기관 인허가", "운반·투기 신고"];
/** d=완료, p=진행, t=미착수 */
const permits = (pattern: string): PermitStep[] =>
  permitSteps.map((label, i) => ({ label, status: pattern[i] === "d" ? "done" : pattern[i] === "p" ? "progress" : "todo" }));

const movements = (portName: string, volumeM3: number, ds: number, de: number): MovementStep[] => [
  { phase: "dredge", place: portName, monthOffset: ds, volumeM3 },
  { phase: "stockpile", place: "임시적치장(필요 시 지정)", monthOffset: de, volumeM3 },
  { phase: "transport", place: "해상운송(복원지 확정 후)", monthOffset: de + 1, volumeM3 },
  { phase: "placement", place: "복원지(매칭 후 확정)", monthOffset: de + 2, volumeM3 },
];

type Row = [id: string, portId: string, project: string, contractor: string, volumeM3: number, ds: number, de: number, stage: Stage, verification: Verification, daysAgo: number, quality: QualityRow, permitPattern: string];

const rows: Row[] = [
  ["L01", "busan-new", "부산신항 항로 유지준설", "A준설사", 182000, 2, 4, "quality", "verified", 2, SAND, "dddpt"],
  ["L02", "busan-north", "북항 부두 전면 수심 확보", "B해양개발", 96000, 3, 5, "matched", "verified", 6, SAND_SILTY, "ddddp"],
  ["L03", "pyeongtaek", "평택·당진항 항로 준설", "C준설사", 150000, -1, 1, "transport", "verified", 20, SAND_FINE, "ddddd"],
  ["L04", "incheon", "인천항 신항 준설", "D해양", 240000, 4, 8, "registered", "unverified", 1, MIX, "ptttt"],
  ["L05", "gunsan", "군산항 항로 정비", "E준설사", 88000, -9, -6, "placed", "verified", 90, SAND, "ddddd"],
  ["L06", "mokpo", "목포항 유지준설", "F해양개발", 62000, 6, 7, "quality", "in-review", 9, SILT, "ddptt"],
  ["L07", "gwangyang", "광양항 준설", "G준설사", 310000, 1, 6, "quality", "verified", 11, SAND_SILTY, "dddpt"],
  ["L08", "ulsan", "울산항 안벽 준설", "H해양", 124000, 5, 6, "registered", "unverified", 3, DIRTY, "ptttt"],
  ["L09", "pohang", "포항 영일만 준설", "I준설사", 74000, 2, 3, "quality", "verified", 5, SAND, "ddddp"],
  ["L10", "donghae", "동해항 방파제 준설", "J해양개발", 53000, 3, 4, "registered", "unverified", 4, SAND_WIDE, "ptttt"],
  ["L11", "daesan", "대산항 항로 준설", "K준설사", 130000, 7, 10, "registered", "unverified", 7, MIX, "ptttt"],
  ["L12", "jeju", "제주항 준설", "L해양", 38000, 2, 2, "quality", "in-review", 13, SAND, "ddptt"],
  ["L13", "busan-new", "부산신항 2단계 배후 준설", "A준설사", 210000, 8, 12, "registered", "unverified", 15, SILT, "ptttt"],
  ["L14", "incheon", "인천항 갑문 준설", "M준설사", 98000, 0, 2, "quality", "verified", 18, DIRTY_MILD, "dddpt"],
  ["L15", "gwangyang", "광양항 컨테이너부두 준설", "G준설사", 175000, 10, 14, "registered", "unverified", 21, SAND_WIDE, "ptttt"],
  ["L16", "pohang", "포항항 북방파제 준설", "N해양개발", 64000, 5, 7, "registered", "unverified", 24, SAND_FINE, "ptttt"],
];

export const mockListings: Listing[] = rows.map(([id, portId, project, contractor, volumeM3, dredgeStart, dredgeEnd, stage, verification, registeredDaysAgo, quality, pattern]) => {
  const portName = mockPorts.find((p) => p.id === portId)?.name ?? portId;
  return {
    id, portId, project, contractor, volumeM3, dredgeStart, dredgeEnd, stage, verification, registeredDaysAgo,
    quality: q(quality), permits: permits(pattern), movements: movements(portName, volumeM3, dredgeStart, dredgeEnd),
  };
});
