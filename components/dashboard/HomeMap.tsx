"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { LayerGroup } from "leaflet";
import { WORK_LIMITS } from "@/src/config/assumptions";
import { fmtInt, fmtM3, monthRange, urgencyLabels, type BaseMonth } from "@/src/domain/format";
import { matchedVolumeOfListing } from "@/src/domain/matching";
import { requiredVolume } from "@/src/domain/shoreline";
import { loadWeather } from "@/src/domain/weather";
import { useAsync } from "@/src/state/useAsync";
import type { Dataset, LonLat, Urgency } from "@/src/types";
import { useLeaflet } from "./useLeaflet";

export type LayerId = "dredge" | "erosion" | "stockpile" | "routes" | "infra";

export const LAYER_LABELS: Record<LayerId, string> = {
  dredge: "준설 예정지",
  erosion: "침식지",
  stockpile: "임시적치장",
  routes: "매칭 운송경로",
  infra: "항만 인프라",
};

interface Props {
  data: Dataset;
  base: BaseMonth;
  layers: Record<LayerId, boolean>;
  showWeather: boolean;
  hourIndex: number;
  highlightDealId: string | null;
  onOpenPassport: (listingId: string) => void;
  onOpenSite: (siteId: string) => void;
}

const ll = (p: LonLat): [number, number] => [p[1], p[0]];
const urgencyColor: Record<Urgency, string> = { critical: "#dc2626", high: "#f59e0b", normal: "#14b8a6" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** 공급 마커 반지름: 물량의 제곱근에 비례 (면적 ∝ 물량) */
const supplyRadius = (m3: number) => Math.max(7, Math.min(30, Math.sqrt(m3) / 12));

export default function HomeMap({ data, base, layers, showWeather, hourIndex, highlightDealId, onOpenPassport, onOpenSite }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<LayerGroup | null>(null);
  const { ready, mapRef, leafletRef } = useLeaflet(canvasRef, { center: [36.0, 127.8], zoom: 7, tile: "osm", minZoom: 6, maxZoom: 14 });

  const points = useMemo(() => data.ports.map((p) => ({ id: p.id, coordinate: p.coordinate })), [data.ports]);
  const ids = useMemo(() => new Set(points.map((p) => p.id)), [points]);
  const load = useCallback((signal: AbortSignal) => loadWeather(points, ids, signal), [points, ids]);
  const { state: weather } = useAsync(load);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    groupRef.current = L.layerGroup().addTo(map);
    return () => { groupRef.current?.remove(); groupRef.current = null; };
  }, [ready, leafletRef, mapRef]);

  useEffect(() => {
    const L = leafletRef.current;
    const group = groupRef.current;
    if (!ready || !L || !group) return;
    group.clearLayers();

    const portById = new Map(data.ports.map((p) => [p.id, p]));
    const siteById = new Map(data.sites.map((s) => [s.id, s]));
    const wx = (portId: string) => {
      if (!showWeather || weather.status !== "ready") return "";
      const row = weather.data.hours[portId]?.[Math.min(hourIndex, 167)];
      if (!row) return "";
      return `풍속 ${row.windMs.toFixed(1)} m/s${row.waveM !== null ? ` · 파고 ${row.waveM.toFixed(1)} m` : ""}`;
    };
    const warn = (portId: string) => {
      if (!showWeather || weather.status !== "ready") return false;
      const row = weather.data.hours[portId]?.[Math.min(hourIndex, 167)];
      return !!row && (row.windMs > WORK_LIMITS.transport.windMs || (row.waveM ?? 0) > WORK_LIMITS.transport.waveM);
    };

    if (layers.infra) {
      for (const p of data.ports) {
        const label = [p.name, wx(p.id)].filter(Boolean).join(" · ");
        L.circleMarker(ll(p.coordinate), { radius: 4, color: "#fff", weight: 1.5, fillColor: warn(p.id) ? "#dc2626" : "#64748b", fillOpacity: 1 })
          .bindTooltip(label, { permanent: showWeather && weather.status === "ready", direction: "bottom", className: "dash-map-tip dash-map-tip--wx", offset: [0, 4] })
          .addTo(group);
      }
    }

    if (layers.stockpile) {
      for (const s of data.stockpiles) {
        L.marker(ll(s.coordinate), {
          icon: L.divIcon({ className: "dash-pin dash-pin--stock", html: "<span></span>", iconSize: [16, 16] }),
          title: s.name,
        })
          .bindPopup(`<div class="dash-lpopup"><b>${esc(s.name)}</b><dl><div><dt>수용 용량</dt><dd>${fmtInt(s.capacityM3)} m³</dd></div></dl><small>임시적치장(시연용 가상 위치)</small></div>`)
          .addTo(group);
      }
    }

    if (layers.routes) {
      for (const d of data.deals) {
        const l = data.listings.find((x) => x.id === d.listingId);
        const port = l && portById.get(l.portId);
        const site = siteById.get(d.siteId);
        if (!port || !site) continue;
        const hot = d.id === highlightDealId;
        L.polyline([ll(port.coordinate), ll(site.coordinate)], {
          color: hot ? "#f59e0b" : "#3358f4", weight: hot ? 5 : 3, opacity: 0.9,
          className: `dash-route-line${d.stage === "placed" ? "" : " dash-route-line--deal"}`,
        })
          .bindTooltip(`${port.name} → ${site.name} · ${fmtM3(d.volumeM3)}`, { sticky: true, className: "dash-map-tip" })
          .addTo(group);
      }
    }

    if (layers.dredge) {
      const byPort = new Map<string, { m3: number; listings: typeof data.listings }>();
      for (const l of data.listings) {
        if (l.stage === "placed") continue;
        const cur = byPort.get(l.portId) ?? { m3: 0, listings: [] };
        cur.m3 += Math.max(0, l.volumeM3 - matchedVolumeOfListing(l.id, data.deals));
        cur.listings.push(l);
        byPort.set(l.portId, cur);
      }
      for (const [portId, { m3, listings }] of byPort) {
        const port = portById.get(portId);
        if (!port) continue;
        const top = [...listings].sort((a, b) => b.volumeM3 - a.volumeM3)[0];
        const marker = L.circleMarker(ll(port.coordinate), { radius: supplyRadius(m3), color: "#fff", weight: 2, fillColor: "#3358f4", fillOpacity: 0.78 });
        marker.bindPopup(
          `<div class="dash-lpopup"><b>${esc(port.name)}</b><dl>` +
          `<div><dt>미매칭 공급</dt><dd>${fmtInt(m3)} m³</dd></div>` +
          `<div><dt>대표 사업</dt><dd>${esc(top.project)}</dd></div>` +
          `<div><dt>준설 시기</dt><dd>${monthRange(base, top.dredgeStart, top.dredgeEnd)}</dd></div>` +
          `</dl><button type="button" data-act="passport" data-id="${top.id}">퇴적물 여권 보기</button></div>`,
        );
        marker.addTo(group);
      }
    }

    if (layers.erosion) {
      for (const s of data.sites) {
        const need = requiredVolume(s);
        const color = s.status === "completed" ? "#64748b" : urgencyColor[s.urgency];
        L.circleMarker(ll(s.coordinate), { radius: s.status === "completed" ? 7 : 9, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 })
          .bindPopup(
            `<div class="dash-lpopup"><b>${esc(s.name)}</b><dl>` +
            `<div><dt>긴급도</dt><dd>${s.status === "completed" ? "복원 완료" : urgencyLabels[s.urgency]}</dd></div>` +
            `<div><dt>필요 토량</dt><dd>${fmtInt(need)} m³</dd></div>` +
            `<div><dt>복원 시기</dt><dd>${monthRange(base, s.needStart, s.needEnd)}</dd></div>` +
            `</dl><button type="button" data-act="site" data-id="${s.id}">후보지 보기</button></div>`,
          )
          .addTo(group);
      }
    }
  }, [ready, data, base, layers, showWeather, weather, hourIndex, highlightDealId, leafletRef]);

  // 팝업 안의 버튼은 문서에 직접 연결되지 않으므로 컨테이너에서 위임 처리
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id ?? "";
      if (btn.dataset.act === "passport") onOpenPassport(id);
      else if (btn.dataset.act === "site") onOpenSite(id);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [onOpenPassport, onOpenSite]);

  return (
    <div className="dash-map-wrap">
      <div ref={canvasRef} className="dash-map-canvas dash-map-canvas--home" role="application" aria-label="준설토 수급 지도" />
      <ul className="dash-map-legend" aria-label="범례">
        <li><i style={{ background: "#3358f4" }} />준설 예정(크기 = 물량)</li>
        <li><i style={{ background: "#dc2626" }} />침식 긴급 · <i style={{ background: "#f59e0b" }} />높음 · <i style={{ background: "#14b8a6" }} />보통</li>
        <li><i className="dash-legend-line" />매칭 운송경로</li>
      </ul>
    </div>
  );
}
