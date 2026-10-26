export type LonLat = [number, number];

export type UseKind = "beach" | "tidal" | "reclamation" | "disposal";
export type Fit = "fit" | "conditional" | "unfit";
export type Verification = "unverified" | "in-review" | "verified";
export type Stage = "registered" | "quality" | "matched" | "transport" | "placed";
export type AlternativeId = "A" | "B" | "C" | "D";
export type Urgency = "critical" | "high" | "normal";

export interface Port {
  id: string;
  name: string;
  region: string;
  coordinate: LonLat;
}

export interface Contaminant {
  key: string;
  value: number;
}

export interface Quality {
  sandPct: number;
  siltPct: number;
  clayPct: number;
  medianMm: number;
  salinityPsu: number;
  contaminants: Contaminant[];
}

export interface PermitStep {
  label: string;
  status: "done" | "progress" | "todo";
}

export interface MovementStep {
  phase: "dredge" | "stockpile" | "transport" | "placement";
  place: string;
  /** 시연 기준월(0 = 이번 달)로부터의 월 오프셋 */
  monthOffset: number;
  volumeM3: number;
}

export interface Listing {
  id: string;
  portId: string;
  project: string;
  contractor: string;
  volumeM3: number;
  /** 준설 시작/종료 — 시연 기준월(0 = 이번 달)로부터의 월 오프셋 */
  dredgeStart: number;
  dredgeEnd: number;
  stage: Stage;
  verification: Verification;
  /** 등록 후 경과 일수(최근 등록 정렬용) */
  registeredDaysAgo: number;
  quality: Quality;
  permits: PermitStep[];
  movements: MovementStep[];
}

export interface ShorelineModel {
  /** 해안선 방향(나침반 방위, 도) */
  axisDeg: number;
  /** 육지 쪽 방향(나침반 방위, 도) */
  landwardDeg: number;
  lengthM: number;
  /** 연도별 기준 해안선 대비 육지 쪽 후퇴량(m) */
  retreatM: Array<{ year: number; m: number }>;
}

export interface MrvSnapshot {
  label: string;
  shorelineChangeM: number;
  areaChangeM2: number;
  volumeChangeM3: number;
}

export interface Site {
  id: string;
  name: string;
  region: string;
  coordinate: LonLat;
  /** open: 수요 발생 중, completed: 복원 완료(성과 확인 대상) */
  status: "open" | "completed";
  urgency: Urgency;
  areaM2: number;
  thicknessM: number;
  lossFactor: number;
  /** 복원 필요 시기 — 시연 기준월 오프셋 */
  needStart: number;
  needEnd: number;
  detection: string[];
  /** 복원 용도(품질 판정에 사용) */
  use: Exclude<UseKind, "disposal" | "reclamation">;
  requirement: { maxFinesPct: number; medianMm: [number, number] };
  shoreline: ShorelineModel;
  mrv: MrvSnapshot[];
  /** 3D 스튜디오 후보지 id — 있으면 침식 위험도 ML 매핑과 연결 */
  studioCandidateId?: string;
}

export interface Stockpile {
  id: string;
  name: string;
  coordinate: LonLat;
  capacityM3: number;
}

export interface Deal {
  id: string;
  listingId: string;
  siteId: string;
  volumeM3: number;
  alternative: Exclude<AlternativeId, "D">;
  netBenefitEok: number;
  /** 공급자 몫(0~1) */
  supplierShare: number;
  stage: Stage;
  createdAtLabel: string;
}

export interface Dataset {
  ports: Port[];
  listings: Listing[];
  sites: Site[];
  stockpiles: Stockpile[];
  deals: Deal[];
}
