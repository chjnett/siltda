"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

type Leaflet = typeof import("leaflet");

export const TILES = {
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
} as const;

interface Options {
  center: [number, number];
  zoom: number;
  tile: keyof typeof TILES;
  minZoom?: number;
  maxZoom?: number;
}

/** Leaflet 지도를 브라우저에서만 불러와 container에 생성한다. center는 [lat, lon]. */
export function useLeaflet(container: RefObject<HTMLDivElement | null>, options: Options) {
  const [ready, setReady] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    import("leaflet").then((module) => {
      const L = (module.default ?? module) as Leaflet;
      const element = container.current;
      if (cancelled || !element) return;
      const o = optionsRef.current;
      map = L.map(element, { center: o.center, zoom: o.zoom, minZoom: o.minZoom ?? 5, maxZoom: o.maxZoom ?? 18 });
      const t = TILES[o.tile];
      L.tileLayer(t.url, { maxZoom: t.maxZoom, attribution: t.attribution }).addTo(map);
      leafletRef.current = L;
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [container]);

  return { ready, mapRef, leafletRef };
}
