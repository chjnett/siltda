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
  demo_data?: boolean;
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

const demoErosionRisk: Record<string, ErosionRiskResult> = {
  "26380002": {
    site_id: "26380002",
    site_name: "다대포 해수욕장 동측지구",
    observed_history: {
      n_intervals: 5,
      first_year: 2019,
      last_year: 2024,
      long_term_loss_pct_per_year: 1.8,
      recent_loss_pct_per_year: 2.6,
      recent_period: [2022, 2024],
      last_interval: { start_year: 2023, end_year: 2024, loss_pct_per_year: 3.1 },
      latest_area_m2: 118500,
    },
    observed_risk: "medium",
    observed_risk_basis: "해커톤 시연용 가상 관측 이력",
    predicted_annual_area_loss_pct: 2.2,
    erosion_risk: "medium",
    risk_label_is_heuristic: true,
    risk_rule_note: "1% 미만 낮음, 1–3% 보통, 3% 초과 높음의 임시 규칙",
    synthetic_model: true,
    data_origin: ["siltDA 시연용 합성 데이터"],
    outside_training_year_range: false,
    training_year_range: [2019, 2024],
    model: "Demo LightGBM Huber",
    model_version: "0.1-demo",
    model_beats_baseline: false,
    horizon_years_used: 3,
    inputs_from_site_profile: ["가상 백사장 면적", "가상 파고", "가상 해수면 변화"],
    input_source: "demo",
    missing_features_imputed: ["해안 경사", "태풍 이력"],
    ignored_inputs: [],
    unavailable_features: ["실측 수심 격자"],
    note: "발표 화면 검증을 위한 더미 결과이며 실제 침식 예측이 아닙니다.",
    demo_data: true,
  },
  "26350002": {
    site_id: "26350002",
    site_name: "송정 해수욕장",
    observed_history: {
      n_intervals: 5,
      first_year: 2019,
      last_year: 2024,
      long_term_loss_pct_per_year: 3.4,
      recent_loss_pct_per_year: 4.1,
      recent_period: [2022, 2024],
      last_interval: { start_year: 2023, end_year: 2024, loss_pct_per_year: 4.5 },
      latest_area_m2: 76400,
    },
    observed_risk: "high",
    observed_risk_basis: "해커톤 시연용 가상 관측 이력",
    predicted_annual_area_loss_pct: 3.7,
    erosion_risk: "high",
    risk_label_is_heuristic: true,
    risk_rule_note: "1% 미만 낮음, 1–3% 보통, 3% 초과 높음의 임시 규칙",
    synthetic_model: true,
    data_origin: ["siltDA 시연용 합성 데이터"],
    outside_training_year_range: false,
    training_year_range: [2019, 2024],
    model: "Demo LightGBM Huber",
    model_version: "0.1-demo",
    model_beats_baseline: false,
    horizon_years_used: 3,
    inputs_from_site_profile: ["가상 백사장 면적", "가상 파고", "가상 해수면 변화"],
    input_source: "demo",
    missing_features_imputed: ["해안 경사", "양빈 이력"],
    ignored_inputs: [],
    unavailable_features: ["실측 수심 격자"],
    note: "발표 화면 검증을 위한 더미 결과이며 실제 침식 예측이 아닙니다.",
    demo_data: true,
  },
};

export function getDemoErosionRisk(siteId: string): ErosionRiskResult {
  return demoErosionRisk[siteId] ?? demoErosionRisk["26380002"];
}

export class ErosionRiskError extends Error {
  constructor(message: string, readonly kind: "not-configured" | "network" | "insufficient-data" | "no-area-history" | "model-unavailable" | "server") {
    super(message);
  }
}

export async function fetchErosionRisk(siteId: string, signal?: AbortSignal): Promise<ErosionRiskResult> {
  if (!ML_API_URL) return getDemoErosionRisk(siteId);
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
    const body = await response.json().catch(() => null) as { detail?: { message?: string; code?: string } } | null;
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
