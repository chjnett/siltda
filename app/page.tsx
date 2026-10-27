"use client";

import dynamic from "next/dynamic";
import TeamDashboardEmbed from "@/components/TeamDashboardEmbed";

const CoastalStudio = dynamic(() => import("@/components/CoastalStudio"), {
  ssr: false,
  loading: () => <main className="loading-shell" aria-label="3D 지도 로딩 중" />,
});

export default function Home() {
  return (
    <main className="home-experience">
      <CoastalStudio />
      <TeamDashboardEmbed />
    </main>
  );
}
