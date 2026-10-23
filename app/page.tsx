"use client";

import dynamic from "next/dynamic";

const CoastalStudio = dynamic(() => import("@/components/CoastalStudio"), {
  ssr: false,
  loading: () => (
    <main className="loading-shell" aria-label="siltDA 로딩 중">
      <div className="loading-mark" aria-hidden="true">
        <span>silt</span><strong>DA</strong>
      </div>
    </main>
  ),
});

export default function Home() {
  return <CoastalStudio />;
}
