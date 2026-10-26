import { DEFAULT_COSTS } from "@/src/config/assumptions";
import type { AlternativeId } from "@/src/types";

export type CostParams = typeof DEFAULT_COSTS;
const EOK = 1e8;

export interface AltItems {
  avoidedDisposal: number;
  materialSaving: number;
  transport: number;
  inspection: number;
  storage: number;
}

export interface AltResult {
  id: AlternativeId;
  label: string;
  description: string;
  /** 일정·물리적으로 실행할 수 있는지 */
  feasible: boolean;
  /** 실행 비권장 = 순편익 ≤ 0 이거나 실행 불가 */
  recommended: boolean;
  items: AltItems;
  netEok: number;
  notes: string[];
  /** 기준선(D)에서 공급자·수요자가 기존에 쓰는 비용(억원) */
  baseline?: { disposal: number; purchase: number };
}

export interface EconomicsInput {
  volumeM3: number;
  distanceKm: number;
  /** 준설이 복원 시작보다 먼저 끝나 적치해야 하는 개월 수 */
  storageMonths: number;
  /** 준설이 복원 종료 후에 시작해 맞출 수 없는 개월 수 */
  lateMonths: number;
  params?: CostParams;
}

const eok = (won: number) => won / EOK;

export function evaluateAlternatives({ volumeM3: v, distanceKm: km, storageMonths, lateMonths, params = DEFAULT_COSTS }: EconomicsInput): AltResult[] {
  const avoided = eok(v * params.disposalPerM3);
  const saving = eok(v * params.sandPurchasePerM3);
  const inspection = params.inspectionFixedEok + eok(v * params.inspectionPerM3);
  const transport = (factor: number) => eok(v * km * factor * params.transportPerM3Km);
  const storage = (months: number) => eok(v * months * params.storagePerM3Month);

  const make = (id: AlternativeId, label: string, description: string, feasible: boolean, items: AltItems, notes: string[]): AltResult => {
    const netEok = items.avoidedDisposal + items.materialSaving - items.transport - items.inspection - items.storage;
    return { id, label, description, feasible, recommended: feasible && netEok > 0, items, netEok, notes };
  };

  const directOk = storageMonths === 0 && lateMonths === 0;
  const a = make("A", "직송", "준설 직후 복원지로 직접 운송", directOk,
    { avoidedDisposal: avoided, materialSaving: saving, transport: transport(1), inspection, storage: 0 },
    directOk ? [] : [lateMonths > 0 ? `일정상 불가: 준설이 복원 종료 ${lateMonths}개월 뒤에 시작` : `일정상 불가: 준설이 ${storageMonths}개월 먼저 끝남(적치 필요)`]);

  const stockMonths = Math.max(storageMonths, 1);
  const b = make("B", "임시적치 후 공급", "임시적치장에 보관했다가 복원 시기에 맞춰 공급", lateMonths === 0,
    { avoidedDisposal: avoided, materialSaving: saving, transport: transport(1), inspection, storage: storage(stockMonths) },
    lateMonths > 0 ? [`일정상 불가: 준설이 복원 종료 ${lateMonths}개월 뒤에 시작`] : storageMonths === 0 ? ["적치가 필수는 아니며, 최소 1개월 완충 적치를 가정"] : [`임시적치 ${storageMonths}개월`]);

  const c = make("C", "장거리 운송", `다른 공급원에서 ×${params.longHaulFactor} 거리로 운송(일정 제약 없음 가정)`, true,
    { avoidedDisposal: avoided, materialSaving: saving, transport: transport(params.longHaulFactor), inspection, storage: 0 },
    ["원거리 대체 공급원을 가정한 값"]);

  const d: AltResult = {
    id: "D", label: "기존 처분(기준선)", description: "공급자는 처분, 수요자는 모래 구매를 계속하는 현재 방식", feasible: true, recommended: false,
    items: { avoidedDisposal: 0, materialSaving: 0, transport: 0, inspection: 0, storage: 0 },
    netEok: 0, notes: ["비교 기준선(순편익 0)"],
    baseline: { disposal: avoided, purchase: saving },
  };
  return [a, b, c, d];
}

export const bestAlternative = (alts: AltResult[]) =>
  alts.filter((x) => x.id !== "D" && x.recommended).sort((p, q) => q.netEok - p.netEok)[0] ?? null;

export interface Settlement {
  supplierNet: number;
  demanderNet: number;
  /** 수요자가 공급자에게 지불(+) / 공급자가 수요자에게 지불(−) */
  transferToSupplier: number;
  supplierBorne: number;
  demanderBorne: number;
}

/**
 * 정산: 순편익을 공급자:수요자 = share:(1−share)로 나눈다.
 * 가정 — 공급자가 품질검사비·적치비를, 수요자가 운송비를 부담하고, 차액은 정산금으로 이전한다.
 */
export function settle(alt: AltResult, supplierShare: number): Settlement {
  const supplierBorne = alt.items.inspection + alt.items.storage;
  const demanderBorne = alt.items.transport;
  const supplierNet = supplierShare * alt.netEok;
  const demanderNet = alt.netEok - supplierNet;
  const transferToSupplier = supplierNet - (alt.items.avoidedDisposal - supplierBorne);
  return { supplierNet, demanderNet, transferToSupplier, supplierBorne, demanderBorne };
}
