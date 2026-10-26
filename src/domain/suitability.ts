import { CONDITIONAL_MARGIN, CONTAMINANTS, USE_CRITERIA } from "@/src/config/assumptions";
import type { Fit, Quality, UseKind } from "@/src/types";

export interface Judgement {
  use: UseKind;
  fit: Fit;
  reasons: string[];
}

export interface SiteRequirement {
  maxFinesPct?: number;
  medianMm?: [number, number];
}

const worst = (a: Fit, b: Fit): Fit => (a === "unfit" || b === "unfit" ? "unfit" : a === "conditional" || b === "conditional" ? "conditional" : "fit");
export const finesPct = (q: Quality) => q.siltPct + q.clayPct;

/** 오염 항목별 기준선 배수 판정. 용도의 contaminantFactor 이하 = 적합, ×1.25 이하 = 조건부. */
export function judgeContaminants(q: Quality, factor: number): { fit: Fit; reasons: string[] } {
  let fit: Fit = "fit";
  const reasons: string[] = [];
  for (const item of CONTAMINANTS) {
    const value = q.contaminants.find((c) => c.key === item.key)?.value;
    if (value === undefined) continue;
    const limit = item.limit * factor;
    if (value <= limit) continue;
    const level: Fit = value <= limit * CONDITIONAL_MARGIN ? "conditional" : "unfit";
    fit = worst(fit, level);
    reasons.push(`${item.label} ${value}${item.unit} > 기준선 ${limit.toFixed(limit < 10 ? 2 : 0)}${item.unit}(가정값)`);
  }
  return { fit, reasons };
}

/** 용도별 적합성 판정. site 요구 조건이 있으면 양빈 입도 기준을 덮어쓴다. */
export function judgeUse(q: Quality, use: UseKind, requirement: SiteRequirement = {}): Judgement {
  const fines = finesPct(q);
  const reasons: string[] = [];
  let fit: Fit = "fit";

  if (use === "disposal") return { use, fit: "fit", reasons: ["처분은 품질 제한이 가장 낮은 기준선(대안 D)입니다."] };

  const crit = USE_CRITERIA[use];
  const cont = judgeContaminants(q, crit.contaminantFactor);
  fit = worst(fit, cont.fit);
  reasons.push(...cont.reasons);

  if (q.salinityPsu > crit.maxSalinityPsu) {
    const level: Fit = q.salinityPsu <= crit.maxSalinityPsu * 1.1 ? "conditional" : "unfit";
    fit = worst(fit, level);
    reasons.push(`염분 ${q.salinityPsu} psu > ${crit.maxSalinityPsu} psu(가정값)`);
  }

  if (use === "beach") {
    const max = requirement.maxFinesPct ?? USE_CRITERIA.beach.maxFinesPct;
    const cond = Math.max(max + 10, USE_CRITERIA.beach.conditionalFinesPct);
    if (fines > max) {
      const level: Fit = fines <= cond ? "conditional" : "unfit";
      fit = worst(fit, level);
      reasons.push(`실트·점토 ${fines}% > 양빈 기준 ${max}% (조건부 허용 ${cond}% 이하)`);
    }
    const [lo, hi] = requirement.medianMm ?? USE_CRITERIA.beach.medianMm;
    if (q.medianMm < lo || q.medianMm > hi) {
      fit = worst(fit, "conditional");
      reasons.push(`중앙입경 ${q.medianMm} mm가 요구 범위 ${lo}–${hi} mm 밖`);
    }
  } else if (use === "tidal") {
    const crit2 = USE_CRITERIA.tidal;
    if (fines < crit2.minFinesPct) {
      const level: Fit = fines >= crit2.conditionalFinesPct ? "conditional" : "unfit";
      fit = worst(fit, level);
      reasons.push(`실트·점토 ${fines}% < 갯벌·염습지 기준 ${crit2.minFinesPct}% (조건부 ${crit2.conditionalFinesPct}% 이상)`);
    }
  }

  if (reasons.length === 0) reasons.push("모든 항목이 용도별 기준선(가정값) 이내입니다.");
  return { use, fit, reasons };
}

export const allUses: UseKind[] = ["beach", "tidal", "reclamation", "disposal"];
export const judgeAll = (q: Quality) => allUses.map((u) => judgeUse(q, u));

/** 적합 용도 배지: 처분을 제외하고 '적합'인 용도(없으면 '조건부'). */
export function suitableUses(q: Quality): UseKind[] {
  const results = allUses.filter((u) => u !== "disposal").map((u) => judgeUse(q, u));
  const fits = results.filter((r) => r.fit === "fit").map((r) => r.use);
  if (fits.length) return fits;
  const cond = results.filter((r) => r.fit === "conditional").map((r) => r.use);
  return cond.length ? cond : ["disposal"];
}

export type GrainClass = "sand" | "silty-sand" | "mixed" | "silt";
export const grainClassLabels: Record<GrainClass, string> = { sand: "사질(모래)", "silty-sand": "실트질 모래", mixed: "혼합질", silt: "실트·점토질" };
export function grainClass(q: Quality): GrainClass {
  const fines = finesPct(q);
  if (fines <= 10) return "sand";
  if (fines <= 25) return "silty-sand";
  if (fines <= 60) return "mixed";
  return "silt";
}
