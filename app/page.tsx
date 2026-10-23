"use client";

import dynamic from "next/dynamic";

const CoastalStudio = dynamic(() => import("@/components/CoastalStudio"), {
  ssr: false,
  loading: () => (
    <main className="loading-shell">
      <div className="loading-mark">siltDA</div>
      <p>3D 해안 작업공간을 준비하고 있습니다.</p>
      <div className="loading-bar"><span /></div>
    </main>
  ),
});

export default function Home() {
  return <CoastalStudio />;
}
