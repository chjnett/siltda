"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers3, ListChecks, Ship, Waves } from "lucide-react";

const items = [
  { href: "/dashboard", label: "HOME", icon: Home, exact: true },
  { href: "/dashboard/candidates", label: "연안 복원 후보", icon: Waves, exact: false },
  { href: "/dashboard/supplies", label: "준설토 수급 현황", icon: Ship, exact: false },
  { href: "/dashboard/list", label: "준설토 수급 목록", icon: ListChecks, exact: false },
];

export default function DashboardSidebar() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  return (
    <aside className="dash-sidebar">
      <Link href="/dashboard" className="dash-logo" aria-label="싣다 siltDA 홈">
        <span className="dash-logo-mark">silt<span>DA</span></span>
        <span className="dash-logo-sub">싣다 · Coastal Studio</span>
      </Link>
      <nav aria-label="대시보드 메뉴" className="dash-nav">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="dash-nav-item" aria-current={active ? "page" : undefined}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <Link href="/" className="dash-studio-link">
        <Layers3 size={16} aria-hidden="true" />
        <span>3D Coastal Studio</span>
      </Link>
    </aside>
  );
}
