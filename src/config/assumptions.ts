/**
 * 시연용 가정값 모음.
 * 법령·고시상의 품질 기준, 실제 단가, 확정된 가중치가 아니다. 화면에는 항상 "시연용 가정값"으로 표시한다.
 * 실제 값이 정해지면 이 파일만 교체하면 된다.
 */
export const ASSUMPTION_LABEL = "시연용 가정값 — 법령·고시상 확정 기준이 아님";

export const PRODUCT_MESSAGE = {
  title: "싣다(siltDA)",
  summary: "준설토 공급(항만·준설업체)과 연안복원 수요(지자체)의 조정 실패를 해결하는 해양자원 순환 플랫폼",
  flow: "품질 검증 → 매칭 → 운송 → 비용 정산 → 복원 성과 확인",
};

/** 오염 항목별 기준선(가정값, mg/kg) */
export const CONTAMINANTS = [
  { key: "cu", label: "구리(Cu)", unit: "mg/kg", limit: 65 },
  { key: "pb", label: "납(Pb)", unit: "mg/kg", limit: 60 },
  { key: "zn", label: "아연(Zn)", unit: "mg/kg", limit: 200 },
  { key: "cd", label: "카드뮴(Cd)", unit: "mg/kg", limit: 1.5 },
] as const;

/**
 * 용도별 기준(가정값)
 * - finesPct = 실트+점토 비율(%)
 * - contaminantFactor: 오염 기준선의 배수(이 배수 이하면 적합, ×conditionalMargin 이하면 조건부)
 */
export const USE_CRITERIA = {
  beach: { label: "양빈", maxFinesPct: 15, conditionalFinesPct: 25, medianMm: [0.15, 0.6] as [number, number], contaminantFactor: 1.0, maxSalinityPsu: 36 },
  tidal: { label: "갯벌·염습지 복원", minFinesPct: 30, conditionalFinesPct: 20, contaminantFactor: 1.0, maxSalinityPsu: 40 },
  reclamation: { label: "매립", contaminantFactor: 1.5, maxSalinityPsu: 45 },
  disposal: { label: "처분", contaminantFactor: Infinity, maxSalinityPsu: Infinity },
} as const;
export const CONDITIONAL_MARGIN = 1.25;

/** 매칭 점수 가중치(합 1.0, 가정값) */
export const MATCH_WEIGHTS = { quality: 0.4, schedule: 0.25, distance: 0.2, volume: 0.15 } as const;
/** 거리 점수: 이 거리(km)에서 0점 */
export const DISTANCE_ZERO_KM = 600;
/** 일정 점수: 임시적치 1개월당 감점 */
export const SCHEDULE_PENALTY_PER_MONTH = 12;

/** 경제성 단가(가정값) */
export const DEFAULT_COSTS = {
  /** 공급자가 처분 대신 활용할 때 회피하는 처분비 (원/m³) */
  disposalPerM3: 16000,
  /** 수요자가 구매하는 복원용 모래 단가 (원/m³) */
  sandPurchasePerM3: 29000,
  /** 해상·육상 운송 단가 (원/m³·km) */
  transportPerM3Km: 85,
  /** 품질검사 고정비 (억원) + 변동비 (원/m³) */
  inspectionFixedEok: 0.2,
  inspectionPerM3: 300,
  /** 임시적치비 (원/m³·월) */
  storagePerM3Month: 1200,
  /** 장거리 운송(대안 C) 거리 배수 */
  longHaulFactor: 2.2,
  /** 공급자 몫 기본값 */
  supplierShare: 0.4,
};

/** 해상 작업 가능 기준(가정값). 일 최대값 기준. */
export const WORK_LIMITS = {
  dredge: { label: "준설", windMs: 10, waveM: 1.5, rainMm: 20 },
  transport: { label: "해상운송", windMs: 12, waveM: 2.0, rainMm: 30 },
  placement: { label: "포설", windMs: 8, waveM: 1.0, rainMm: 10 },
} as const;
/** 기준을 이 배수까지 넘으면 '주의', 그 이상이면 '불가' */
export const WORK_CAUTION_MARGIN = 1.25;

/** 신호/판정 임계값 */
export const SIGNAL = {
  /** 이 개월 수를 넘는 임시적치는 '권장'이 아니라 위험으로 본다 */
  maxStorageMonths: 6,
};

/** HOME 타임라인에서 '어긋남'으로 보는 월별 공급/수요 비율 */
export const TIMELINE_MISMATCH_RATIO = 1.6;
