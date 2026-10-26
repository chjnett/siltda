// Client for the siltDA erosion-risk ML API (separate FastAPI service, see /backend).
// This is independent from the dredge-matching score (`matchScore`) and from any dredge optimiser.

export type ErosionRiskLevel = "low" | "medium" | "high";

export interface ObservedHistory {
  n_intervals: number;
  first_year: number;
  last_year: number;
  long_term_loss_pct_per_year: number; // signed, positive = beach area lost
  recent_loss_pct_per_year: number;
  recent_period: [number, number];
  last_interval: { start_year: number; end_year: number; loss_pct_per_year: number };
  latest_area_m2: number;
}

export interface ErosionRiskResult {
  site_id: string | null;
  site_name: string | null;
  observed_history: ObservedHistory | null;
  observed_risk: ErosionRiskLevel | null;
  observed_risk_basis: string | null;
  predicted_annual_area_loss_pct: number;
  erosion_risk: ErosionRiskLevel;
  risk_label_is_heuristic: boolean;
  risk_rule_note: string;
  synthetic_model: boolean;
  data_origin: string[];
  outside_training_year_range: boolean;
  training_year_range: [number, number];
  model: string;
  model_version: string;
  model_beats_baseline: boolean;
  horizon_years_used: number;
  inputs_from_site_profile: string[];
  input_source: string;
  missing_features_imputed: string[];
  ignored_inputs: string[];
  unavailable_features: string[];
  note: string;
}

/**
 * Candidate id -> site code of the public MOF coastal-erosion datasets.
 * Verified by beach NAME against the MOF survey-status table (data.go.kr 15126860); the public
 * files carry no coordinates, so matching is by name, not by polygon position.
 * Candidates without an entry are shown as "prediction unavailable".
 */
export interface SiteMapping {
  siteId: string;
  verified: boolean;
  note: string;
}

export const erosionSiteMapping: Record<string, SiteMapping> = {
  "dadaepo-erosion": {
    siteId: "26380002",
    verified: true,
    note: "공공데이터 지점명 '다대포 해수욕장 동측지구'와 이름 기준 일치(좌표 대조는 아님).",
  },
  "songjeong-erosion": {
    siteId: "26350002",
    verified: true,
    note: "공공데이터 지점명 '송정 해수욕장'과 이름 기준 일치. 단, 백사장 면적 관측 이력은 공개 자료에 없음.",
  },
};

const configuredUrl = process.env.NEXT_PUBLIC_SILTDA_ML_API_URL;
// Only fall back to localhost during development; a production build must set the HTTPS URL explicitly.
export const ML_API_URL = (configuredUrl || (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000")).replace(/\/$/, "");

export class ErosionRiskError extends Error {
  constructor(message: string, readonly kind: "not-configured" | "network" | "insufficient-data" | "no-area-history" | "model-unavailable" | "server") {
    super(message);
  }
}

export async function fetchErosionRisk(siteId: string, signal?: AbortSignal): Promise<ErosionRiskResult> {
  if (!ML_API_URL) throw new ErosionRiskError("ML 서버 주소(NEXT_PUBLIC_SILTDA_ML_API_URL)가 설정되지 않았습니다.", "not-configured");
  let response: Response;
  try {
    response = await fetch(`${ML_API_URL}/api/ml/erosion-risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId }),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ErosionRiskError("ML 서버에 연결할 수 없습니다.", "network");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message: string = body?.detail?.message ?? `ML 서버 오류 (${response.status})`;
    if (response.status === 422) {
      throw new ErosionRiskError(message, body?.detail?.code === "NO_AREA_HISTORY" ? "no-area-history" : "insufficient-data");
    }
    if (response.status === 503) throw new ErosionRiskError(message, "model-unavailable");
    throw new ErosionRiskError(message, "server");
  }
  return (await response.json()) as ErosionRiskResult;
}

export const riskLabelKo: Record<ErosionRiskLevel, string> = { low: "낮음", medium: "보통", high: "높음" };
