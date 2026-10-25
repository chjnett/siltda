"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ErosionRiskError, erosionSiteMapping, fetchErosionRisk, riskLabelKo,
  type ErosionRiskResult,
} from "@/lib/erosionRisk";

type State =
  | { status: "unmapped" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; result: ErosionRiskResult };

function originLabel(result: ErosionRiskResult) {
  return result.synthetic_model ? "합성 데이터 (데모 전용)" : "실측 공공데이터 학습 · 예측값";
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
        setState({ status: "error", message: error instanceof ErosionRiskError ? error.message : "알 수 없는 오류" });
      });
    return () => controller.abort();
  }, [mapping]);

  return (
    <Card className="selection-card risk-card">
      <span className="card-eyebrow">침식 위험도 · ML 실험 예측</span>
      {state.status === "unmapped" && (
        <p>실측 데이터와 연결되지 않은 후보지입니다. <strong>예측 불가</strong></p>
      )}
      {state.status === "loading" && <p>ML 서버에서 예측 중…</p>}
      {state.status === "error" && <p className="risk-error">예측 실패: {state.message}</p>}
      {state.status === "ok" && (
        <>
          <div className="property-grid">
            <div><small>연간 백사장 면적 감소율</small><strong>{state.result.predicted_annual_area_loss_pct.toFixed(1)}<i>%/년</i></strong></div>
            <div>
              <small>침식 위험등급 (임시 기준)</small>
              <strong><Badge variant={state.result.erosion_risk === "high" ? "warning" : "secondary"}>{riskLabelKo[state.result.erosion_risk]}</Badge></strong>
            </div>
          </div>
          <dl>
            <div><dt>ML 모델</dt><dd>{state.result.model} v{state.result.model_version}</dd></div>
            <div><dt>데이터 구분</dt><dd>{originLabel(state.result)}</dd></div>
            <div><dt>데이터 출처</dt><dd>{state.result.data_origin.join(", ")}</dd></div>
            <div><dt>예측 기간</dt><dd>{state.result.horizon_years_used}년 평균 (연율화)</dd></div>
            <div><dt>누락 입력변수</dt><dd>{state.result.missing_features_imputed.length ? state.result.missing_features_imputed.join(", ") : "없음 (파고·경사·강수량은 미사용)"}</dd></div>
          </dl>
          <p className="risk-note">
            {mapping?.verified === false && `지점 매핑 미검증(지역 단위): ${mapping.note} `}
            {!state.result.model_beats_baseline && "검증에서 기준 모델 대비 개선이 없었습니다. "}
            위험등급은 공식 기준이 아닌 해커톤 임시 규칙이며, 확정 판정이 아닙니다. 준설토 적합도(matchScore)와 별개의 지표입니다.
          </p>
        </>
      )}
    </Card>
  );
}
