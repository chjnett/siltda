// Client for the siltDA erosion-risk ML API (separate FastAPI service, see /backend).
// This is independent from the dredge-matching score (`matchScore`) and from any dredge optimiser.

export type ErosionRiskLevel = "low" | "medium" | "high";

export interface ErosionRiskResult {
  site_id: string | null;
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
 * Candidate id -> site code of the public MOF beach-area dataset.
 * The public files carry only an 8-digit site code (first 5 digits = legal-dong district code),
 * not beach names or coordinates, so the mapping is district-level and NOT verified.
 * Candidates without an entry are shown as "prediction unavailable".
 */
export interface SiteMapping {
  siteId: string;
  matchLevel: "district";
  verified: boolean;
  note: string;
}

export const erosionSiteMapping: Record<string, SiteMapping> = {
  "dadaepo-erosion": {
    siteId: "26380002",
    matchLevel: "district",
    verified: false,
    note: "부산 사하구(26380) 내 유일한 공개 관측 지점. 다대포 해수욕장 여부는 미검증.",
  },
  "songjeong-erosion": {
    siteId: "26350001",
    matchLevel: "district",
    verified: false,
    note: "부산 해운대구(26350) 관측 지점. 송정 해변 여부는 미검증.",
  },
};

const configuredUrl = process.env.NEXT_PUBLIC_SILTDA_ML_API_URL;
// Only fall back to localhost during development; a production build must set the HTTPS URL explicitly.
export const ML_API_URL = (configuredUrl || (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000")).replace(/\/$/, "");

export class ErosionRiskError extends Error {
  constructor(message: string, readonly kind: "not-configured" | "network" | "insufficient-data" | "model-unavailable" | "server") {
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
    if (response.status === 422) throw new ErosionRiskError(message, "insufficient-data");
    if (response.status === 503) throw new ErosionRiskError(message, "model-unavailable");
    throw new ErosionRiskError(message, "server");
  }
  return (await response.json()) as ErosionRiskResult;
}

export const riskLabelKo: Record<ErosionRiskLevel, string> = { low: "낮음", medium: "보통", high: "높음" };
