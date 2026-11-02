"use client";

import Link from "next/link";
import { ArrowUp, ExternalLink, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

const TEAM_DASHBOARD_URL = "https://siltda-4p1.pages.dev/dashboard";

export default function TeamDashboardEmbed() {
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <section id="team-dashboard" className="team-dashboard-section" aria-labelledby="team-dashboard-title">
      <header className="team-dashboard-bridge">
        <div>
          <span className="team-dashboard-kicker">팀 대시보드 · 참고 화면</span>
          <h2 id="team-dashboard-title"><LayoutDashboard size={16} /> 통합 수급 현황</h2>
        </div>
        <nav aria-label="통합 대시보드 이동">
          <Link href="#coastal-studio" className="team-dashboard-action"><ArrowUp size={14} /> 3D Studio</Link>
          <Link href="/operations?view=overview" className="team-dashboard-action primary">운영 대시보드</Link>
          <a href={TEAM_DASHBOARD_URL} target="_blank" rel="noreferrer" className="team-dashboard-action">
            새 창 <ExternalLink size={13} />
          </a>
        </nav>
      </header>

      <div className="team-dashboard-frame-wrap">
        {mobile === false && (
          <iframe
            className="team-dashboard-frame"
            src={TEAM_DASHBOARD_URL}
            title="siltDA 준설토 수급 조정 대시보드"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen"
          />
        )}
        {mobile === true && (
          <div className="mobile-dashboard-handoff">
            <span>MOBILE OPERATIONS</span>
            <LayoutDashboard size={30} />
            <h3>모바일 운영 화면으로 이어서 확인하세요.</h3>
            <p>작은 화면에서는 무거운 외부 대시보드 iframe을 불러오지 않고, 모바일에 최적화된 운영 화면으로 연결합니다.</p>
            <Link href="/operations?view=overview">운영 대시보드 열기</Link>
            <a href={TEAM_DASHBOARD_URL} target="_blank" rel="noreferrer">팀 대시보드 원본 <ExternalLink size={13} /></a>
          </div>
        )}
      </div>
    </section>
  );
}
