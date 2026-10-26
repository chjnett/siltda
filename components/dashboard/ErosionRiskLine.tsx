"use client";

import { useEffect, useState } from "react";
import { ErosionRiskError, erosionSiteMapping, fetchErosionRisk, riskLabelKo, type ErosionRiskResult } from "@/lib/erosionRisk";
import { Pill } from "./ui";

type State =
  | { status: "unmapped" }
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "ok"; result: ErosionRiskResult };

/**
 * 침식 위험등급. 기존 ML API(lib/erosionRisk.ts)가 연결되고 공개 자료와 매핑된 후보지에서만 값을 표시하며,
 * 그 외에는 예측값을 만들어 내지 않고 사유를 보여준다.
 */
export default function ErosionRiskLine({ studioCandidateId }: { studioCandidateId?: string }) {
  const mapping = studioCandidateId ? erosionSiteMapping[studioCandidateId] : undefined;
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
        setState({ status: "unavailable", message: error instanceof ErosionRiskError ? error.message : "예측 결과를 불러오지 못했습니다." });
      });
    return () => controller.abort();
  }, [mapping]);

  switch (state.status) {
    case "unmapped":
      return <span className="dash-muted">예측 대상 아님 (공개 자료 매핑 없음)</span>;
    case "loading":
      return <span className="dash-muted">예측 확인 중…</span>;
    case "unavailable":
      return <span className="dash-muted">예측 서버 미연결 · {state.message}</span>;
    case "ok":
      return (
        <span>
          <Pill tone={state.result.erosion_risk === "high" ? "amber" : "blue"}>{riskLabelKo[state.result.erosion_risk]}</Pill>
          {(state.result.synthetic_model || state.result.risk_label_is_heuristic) && <span className="dash-muted"> 합성 모델·휴리스틱 등급(시연용)</span>}
        </span>
      );
  }
}
