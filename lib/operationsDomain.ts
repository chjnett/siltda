export type UserRole = "port" | "restoration" | "admin";
export type ListingKind = "supply" | "demand";
export type MatchStatus = "draft" | "review" | "quality" | "approved" | "contract" | "scheduled" | "shipping" | "completed" | "rejected";

export interface OperationsUser {
  id: string;
  name: string;
  organization: string;
  role: UserRole;
}

export interface MaterialListing {
  id: string;
  kind: ListingKind;
  title: string;
  organization: string;
  location: string;
  volume: number;
  material: string;
  period: string;
  status: "open" | "matched" | "closed";
  updatedAt: string;
}

export interface MatchRecord {
  id: string;
  supplyId: string;
  demandId: string;
  projectName: string;
  status: MatchStatus;
  score: number;
  distanceKm: number;
  matchedVolume: number;
  assignee: string;
  updatedAt: string;
}

export interface OperationsDocument {
  id: string;
  name: string;
  category: "시험성적서" | "허가서" | "계약서" | "공간데이터";
  size: number;
  projectId: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ActivityRecord {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

export interface SpatialDataset {
  id: string;
  name: string;
  format: "GeoJSON" | "GeoTIFF" | "DEM" | "GRID";
  featureCount?: number;
  size: number;
  status: "validated" | "processing" | "metadata-only";
  uploadedAt: string;
}

export interface OperationsState {
  users: OperationsUser[];
  listings: MaterialListing[];
  matches: MatchRecord[];
  documents: OperationsDocument[];
  activities: ActivityRecord[];
  datasets: SpatialDataset[];
}

export const matchStatusOrder: MatchStatus[] = ["draft", "review", "quality", "approved", "contract", "scheduled", "shipping", "completed"];

export const matchStatusLabel: Record<MatchStatus, string> = {
  draft: "초안",
  review: "검토 요청",
  quality: "품질 검증",
  approved: "매칭 승인",
  contract: "계약 진행",
  scheduled: "운송 예정",
  shipping: "운송 중",
  completed: "활용 완료",
  rejected: "반려",
};

const now = "2026-10-27T10:00:00.000Z";

export const initialOperationsState: OperationsState = {
  users: [
    { id: "user-port", name: "김해진", organization: "부산항만공사", role: "port" },
    { id: "user-restoration", name: "이수연", organization: "부산광역시 연안관리팀", role: "restoration" },
    { id: "user-admin", name: "박현우", organization: "siltDA 운영센터", role: "admin" },
  ],
  listings: [
    { id: "supply-new-port", kind: "supply", title: "부산신항 항로 유지 준설토", organization: "부산항만공사", location: "부산신항", volume: 182000, material: "고함수비 실트·점토질 (세립분 85%)", period: "2026.12–2027.02", status: "matched", updatedAt: now },
    { id: "supply-north-port", kind: "supply", title: "부산항 북항 부두 전면 준설토", organization: "부산항만공사", location: "부산항 북항", volume: 96000, material: "실트질 준설토 (세립분 74%)", period: "2027.01–2027.03", status: "open", updatedAt: now },
    { id: "demand-new-port-fill", kind: "demand", title: "부산신항 배후부지 관리형 매립 수요", organization: "부산항만공사", location: "부산신항 배후부지", volume: 158000, material: "세립질 수용 · 오염도/함수비 시험 필요", period: "2027.02–2027.05", status: "matched", updatedAt: now },
    { id: "demand-wetland", kind: "demand", title: "낙동강 하구 염습지 고도 보강 수요", organization: "부산광역시 연안관리팀", location: "낙동강 하구", volume: 72000, material: "세립질 수용 · 얇은층 살포 검토", period: "2027.04–2027.06", status: "open", updatedAt: now },
    { id: "demand-dadaepo", kind: "demand", title: "다대포 사질 해안 조건부 양빈 수요", organization: "부산광역시 연안관리팀", location: "다대포", volume: 32000, material: "모래 85% 이상 선별 물량만 허용", period: "2027.05–2027.06", status: "open", updatedAt: now },
  ],
  matches: [
    { id: "match-2607", supplyId: "supply-new-port", demandId: "demand-new-port-fill", projectName: "부산신항 준설토 현장 내 순환 실증", status: "quality", score: 93, distanceKm: 2.8, matchedVolume: 158000, assignee: "박현우", updatedAt: now },
    { id: "match-2608", supplyId: "supply-north-port", demandId: "demand-wetland", projectName: "북항–낙동강 하구 습지 보강", status: "review", score: 78, distanceKm: 11.2, matchedVolume: 72000, assignee: "이수연", updatedAt: now },
  ],
  documents: [
    { id: "doc-1", name: "부산신항_입도시험성적서.pdf", category: "시험성적서", size: 1840000, projectId: "match-2607", uploadedBy: "김해진", uploadedAt: now },
    { id: "doc-2", name: "부산신항_토양오염시험_검토서.pdf", category: "허가서", size: 920000, projectId: "match-2607", uploadedBy: "이수연", uploadedAt: now },
  ],
  activities: [
    { id: "activity-1", actor: "박현우", action: "토양오염 시험 검토 단계로 변경", target: "부산신항 준설토 현장 내 순환 실증", at: now },
    { id: "activity-2", actor: "김해진", action: "시험성적서 등록", target: "부산신항 항로 유지 준설토", at: "2026-10-27T09:15:00.000Z" },
    { id: "activity-3", actor: "이수연", action: "매칭 검토 요청", target: "북항–낙동강 하구 습지 보강", at: "2026-10-26T16:40:00.000Z" },
  ],
  datasets: [
    { id: "dataset-1", name: "busan_utilization_candidates.geojson", format: "GeoJSON", featureCount: 5, size: 46800, status: "validated", uploadedAt: now },
    { id: "dataset-2", name: "new_port_demo_bathymetry.tif", format: "GeoTIFF", size: 12840000, status: "metadata-only", uploadedAt: now },
  ],
};

export function nextMatchStatus(status: MatchStatus): MatchStatus | null {
  if (status === "rejected" || status === "completed") return null;
  const index = matchStatusOrder.indexOf(status);
  return matchStatusOrder[index + 1] ?? null;
}
