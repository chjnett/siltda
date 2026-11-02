import type { Metadata } from "next";
import OperationsDashboard from "@/components/OperationsDashboard";

export const metadata: Metadata = {
  title: "siltDA Operations",
  description: "준설토 공급과 연안 복원 수요를 관리하는 운영 콘솔",
};

export default function OperationsPage() {
  return <OperationsDashboard />;
}
