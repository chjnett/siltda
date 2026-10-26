const integer = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const two = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const NO_INFO = "정보 없음";
export const fmtInt = (v: number) => integer.format(Math.round(v));
export const fmt1 = (v: number) => one.format(v);
export const fmt2 = (v: number) => two.format(v);
export const fmtM3 = (v: number) => `${fmtInt(v)} m³`;
export const fmtEok = (v: number) => `${fmt2(v)}억원`;
export const fmtPct = (v: number) => `${fmt1(v)}%`;

/** 부족(−)/과잉(+) 부호를 항상 붙인다. 0은 부호 없이 표시. */
export function fmtSigned(v: number, unit = "") {
  const r = Math.round(v);
  if (r === 0) return `0${unit}`;
  return `${r > 0 ? "+" : "−"}${integer.format(Math.abs(r))}${unit}`;
}

export interface BaseMonth { year: number; month: number }
/** 시연 기준월에서 offset개월 뒤의 "YYYY.MM" */
export function monthLabel(base: BaseMonth, offset: number) {
  const total = base.year * 12 + (base.month - 1) + offset;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}.${String(m).padStart(2, "0")}`;
}
export const monthShort = (base: BaseMonth, offset: number) => `${(((base.month - 1 + offset) % 12) + 12) % 12 + 1}월`;
export const monthRange = (base: BaseMonth, a: number, b: number) => (a === b ? monthLabel(base, a) : `${monthLabel(base, a)} ~ ${monthLabel(base, b)}`);

export const stageLabels = { registered: "등록", quality: "품질검증", matched: "매칭", transport: "운송 중", placed: "포설 완료" } as const;
export const stageOrder = ["registered", "quality", "matched", "transport", "placed"] as const;
export const verificationLabels = { unverified: "미검증", "in-review": "검증 중", verified: "검증 완료" } as const;
export const fitLabels = { fit: "적합", conditional: "조건부", unfit: "부적합" } as const;
export const urgencyLabels = { critical: "매우 시급", high: "시급", normal: "보통" } as const;
export const useLabels = { beach: "양빈", tidal: "갯벌·염습지", reclamation: "매립", disposal: "처분" } as const;

/** 부호가 붙은 억원 표기(+1.23억원 / −0.40억원) */
export function fmtSignedEok(v: number) {
  const r = Math.round(v * 100) / 100;
  if (r === 0) return "0.00억원";
  return `${r > 0 ? "+" : "−"}${two.format(Math.abs(r))}억원`;
}
