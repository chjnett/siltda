"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useStore } from "@/src/state/DealStore";

interface DemoValue { active: boolean; start: () => void; stop: () => void }
const DemoContext = createContext<DemoValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const value = useMemo<DemoValue>(() => ({ active, start: () => setActive(true), stop: () => setActive(false) }), [active]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}

interface Ctx {
  store: ReturnType<typeof useStore>;
  later: (fn: () => void, ms: number) => void;
}

interface Step {
  path: string;
  target: string;
  title: string;
  text: string;
  seconds: number;
  enter?: (ctx: Ctx) => void;
}

const clickIn = (selector: string) => document.querySelector<HTMLElement>(selector)?.click();

/** 7단계, 합계 약 2분 50초 */
const STEPS: Step[] = [
  {
    path: "/dashboard", target: "balance", seconds: 22, title: "① 수요 − 공급 = 잔여 부족량",
    text: "복원 수요 합계에서 매칭된 공급을 빼면 잔여 부족량, 매칭되지 못한 공급은 처분 위기 물량입니다. 한쪽은 처분에, 다른 쪽은 모래 구매에 비용을 쓰는 조정 실패가 한 화면에 보입니다.",
    enter: ({ store }) => { store.openPassport(null); store.setSimulatorOpen(false); },
  },
  {
    path: "/dashboard", target: "timeline", seconds: 22, title: "② 12개월 공급·수요 타임라인",
    text: "막대 위에 마우스를 올리면 그 달의 공급자와 수요자가 나옵니다. 붉게 강조된 달은 시기가 어긋난 구간이며, 임시적치로 메울 수 있는지 확인합니다.",
  },
  {
    path: "/dashboard/supplies", target: "passport", seconds: 25, title: "③ 수급 현황과 퇴적물 여권",
    text: "매물마다 품질 검증 결과와 용도 적합성 판정(근거 포함), 인허가 체크리스트, 이동 이력, 맞는 복원 후보 Top 3가 한 장에 정리됩니다.",
    enter: ({ store, later }) => { store.selectListing("L01"); later(() => store.openPassport("L01"), 900); },
  },
  {
    path: "/dashboard/candidates", target: "scrubber", seconds: 25, title: "④ 연안 복원 후보 — 해안선 후퇴",
    text: "위성 지도에 침식 구역과 수요 신호를 겹치고, 연도 슬라이더로 해안선 후퇴를 재생합니다. 오른쪽 패널은 항구별 후보를 적합도 순으로 보여 줍니다.",
    enter: ({ store }) => { store.openPassport(null); store.selectSite("dadaepo"); store.selectListing("L01"); },
  },
  {
    path: "/dashboard/candidates", target: "gantt", seconds: 22, title: "⑤ 일정 비교 — 임시적치 기간",
    text: "준설 기간과 복원 시기가 어긋나면 임시적치 개월 수가 계산됩니다. 막대를 끌어 일정을 옮기면 적치 기간과 비용이 즉시 다시 계산됩니다.",
  },
  {
    path: "/dashboard/candidates", target: "simulator", seconds: 30, title: "⑥ 경제성 시뮬레이터 → 매칭 확정",
    text: "직송·임시적치·장거리 운송을 기존 처분과 비교하고, 순편익을 공급자·수요자가 어떻게 나누는지 정산합니다. 곧 매칭을 확정합니다.",
    enter: ({ later }) => {
      later(() => clickIn('[data-demo="cand-actions"] .dash-btn-primary'), 700);
      later(() => clickIn('[data-demo="confirm-match"]:not([disabled])'), 15000);
    },
  },
  {
    path: "/dashboard", target: "kpis", seconds: 22, title: "⑦ HOME 복귀 — 지표 갱신",
    text: "확정한 거래가 파이프라인과 KPI(수요 충족률·예상 순편익·처분 회피 물량)에 바로 반영됩니다. 이것이 품질 검증 → 매칭 → 운송 → 비용 정산 → 복원 성과 확인 흐름입니다.",
    enter: ({ store }) => { store.setSimulatorOpen(false); store.openPassport(null); },
  },
];

interface Box { top: number; left: number; width: number; height: number }

export default function DemoTour() {
  const { active, stop } = useDemo();
  const router = useRouter();
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const timers = useRef<number[]>([]);
  const step = STEPS[index];

  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

  // 시작 시 초기화
  useEffect(() => {
    if (!active) return;
    storeRef.current.resetDemo();
    setIndex(0);
    setElapsed(0);
    return () => { clearTimers(); };
  }, [active]);

  // 단계 진입: 라우트 이동 후 동작 실행
  useEffect(() => {
    if (!active) return;
    setElapsed(0);
    setBox(null);
    clearTimers();
    if (pathname !== step.path) router.push(step.path);
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
    later(() => step.enter?.({ store: storeRef.current, later }), pathname === step.path ? 0 : 500);
    return () => { clearTimers(); };
    // pathname 변화는 아래 별도 효과에서 처리한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index]);

  // 자동 진행
  useEffect(() => {
    if (!active) return;
    const tick = window.setInterval(() => setElapsed((e) => e + 0.25), 250);
    return () => window.clearInterval(tick);
  }, [active, index]);
  useEffect(() => {
    if (active && elapsed >= step.seconds) {
      if (index < STEPS.length - 1) setIndex(index + 1);
      else stop();
    }
  }, [active, elapsed, index, step, stop]);

  // 대상 요소 추적
  useEffect(() => {
    if (!active) return;
    let scrolled = "";
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-demo="${step.target}"]`);
      if (!el) { setBox(null); return; }
      if (scrolled !== step.target && !el.closest(".dash-drawer, .dash-modal")) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        scrolled = step.target;
      }
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    const t = window.setInterval(update, 300);
    window.addEventListener("resize", update);
    return () => { window.clearInterval(t); window.removeEventListener("resize", update); };
  }, [active, step, pathname]);

  const go = useCallback((delta: number) => {
    setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)));
  }, []);
  const exit = useCallback(() => { clearTimers(); storeRef.current.setSimulatorOpen(false); storeRef.current.openPassport(null); stop(); }, [stop]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go, exit]);

  if (!active) return null;
  const pad = 6;
  return (
    <div className="dash-tour" role="dialog" aria-label="시연 모드 안내" aria-live="polite">
      {box && (
        <div className="dash-tour-spot" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} aria-hidden="true" />
      )}
      <div className="dash-tour-bubble">
        <header>
          <span>시연 모드 {index + 1} / {STEPS.length}</span>
          <button type="button" className="dash-icon-btn" onClick={exit} aria-label="시연 종료"><X size={16} aria-hidden="true" /></button>
        </header>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        {!box && <small className="dash-muted">화면을 불러오는 중…</small>}
        <div className="dash-tour-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, (elapsed / step.seconds) * 100)}%` }} /></div>
        <footer>
          <button type="button" className="dash-btn" onClick={() => go(-1)} disabled={index === 0}><ChevronLeft size={14} aria-hidden="true" /> 이전</button>
          <button type="button" className="dash-btn dash-btn-primary" onClick={() => (index === STEPS.length - 1 ? exit() : go(1))}>
            {index === STEPS.length - 1 ? "종료" : <>다음 <ChevronRight size={14} aria-hidden="true" /></>}
          </button>
        </footer>
        <small className="dash-muted">← → 키로 이동 · Esc 종료 · 자동 진행</small>
      </div>
    </div>
  );
}
