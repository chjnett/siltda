"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { PRODUCT_MESSAGE } from "@/src/config/assumptions";
import { DealStoreProvider } from "@/src/state/DealStore";
import DashboardSidebar from "./DashboardSidebar";
import DemoTour, { DemoProvider, useDemo } from "./DemoTour";
import PassportDrawer from "./PassportDrawer";

const titles: Record<string, string> = {
  "/dashboard": "HOME — 조정 현황",
  "/dashboard/candidates": "연안 복원 후보 — 매칭과 경제성",
  "/dashboard/supplies": "준설토 수급 현황 — 공급 매물 · 퇴적물 여권",
  "/dashboard/list": "준설토 수급 목록 — 전체 데이터",
};

function GlobalHeader() {
  const { start, active } = useDemo();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <header className="dash-topbar">
      <Link href="/dashboard" className="dash-logo" aria-label="싣다 siltDA 홈">
        <span className="dash-logo-mark">silt<span>DA</span></span>
        <span className="dash-logo-sub">싣다 · Coastal Studio</span>
      </Link>
      <div className="dash-topbar-meta">
        <span className="dash-muted dash-mono" suppressHydrationWarning>
          기준 시각 {now ? now.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
        </span>
        <button type="button" className="dash-btn dash-btn-primary" onClick={start} disabled={active} data-demo="start-demo" aria-label="시연 시작">
          <PlayCircle size={15} aria-hidden="true" /> <span className="dash-btn-label">시연 시작</span>
        </button>
      </div>
    </header>
  );
}

function PageTitle() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  return <h1 className="dash-page-title">{titles[pathname] ?? "싣다 대시보드"}</h1>;
}

/** 모든 화면 상단에 항상 보이는 서비스 정의 */
function ServiceBanner() {
  return (
    <aside className="dash-banner" aria-label="서비스 소개">
      <p><b>{PRODUCT_MESSAGE.title}</b>은 {PRODUCT_MESSAGE.summary}입니다.</p>
      <p>
        한쪽은 준설토 <b>처분에 비용</b>을 쓰고, 다른 쪽은 복원용 모래 <b>구매에 비용</b>을 씁니다. 싣다는 발생 시점·위치·품질·비용을 복원 사업의 일정·요구 조건에 맞춰 조정합니다.
      </p>
      <ol className="dash-flow" aria-label="싣다 업무 흐름">
        {PRODUCT_MESSAGE.flow.split(" → ").map((step) => <li key={step}>{step}</li>)}
      </ol>
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DealStoreProvider>
      <DemoProvider>
        <div className="dash-root">
          <GlobalHeader />
          <DashboardSidebar />
          <main className="dash-main" id="dash-main">
            <PageTitle />
            <ServiceBanner />
            {children}
          </main>
          <PassportDrawer />
          <DemoTour />
        </div>
      </DemoProvider>
    </DealStoreProvider>
  );
}
