import Link from "next/link";
import { ArrowUp, ExternalLink, LayoutDashboard } from "lucide-react";

const TEAM_DASHBOARD_URL = "https://siltda-4p1.pages.dev/dashboard";

export default function TeamDashboardEmbed() {
  return (
    <section id="team-dashboard" className="team-dashboard-section" aria-labelledby="team-dashboard-title">
      <header className="team-dashboard-bridge">
        <div>
          <span className="team-dashboard-kicker">통합 운영 화면</span>
          <h2 id="team-dashboard-title"><LayoutDashboard size={16} /> 준설토 수급·조정 대시보드</h2>
        </div>
        <nav aria-label="통합 대시보드 이동">
          <Link href="#coastal-studio" className="team-dashboard-action"><ArrowUp size={14} /> 3D Studio</Link>
          <Link href="/operations" className="team-dashboard-action">관리 콘솔</Link>
          <a href={TEAM_DASHBOARD_URL} target="_blank" rel="noreferrer" className="team-dashboard-action">
            새 창 <ExternalLink size={13} />
          </a>
        </nav>
      </header>

      <div className="team-dashboard-frame-wrap">
        <iframe
          className="team-dashboard-frame"
          src={TEAM_DASHBOARD_URL}
          title="siltDA 준설토 수급 조정 대시보드"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen"
        />
      </div>
    </section>
  );
}
