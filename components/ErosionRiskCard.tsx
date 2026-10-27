"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ErosionRiskError, erosionSiteMapping, fetchErosionRisk, riskLabelKo,
  type ErosionRiskLevel, type ErosionRiskResult,
} from "@/lib/erosionRisk";

type State =
  | { status: "unmapped" }
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }
  | { status: "ok"; result: ErosionRiskResult };

const signed = (value: number) => `${value > 0 ? "" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}`;

function RiskBadge({ level }: { level: ErosionRiskLevel }) {
  return <Badge variant={level === "high" ? "warning" : "secondary"}>{riskLabelKo[level]}</Badge>;
}

export default function ErosionRiskCard({ candidateId }: { candidateId: string }) {
  const mapping = erosionSiteMapping[candidateId];
  const [state, setState] = useState<State>(mapping ? { status: "loading" } : { status: "unmapped" });

  useEffect(() => {
    if (!mapping) {
      setState({ status: "unmapped" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchErosionRisk(mapping.siteId, controller.signal)
      .then((result) => setState({ status: "ok", result }))
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        if (error instanceof ErosionRiskError && error.kind === "no-area-history") {
          setState({ status: "unavailable", message: "공개 데이터에 이 해변의 백사장 면적 관측 이력이 없어 분석할 수 없습니다." });
          return;
        }
        setState({ status: "error", message: error instanceof ErosionRiskError ? error.message : "알 수 없는 오류" });
      });
    return () => controller.abort();
  }, [mapping]);

  const ok = state.status === "ok" ? state.result : null;
  const obs = ok?.observed_history ?? null;

  return (
    <Card className="selection-card risk-card">
      <span className="card-eyebrow">침식 위험도 분석 · {ok?.demo_data ? "시연 데이터" : "공공데이터"}</span>
      {state.status === "unmapped" && <p>실측 데이터와 연결되지 않은 후보지입니다. <strong>분석 불가</strong></p>}
      {state.status === "loading" && <p>위험도 데이터 준비 중…</p>}
      {state.status === "unavailable" && <p className="risk-error">분석 불가: {state.message}{mapping && ` (${mapping.note})`}</p>}
      {state.status === "error" && <p className="risk-error">조회 실패: {state.message}</p>}

      {ok && (
        <>
          <h3 className="risk-subtitle">① 관측 이력 <small>{ok.demo_data ? "가상 관측" : "실측"} · {ok.site_name ?? ok.site_id}</small></h3>
          {obs ? (
            <>
              <div className="property-grid">
                <div>
                  <small>장기 면적 감소율 ({obs.first_year}–{obs.last_year})</small>
                  <strong>{signed(obs.long_term_loss_pct_per_year)}<i>%/년</i></strong>
                </div>
                <div>
                  <small>침식 등급 (임시 기준)</small>
                  <strong>{ok.observed_risk && <RiskBadge level={ok.observed_risk} />}</strong>
                </div>
              </div>
              <dl>
                <div><dt>마지막 관측 구간</dt><dd>{obs.last_interval.start_year}–{obs.last_interval.end_year} · {signed(obs.last_interval.loss_pct_per_year)}%/년</dd></div>
                <div><dt>관측 구간 수</dt><dd>{obs.n_intervals}개 (+ 감소 / − 증가)</dd></div>
              </dl>
            </>
          ) : <p>관측 이력 없음</p>}

          <h3 className="risk-subtitle">② ML 실험 예측 <small>{ok.demo_data ? "데모 전용" : "참고용"}</small></h3>
          <div className="property-grid">
            <div><small>예상 연 면적 감소율</small><strong>{ok.predicted_annual_area_loss_pct.toFixed(1)}<i>%/년</i></strong></div>
            <div><small>모델 등급 (임시)</small><strong><RiskBadge level={ok.erosion_risk} /></strong></div>
          </div>
          <dl>
            <div><dt>ML 모델</dt><dd>{ok.model} v{ok.model_version}</dd></div>
            <div><dt>데이터 구분</dt><dd>{ok.demo_data ? "합성 더미 데이터 (데모 전용)" : ok.synthetic_model ? "합성 데이터 (데모 전용)" : "실측 공공데이터 학습 · 예측값"}</dd></div>
            <div><dt>예측 기간</dt><dd>{ok.horizon_years_used}년 평균 (연율화)</dd></div>
            <div><dt>누락 입력변수</dt><dd>{ok.missing_features_imputed.length ? ok.missing_features_imputed.join(", ") : "없음 (경사·강수량은 미사용)"}</dd></div>
            <div><dt>데이터 출처</dt><dd>{ok.data_origin.join(", ")}</dd></div>
          </dl>
          <p className="risk-note">
            {ok.demo_data && "현재 값은 화면 시연을 위해 구성한 가상 데이터이며 실제 관측 또는 예측 결과가 아닙니다. "}
            {!ok.model_beats_baseline && "ML 모델은 검증에서 단순 기준 모델(중앙값)보다 나아지지 않아 참고용으로만 표시합니다. "}
            등급은 공식 기준이 아닌 해커톤 임시 규칙이며 확정 판정이 아닙니다. 준설토 적합도(matchScore)와 별개 지표입니다.
            {mapping && ` 지점 매핑: ${mapping.note}`}
          </p>
        </>
      )}
    </Card>
  );
}
