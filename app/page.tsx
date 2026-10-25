"use client";

import dynamic from "next/dynamic";

const CoastalStudio = dynamic(() => import("@/components/CoastalStudio"), {
  ssr: false,
  loading: () => <main className="loading-shell" aria-label="3D 지도 로딩 중" />,
});

export default function Home() {
  return <CoastalStudio />;
}
