import type { Metadata } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import "./dashboard.css";
import "./coastal.css";

export const metadata: Metadata = {
  title: "siltDA 운영 대시보드",
  description: "항만 준설토 공급과 연안 복원 수요를 한눈에 확인하는 해양 통합 운영 대시보드",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
