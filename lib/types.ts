export type Coordinate = [number, number];
export type StepId = 1 | 2 | 3;
export type CompareMode = "before" | "after" | "compare" | "section";
export type CandidateKind = "deposit" | "erosion";

export interface CandidateOperation {
  status: string;
  period: string;
  startMonth: number;
  endMonth: number;
  verification: "verified" | "in-review" | "observed";
  use: string;
  finesPct?: number;
  medianMm?: number;
  urgency?: "critical" | "high" | "normal";
}

export interface CandidateSite {
  id: string;
  kind: CandidateKind;
  name: string;
  subtitle: string;
  polygon: Coordinate[];
  soil: string;
  grain: string;
  volume: number;
  erosionRate?: number;
  matchScore: number;
  operation: CandidateOperation;
}

export interface CameraPreset {
  longitude: number;
  latitude: number;
  height: number;
  heading: number;
  pitch: number;
  roll: number;
}

export interface ProjectState {
  selectedDepositId: string | null;
  selectedErosionId: string | null;
  dredgePolygon: Coordinate[];
  restorationPolygon: Coordinate[];
  dredgeDepth: number;
  fillThickness: number;
  savedAt?: string;
}
