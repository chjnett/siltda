import type { LonLat } from "@/src/types";

const HALF_LON = 0.02;
const HALF_LAT = 0.0113;

/** 항만 좌표 주변의 Esri World Imagery 위성 사진. 시점이 최신이 아닐 수 있다. */
export default function PortSatellite({ name, coordinate }: { name: string; coordinate: LonLat }) {
  const [lon, lat] = coordinate;
  const bbox = [lon - HALF_LON, lat - HALF_LAT, lon + HALF_LON, lat + HALF_LAT].map((v) => v.toFixed(5)).join(",");
  const src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=480,270&format=jpg&f=image`;
  return (
    <div className="dash-sat-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${name} 위성 사진`} loading="lazy" decoding="async" />
      <span>위성 사진 · Esri World Imagery</span>
    </div>
  );
}
