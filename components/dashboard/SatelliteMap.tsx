"use client";

import { useEffect, useRef } from "react";
import type { LayerGroup } from "leaflet";
import { erosionPolygon, shorelineAt, baselineShoreline } from "@/src/domain/shoreline";
import type { LonLat, Port, Site } from "@/src/types";
import { useLeaflet } from "./useLeaflet";

export interface RouteLine { id: string; from: LonLat; to: LonLat }

interface Props {
  site: Site;
  /** 표시할 해안선 연도(소수 가능) */
  year: number;
  ports: Port[];
  hoveredPortId: string | null;
  routes: RouteLine[];
  /** 값이 바뀔 때마다 routes 전체가 보이도록 화면을 맞춘다(매칭 확정 연출) */
  focusRoutesToken: number;
}

const ll = (p: LonLat): [number, number] => [p[1], p[0]];

export default function SatelliteMap({ site, year, ports, hoveredPortId, routes, focusRoutesToken }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<LayerGroup | null>(null);
  const { ready, mapRef, leafletRef } = useLeaflet(canvasRef, { center: ll(site.coordinate), zoom: 15, tile: "satellite", minZoom: 5, maxZoom: 18 });

  // 레이어 그룹 준비
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    groupRef.current = L.layerGroup().addTo(map);
    return () => { groupRef.current?.remove(); groupRef.current = null; };
  }, [ready, leafletRef, mapRef]);

  // 후보지가 바뀌면 현장으로 이동
  useEffect(() => {
    if (ready) mapRef.current?.setView(ll(site.coordinate), 15);
  }, [ready, site, mapRef]);

  // 해안선·침식 구역·마커·경로
  useEffect(() => {
    const L = leafletRef.current;
    const group = groupRef.current;
    if (!ready || !L || !group) return;
    group.clearLayers();
    L.polygon(erosionPolygon(site, year).map(ll), { color: "#ef4444", weight: 1, fillColor: "#ef4444", fillOpacity: 0.42, interactive: false }).addTo(group);
    L.polyline(baselineShoreline(site).map(ll), { color: "#ffffff", weight: 2, dashArray: "6 6", interactive: false }).addTo(group);
    L.polyline(shorelineAt(site, year).map(ll), { color: "#22d3ee", weight: 3, interactive: false }).addTo(group);
    L.circleMarker(ll(site.coordinate), { radius: 7, color: "#fff", weight: 2, fillColor: "#f59e0b", fillOpacity: 1 }).bindTooltip(site.name, { permanent: true, direction: "right", className: "dash-map-tip" }).addTo(group);

    for (const port of ports) {
      const hot = port.id === hoveredPortId;
      L.circleMarker(ll(port.coordinate), { radius: hot ? 8 : 5, color: "#fff", weight: 2, fillColor: "#3358f4", fillOpacity: 1 })
        .bindTooltip(port.name, { permanent: hot, direction: "top", className: "dash-map-tip" })
        .addTo(group);
    }
    const hovered = ports.find((p) => p.id === hoveredPortId);
    if (hovered) L.polyline([ll(hovered.coordinate), ll(site.coordinate)], { color: "#f59e0b", weight: 4, className: "dash-route-line", interactive: false }).addTo(group);
    for (const r of routes) L.polyline([ll(r.from), ll(r.to)], { color: "#3358f4", weight: 4, className: "dash-route-line dash-route-line--deal", interactive: false }).addTo(group);
  }, [ready, site, year, ports, hoveredPortId, routes, leafletRef]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !map || !L || focusRoutesToken === 0 || routes.length === 0) return;
    const points = routes.flatMap((r) => [ll(r.from), ll(r.to)]);
    map.flyToBounds(L.latLngBounds(points), { padding: [60, 60], duration: 1, maxZoom: 11 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusRoutesToken]);

  const showSite = () => mapRef.current?.flyTo(ll(site.coordinate), 15, { duration: 0.6 });
  const showWide = () => {
    const L = leafletRef.current;
    if (!L) return;
    mapRef.current?.flyToBounds(L.latLngBounds([ll(site.coordinate), ...ports.map((p) => ll(p.coordinate))]), { padding: [40, 40], duration: 0.8 });
  };

  return (
    <div className="dash-sat">
      <div ref={canvasRef} className="dash-map-canvas" role="application" aria-label={`${site.name} 위성 지도`} />
      <div className="dash-sat-controls">
        <button type="button" className="dash-btn dash-btn-sm" onClick={showSite}>현장 보기</button>
        <button type="button" className="dash-btn dash-btn-sm" onClick={showWide}>광역 보기</button>
      </div>
      <p className="dash-sat-note">침식 구역(빨강)·해안선(청록)은 시연용 가상 모델이며 실제 관측 결과가 아닙니다. 흰 점선 = 기준 해안선.</p>
    </div>
  );
}
