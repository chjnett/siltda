import type { Metadata, Viewport } from "next";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "siltDA 3D Coastal Studio",
  description: "준설과 연안 복원을 연결하는 실감형 3D GIS 시뮬레이션 플랫폼",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="ambient-shade" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
