"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { loadDataset } from "@/src/data/dataset";
import type { BaseMonth } from "@/src/domain/format";
import { stageOrder } from "@/src/domain/format";
import { computeOverview, type Overview } from "@/src/domain/overview";
import type { AlternativeId, Dataset, Deal, Stage } from "@/src/types";

/** 서버/클라이언트 첫 렌더를 같게 하기 위한 고정 기준월. 마운트 후 실제 현재 월로 바뀐다. */
const FALLBACK_BASE: BaseMonth = { year: 2026, month: 10 };

interface State {
  data: Dataset;
  base: BaseMonth;
  selectedListingId: string | null;
  selectedSiteId: string;
  passportId: string | null;
  stageFilter: Stage | null;
  simulatorOpen: boolean;
  /** 매칭 확정 직후 진행 바 애니메이션 */
  confirming: { dealId: string; pct: number } | null;
  /** 마지막으로 확정된 거래(지도 경로 강조용) */
  lastDealId: string | null;
}

type Action =
  | { type: "base"; base: BaseMonth }
  | { type: "selectListing"; id: string | null }
  | { type: "selectSite"; id: string }
  | { type: "passport"; id: string | null }
  | { type: "stageFilter"; stage: Stage | null }
  | { type: "simulator"; open: boolean }
  | { type: "confirm"; deal: Deal }
  | { type: "progress"; pct: number }
  | { type: "dealStage"; dealId: string; stage: Stage }
  | { type: "reset" };

const initialState = (): State => ({
  data: loadDataset(),
  base: FALLBACK_BASE,
  selectedListingId: "L01",
  selectedSiteId: "dadaepo",
  passportId: null,
  stageFilter: null,
  simulatorOpen: false,
  confirming: null,
  lastDealId: null,
});

const rank = (s: Stage) => stageOrder.indexOf(s);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "base": return { ...state, base: action.base };
    case "selectListing": return { ...state, selectedListingId: action.id };
    case "selectSite": return { ...state, selectedSiteId: action.id };
    case "passport": return { ...state, passportId: action.id };
    case "stageFilter": return { ...state, stageFilter: action.stage };
    case "simulator": return { ...state, simulatorOpen: action.open };
    case "confirm": {
      const listings = state.data.listings.map((l) => (l.id === action.deal.listingId && rank(l.stage) < rank("matched") ? { ...l, stage: "matched" as Stage } : l));
      return {
        ...state,
        data: { ...state.data, listings, deals: [...state.data.deals, action.deal] },
        confirming: { dealId: action.deal.id, pct: 0 },
        lastDealId: action.deal.id,
      };
    }
    case "progress": return state.confirming ? { ...state, confirming: { ...state.confirming, pct: action.pct } } : state;
    case "dealStage": {
      const deals = state.data.deals.map((d) => (d.id === action.dealId ? { ...d, stage: action.stage } : d));
      const deal = deals.find((d) => d.id === action.dealId);
      const listings = state.data.listings.map((l) => (deal && l.id === deal.listingId && rank(l.stage) < rank(action.stage) ? { ...l, stage: action.stage } : l));
      return { ...state, data: { ...state.data, deals, listings }, confirming: null };
    }
    case "reset": return { ...initialState(), base: state.base };
  }
}

export interface ConfirmInput {
  listingId: string;
  siteId: string;
  volumeM3: number;
  alternative: Exclude<AlternativeId, "D">;
  netBenefitEok: number;
  supplierShare: number;
}

interface StoreValue {
  state: State;
  overview: Overview;
  selectListing: (id: string | null) => void;
  selectSite: (id: string) => void;
  openPassport: (id: string | null) => void;
  setStageFilter: (stage: Stage | null) => void;
  setSimulatorOpen: (open: boolean) => void;
  confirmDeal: (input: ConfirmInput) => string;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function DealStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const dealCounter = useRef(state.data.deals.length);

  useEffect(() => {
    const now = new Date();
    dispatch({ type: "base", base: { year: now.getFullYear(), month: now.getMonth() + 1 } });
  }, []);

  // 매칭 확정 후 진행 바를 채우고, 끝나면 '운송 중'으로 전환
  const confirmingId = state.confirming?.dealId ?? null;
  useEffect(() => {
    if (!confirmingId) return;
    let pct = 0;
    const timer = setInterval(() => {
      pct = Math.min(100, pct + 5);
      dispatch({ type: "progress", pct });
      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(() => dispatch({ type: "dealStage", dealId: confirmingId, stage: "transport" }), 400);
      }
    }, 70);
    return () => clearInterval(timer);
  }, [confirmingId]);

  const overview = useMemo(() => computeOverview(state.data, state.base), [state.data, state.base]);

  const selectListing = useCallback((id: string | null) => dispatch({ type: "selectListing", id }), []);
  const selectSite = useCallback((id: string) => dispatch({ type: "selectSite", id }), []);
  const openPassport = useCallback((id: string | null) => dispatch({ type: "passport", id }), []);
  const setStageFilter = useCallback((stage: Stage | null) => dispatch({ type: "stageFilter", stage }), []);
  const setSimulatorOpen = useCallback((open: boolean) => dispatch({ type: "simulator", open }), []);
  const resetDemo = useCallback(() => { dealCounter.current = loadDataset().deals.length; dispatch({ type: "reset" }); }, []);
  const confirmDeal = useCallback((input: ConfirmInput) => {
    dealCounter.current += 1;
    const id = `DL-${String(dealCounter.current).padStart(3, "0")}`;
    dispatch({ type: "confirm", deal: { id, ...input, stage: "matched", createdAtLabel: "방금" } });
    return id;
  }, []);

  const value = useMemo<StoreValue>(
    () => ({ state, overview, selectListing, selectSite, openPassport, setStageFilter, setSimulatorOpen, confirmDeal, resetDemo }),
    [state, overview, selectListing, selectSite, openPassport, setStageFilter, setSimulatorOpen, confirmDeal, resetDemo],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside DealStoreProvider");
  return ctx;
}
