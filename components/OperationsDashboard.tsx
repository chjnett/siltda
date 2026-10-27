"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, BarChart3, Bell, Building2, Check, ChevronRight, ClipboardCheck,
  Database, Download, FileArchive, FileText, Filter, Globe2, LayoutDashboard, Map,
  PackagePlus, Pencil, Plus, RefreshCw, Search, ShieldCheck, Ship, Trash2, Upload,
  UserRound, Users, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  initialOperationsState, matchStatusLabel, matchStatusOrder, nextMatchStatus,
  type ListingKind, type MaterialListing, type MatchRecord, type OperationsDocument,
  type OperationsState, type SpatialDataset, type UserRole,
} from "@/lib/operationsDomain";
import { loadOperations, persistOperations, resetLocalOperations, uploadOperationsDocument, uploadSpatialDataset, type OperationsSnapshot } from "@/lib/operationsRepository";

type ViewId = "overview" | "listings" | "matches" | "data" | "admin";

const number = new Intl.NumberFormat("ko-KR");
const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });

const navItems: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "운영 현황", icon: LayoutDashboard },
  { id: "listings", label: "준설토·복원 수요", icon: Ship },
  { id: "matches", label: "매칭 워크플로", icon: ClipboardCheck },
  { id: "data", label: "데이터·문서", icon: Database },
  { id: "admin", label: "기관·감사 기록", icon: ShieldCheck },
];

const viewCopy: Record<ViewId, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "OPERATIONS", title: "연안 퇴적물 운영 현황", description: "공급·수요·승인·운송 상태를 한 흐름으로 관리합니다." },
  listings: { eyebrow: "MARKETPLACE", title: "준설토 공급과 복원 수요", description: "기관별 물량과 품질 조건을 등록하고 매칭 대상을 검토합니다." },
  matches: { eyebrow: "WORKFLOW", title: "매칭 승인 및 이행 관리", description: "검토부터 계약, 운송, 복원 완료까지 변경 이력을 남깁니다." },
  data: { eyebrow: "DATA ROOM", title: "공간 데이터와 증빙 문서", description: "GeoJSON을 검증하고 수심·허가·시험 자료를 프로젝트에 연결합니다." },
  admin: { eyebrow: "GOVERNANCE", title: "기관, 권한 및 감사 기록", description: "참여 기관의 역할과 프로젝트 변경 기록을 확인합니다." },
};

const roleLabel: Record<UserRole, string> = { port: "항만 운영자", restoration: "복원 기관", admin: "관리자" };
const listingKindLabel: Record<ListingKind, string> = { supply: "공급", demand: "복원 수요" };

interface ListingDraft {
  id?: string;
  kind: ListingKind;
  title: string;
  organization: string;
  location: string;
  volume: string;
  material: string;
  period: string;
}

function blankListing(role: UserRole, organization: string): ListingDraft {
  return {
    kind: role === "restoration" ? "demand" : "supply",
    title: "",
    organization,
    location: "",
    volume: "",
    material: "",
    period: "",
  };
}

function statusVariant(status: MatchRecord["status"]): "default" | "secondary" | "success" | "warning" {
  if (status === "completed") return "success";
  if (status === "rejected") return "warning";
  if (["approved", "contract", "scheduled", "shipping"].includes(status)) return "default";
  return "secondary";
}

function formatActivityTime(value: string): string {
  const date = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month}.${day} ${hours}:${minutes}`;
}

export default function OperationsDashboard() {
  const [state, setState] = useState<OperationsState>(initialOperationsState);
  const [source, setSource] = useState<OperationsSnapshot["source"]>("local");
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewId>("overview");
  const [role, setRole] = useState<UserRole>("admin");
  const [query, setQuery] = useState("");
  const [listingFilter, setListingFilter] = useState<"all" | ListingKind>("all");
  const [listingDraft, setListingDraft] = useState<ListingDraft | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState("match-2607");
  const [notice, setNotice] = useState("운영 콘솔을 불러오는 중입니다.");

  const currentUser = state.users.find((user) => user.role === role) ?? state.users[2];
  const selectedMatch = state.matches.find((match) => match.id === selectedMatchId) ?? state.matches[0];
  const copy = viewCopy[view];

  useEffect(() => {
    void loadOperations().then((snapshot) => {
      setState(snapshot.state);
      setSource(snapshot.source);
      setLoaded(true);
      setNotice(snapshot.source === "cloud" ? "Cloudflare D1 운영 데이터와 연결되었습니다." : "로컬 시연 저장소로 동작 중입니다.");
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      void persistOperations(state, source).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다."));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loaded, source, state]);

  const filteredListings = useMemo(() => state.listings.filter((listing) => {
    const filterMatch = listingFilter === "all" || listing.kind === listingFilter;
    const queryMatch = !query || [listing.title, listing.organization, listing.location, listing.material].join(" ").toLowerCase().includes(query.toLowerCase());
    return filterMatch && queryMatch;
  }), [listingFilter, query, state.listings]);

  const metrics = useMemo(() => {
    const supply = state.listings.filter((listing) => listing.kind === "supply" && listing.status !== "closed").reduce((sum, listing) => sum + listing.volume, 0);
    const demand = state.listings.filter((listing) => listing.kind === "demand" && listing.status !== "closed").reduce((sum, listing) => sum + listing.volume, 0);
    const active = state.matches.filter((match) => !["completed", "rejected"].includes(match.status)).length;
    const shipping = state.matches.filter((match) => ["scheduled", "shipping"].includes(match.status)).reduce((sum, match) => sum + match.matchedVolume, 0);
    return { supply, demand, active, shipping };
  }, [state]);

  const addActivity = (action: string, target: string) => ({
    id: crypto.randomUUID(), actor: currentUser.name, action, target, at: new Date().toISOString(),
  });

  const saveListing = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listingDraft) return;
    const existing = state.listings.find((listing) => listing.id === listingDraft.id);
    const next: MaterialListing = {
      id: listingDraft.id ?? crypto.randomUUID(),
      kind: listingDraft.kind,
      title: listingDraft.title.trim(),
      organization: listingDraft.organization.trim(),
      location: listingDraft.location.trim(),
      volume: Number(listingDraft.volume),
      material: listingDraft.material.trim(),
      period: listingDraft.period.trim(),
      status: existing?.status ?? "open",
      updatedAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      listings: existing ? current.listings.map((listing) => listing.id === next.id ? next : listing) : [next, ...current.listings],
      activities: [addActivity(existing ? "매물 정보 수정" : `${listingKindLabel[next.kind]} 등록`, next.title), ...current.activities],
    }));
    setListingDraft(null);
    setNotice(existing ? "등록 정보를 수정했습니다." : "새 운영 항목을 등록했습니다.");
  };

  const deleteListing = (listing: MaterialListing) => {
    setState((current) => ({
      ...current,
      listings: current.listings.filter((item) => item.id !== listing.id),
      activities: [addActivity("운영 항목 삭제", listing.title), ...current.activities],
    }));
    setNotice("운영 항목을 삭제했습니다. 연결된 실제 계약은 별도 검토가 필요합니다.");
  };

  const transitionMatch = (status: MatchRecord["status"]) => {
    if (!selectedMatch) return;
    setState((current) => ({
      ...current,
      matches: current.matches.map((match) => match.id === selectedMatch.id ? { ...match, status, assignee: currentUser.name, updatedAt: new Date().toISOString() } : match),
      activities: [addActivity(`${matchStatusLabel[status]} 단계로 변경`, selectedMatch.projectName), ...current.activities],
    }));
    setNotice(`${selectedMatch.projectName}을(를) ${matchStatusLabel[status]} 상태로 변경했습니다.`);
  };

  const uploadDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedMatch) return;
    const category: OperationsDocument["category"] = file.name.toLowerCase().includes("허가") ? "허가서" : file.name.toLowerCase().includes("계약") ? "계약서" : "시험성적서";
    let document: OperationsDocument = { id: crypto.randomUUID(), name: file.name, category, size: file.size, projectId: selectedMatch.id, uploadedBy: currentUser.name, uploadedAt: new Date().toISOString() };
    if (source === "cloud") {
      try {
        document = await uploadOperationsDocument(file, selectedMatch.id, category) ?? document;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "문서 업로드에 실패했습니다.");
        event.target.value = "";
        return;
      }
    }
    setState((current) => ({ ...current, documents: [document, ...current.documents], activities: [addActivity(`${category} 등록`, selectedMatch.projectName), ...current.activities] }));
    setNotice(source === "cloud" ? "문서 업로드 요청을 등록했습니다." : "문서 메타데이터만 로컬에 저장했습니다. 파일 본문은 R2 연결 후 저장됩니다.");
    event.target.value = "";
  };

  const uploadSpatialData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    let format: SpatialDataset["format"] = extension === "geojson" || extension === "json" ? "GeoJSON" : extension === "tif" || extension === "tiff" ? "GeoTIFF" : extension === "dem" ? "DEM" : "GRID";
    let featureCount: number | undefined;
    let status: SpatialDataset["status"] = "metadata-only";
    if (format === "GeoJSON") {
      try {
        const parsed = JSON.parse(await file.text()) as { type?: string; features?: unknown[] };
        if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) throw new Error("FeatureCollection이 아닙니다.");
        featureCount = parsed.features.length;
        status = "validated";
      } catch (error) {
        setNotice(`GeoJSON 검증 실패: ${error instanceof Error ? error.message : "형식을 확인하세요."}`);
        event.target.value = "";
        return;
      }
    } else if (source === "cloud") {
      status = "processing";
    }
    let dataset: SpatialDataset = { id: crypto.randomUUID(), name: file.name, format, featureCount, size: file.size, status, uploadedAt: new Date().toISOString() };
    if (source === "cloud") {
      try {
        dataset = await uploadSpatialDataset(file, format, featureCount) ?? dataset;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "공간 데이터 업로드에 실패했습니다.");
        event.target.value = "";
        return;
      }
    }
    setState((current) => ({ ...current, datasets: [dataset, ...current.datasets], activities: [addActivity(`${format} 데이터 등록`, file.name), ...current.activities] }));
    setNotice(status === "validated" ? `${featureCount}개 피처를 검증했습니다.` : "메타데이터를 등록했습니다. 실제 격자 변환은 처리 Worker 연결 후 실행됩니다.");
    event.target.value = "";
  };

  const exportReport = () => {
    const report = { exportedAt: new Date().toISOString(), user: currentUser, metrics, matches: state.matches, listings: state.listings, documents: state.documents };
    const href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `siltda-operations-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
    setNotice("운영 보고서 JSON을 생성했습니다.");
  };

  const restoreDemo = () => {
    resetLocalOperations();
    setState(JSON.parse(JSON.stringify(initialOperationsState)) as OperationsState);
    setNotice("시연 데이터를 초기 상태로 복원했습니다.");
  };

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <Link href="/" className="operations-brand" aria-label="siltDA 3D Studio로 이동">silt<span>DA</span><small>Operations</small></Link>
        <nav className="operations-product-nav" aria-label="제품 영역">
          <Link href="/"><Globe2 size={15} /> 3D Studio</Link>
          <span className="active"><LayoutDashboard size={15} /> Operations</span>
        </nav>
        <div className="operations-header-actions">
          <Badge variant={source === "cloud" ? "success" : "secondary"}><Database size={12} /> {source === "cloud" ? "D1 동기화" : "로컬 시연"}</Badge>
          <button type="button" className="operations-icon-button" aria-label="알림 3개"><Bell size={17} /><i>3</i></button>
          <div className="operations-user"><span>{currentUser.name}</span><small>{currentUser.organization}</small><UserRound size={17} /></div>
        </div>
      </header>

      <div className="operations-layout">
        <aside className="operations-sidebar">
          <div className="operations-role-block">
            <small>현재 역할</small>
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} aria-label="운영 역할 선택">
              <option value="port">항만 운영자</option>
              <option value="restoration">복원 기관</option>
              <option value="admin">관리자</option>
            </select>
            <span><Building2 size={13} /> {currentUser.organization}</span>
          </div>
          <nav className="operations-side-nav" aria-label="운영 메뉴">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={16} /><span>{label}</span><ChevronRight size={14} /></button>
            ))}
          </nav>
          <div className="operations-sidebar-note">
            <ShieldCheck size={15} />
            <div><strong>{roleLabel[role]}</strong><span>{role === "admin" ? "전체 승인 및 감사 권한" : role === "port" ? "공급 등록 및 품질 제출" : "복원 수요와 검토 권한"}</span></div>
          </div>
        </aside>

        <section className="operations-main">
          <div className="operations-titlebar">
            <div><span>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p></div>
            <div className="operations-title-actions">
              <Button variant="outline" size="sm" onClick={exportReport}><Download size={15} /> 보고서</Button>
              <Button size="sm" onClick={() => { setListingDraft(blankListing(role, currentUser.organization)); setView("listings"); }}><Plus size={15} /> {role === "restoration" ? "복원 수요 등록" : "준설토 등록"}</Button>
            </div>
          </div>

          {view === "overview" && (
            <>
              <div className="operations-metrics">
                <Card><span><Ship size={15} /> 가용 준설토</span><strong>{compact.format(metrics.supply)} <i>m³</i></strong><small>활성 공급 {state.listings.filter((item) => item.kind === "supply").length}건</small></Card>
                <Card><span><Map size={15} /> 복원 수요</span><strong>{compact.format(metrics.demand)} <i>m³</i></strong><small>미충족 {Math.max(0, metrics.demand - metrics.supply).toLocaleString()} m³</small></Card>
                <Card><span><ClipboardCheck size={15} /> 진행 매칭</span><strong>{metrics.active} <i>건</i></strong><small>승인·계약·운송 포함</small></Card>
                <Card><span><Activity size={15} /> 운송 확정</span><strong>{compact.format(metrics.shipping)} <i>m³</i></strong><small>예정 및 운송 중 물량</small></Card>
              </div>
              <div className="operations-overview-grid">
                <Card className="operations-panel operations-match-map">
                  <div className="operations-panel-head"><div><span>LIVE SPATIAL OPERATIONS</span><h2>부산 연안 매칭 현황</h2></div><Link href="/">3D Studio 열기 <ArrowRight size={14} /></Link></div>
                  <div className="operations-map-visual" aria-label="부산 연안 공급과 복원 연결 개요">
                    <div className="map-grid-lines" />
                    <span className="map-coast coast-a" /><span className="map-coast coast-b" />
                    <i className="map-node supply node-a"><b>18.2만</b><small>부산신항</small></i>
                    <i className="map-node demand node-b"><b>15.1만</b><small>다대포</small></i>
                    <i className="map-node supply node-c"><b>9.6만</b><small>북항</small></i>
                    <i className="map-node demand node-d"><b>12.3만</b><small>송정</small></i>
                    <span className="map-route route-a" /><span className="map-route route-b" />
                    <div className="map-legend"><span><i className="supply" /> 공급</span><span><i className="demand" /> 복원 수요</span><span><i className="route" /> 검토 경로</span></div>
                  </div>
                </Card>
                <Card className="operations-panel">
                  <div className="operations-panel-head"><div><span>APPROVAL QUEUE</span><h2>검토가 필요한 매칭</h2></div><button type="button" onClick={() => setView("matches")}>전체 보기</button></div>
                  <div className="operations-queue">
                    {state.matches.map((match) => <button type="button" key={match.id} onClick={() => { setSelectedMatchId(match.id); setView("matches"); }}><span><strong>{match.projectName}</strong><small>{number.format(match.matchedVolume)} m³ · {match.distanceKm} km</small></span><Badge variant={statusVariant(match.status)}>{matchStatusLabel[match.status]}</Badge></button>)}
                  </div>
                </Card>
              </div>
              <Card className="operations-panel operations-activity-panel">
                <div className="operations-panel-head"><div><span>AUDIT TRAIL</span><h2>최근 운영 기록</h2></div><button type="button" onClick={() => setView("admin")}>감사 기록</button></div>
                <ActivityList activities={state.activities.slice(0, 5)} />
              </Card>
            </>
          )}

          {view === "listings" && (
            <Card className="operations-panel operations-list-panel">
              <div className="operations-toolbar">
                <div className="operations-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="항만, 기관, 토질 검색" /></div>
                <div className="operations-filter"><Filter size={14} />{(["all", "supply", "demand"] as const).map((kind) => <button key={kind} type="button" className={listingFilter === kind ? "active" : ""} onClick={() => setListingFilter(kind)}>{kind === "all" ? "전체" : listingKindLabel[kind]}</button>)}</div>
              </div>
              <div className="operations-table" role="table" aria-label="준설토와 복원 수요 목록">
                <div className="operations-table-row heading" role="row"><span>구분·사업명</span><span>기관·위치</span><span>물량</span><span>작업 기간</span><span>상태</span><span>관리</span></div>
                {filteredListings.map((listing) => (
                  <div className="operations-table-row" role="row" key={listing.id}>
                    <span><Badge variant={listing.kind === "supply" ? "default" : "warning"}>{listingKindLabel[listing.kind]}</Badge><strong>{listing.title}</strong><small>{listing.material}</small></span>
                    <span><strong>{listing.organization}</strong><small>{listing.location}</small></span>
                    <span><strong>{number.format(listing.volume)}</strong><small>m³</small></span>
                    <span>{listing.period}</span>
                    <span><Badge variant={listing.status === "matched" ? "success" : "secondary"}>{listing.status === "matched" ? "매칭됨" : listing.status === "open" ? "등록" : "종료"}</Badge></span>
                    <span className="operations-row-actions"><button type="button" aria-label={`${listing.title} 수정`} onClick={() => setListingDraft({ ...listing, volume: String(listing.volume) })}><Pencil size={14} /></button><button type="button" aria-label={`${listing.title} 삭제`} onClick={() => deleteListing(listing)}><Trash2 size={14} /></button></span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {view === "matches" && selectedMatch && (
            <div className="operations-workflow-grid">
              <Card className="operations-panel operations-match-list">
                <div className="operations-panel-head"><div><span>MATCHES</span><h2>진행 프로젝트</h2></div></div>
                {state.matches.map((match) => <button type="button" key={match.id} className={selectedMatch.id === match.id ? "active" : ""} onClick={() => setSelectedMatchId(match.id)}><span><strong>{match.projectName}</strong><small>{number.format(match.matchedVolume)} m³ · 담당 {match.assignee}</small></span><Badge variant={statusVariant(match.status)}>{matchStatusLabel[match.status]}</Badge></button>)}
              </Card>
              <Card className="operations-panel operations-workflow-detail">
                <div className="operations-panel-head"><div><span>PROJECT {selectedMatch.id.toUpperCase()}</span><h2>{selectedMatch.projectName}</h2></div><Link href="/">3D 설계 열기 <Globe2 size={14} /></Link></div>
                <div className="workflow-summary"><div><small>매칭 점수</small><strong>{selectedMatch.score}점</strong></div><div><small>운송 거리</small><strong>{selectedMatch.distanceKm} km</strong></div><div><small>연계 물량</small><strong>{number.format(selectedMatch.matchedVolume)} m³</strong></div><div><small>담당자</small><strong>{selectedMatch.assignee}</strong></div></div>
                <div className="workflow-rail">
                  {matchStatusOrder.map((status, index) => { const currentIndex = matchStatusOrder.indexOf(selectedMatch.status); const complete = selectedMatch.status !== "rejected" && index <= currentIndex; return <div key={status} className={`${complete ? "complete" : ""} ${selectedMatch.status === status ? "current" : ""}`}><i>{complete ? <Check size={12} /> : index + 1}</i><span>{matchStatusLabel[status]}</span></div>; })}
                </div>
                <div className="workflow-actions">
                  {nextMatchStatus(selectedMatch.status) && <Button size="sm" onClick={() => transitionMatch(nextMatchStatus(selectedMatch.status)!)}><Check size={14} /> {matchStatusLabel[nextMatchStatus(selectedMatch.status)!]} 처리</Button>}
                  {!["completed", "rejected"].includes(selectedMatch.status) && <Button variant="outline" size="sm" onClick={() => transitionMatch("rejected")}><X size={14} /> 반려</Button>}
                  <label className="ui-button operations-upload-button"><Upload size={14} /> 문서 등록<input type="file" accept=".pdf,.doc,.docx,.xlsx" onChange={uploadDocument} /></label>
                </div>
                <div className="workflow-documents"><h3>연결 문서</h3>{state.documents.filter((document) => document.projectId === selectedMatch.id).map((document) => <div key={document.id}><FileText size={15} /><span><strong>{document.name}</strong><small>{document.category} · {(document.size / 1024 / 1024).toFixed(1)} MB · {document.uploadedBy}</small></span><Badge variant="secondary">등록됨</Badge></div>)}</div>
              </Card>
            </div>
          )}

          {view === "data" && (
            <div className="operations-data-grid">
              <Card className="operations-panel operations-upload-zone">
                <Upload size={24} /><h2>공간 데이터 등록</h2><p>GeoJSON은 브라우저에서 즉시 구조를 검증합니다. GeoTIFF·DEM은 R2와 처리 Worker 연결 전까지 메타데이터만 보관합니다.</p>
                <label className="ui-button"><PackagePlus size={15} /> 파일 선택<input type="file" accept=".geojson,.json,.tif,.tiff,.dem,.csv" onChange={uploadSpatialData} /></label>
              </Card>
              <Card className="operations-panel operations-upload-zone">
                <FileArchive size={24} /><h2>사업 증빙 문서</h2><p>시험성적서, 허가서, 계약서를 선택한 매칭 프로젝트에 등록합니다.</p>
                <label className="ui-button"><Upload size={15} /> 문서 선택<input type="file" accept=".pdf,.doc,.docx,.xlsx" onChange={uploadDocument} /></label>
              </Card>
              <Card className="operations-panel operations-dataset-list">
                <div className="operations-panel-head"><div><span>DATASETS</span><h2>등록 데이터</h2></div></div>
                {state.datasets.map((dataset) => <div key={dataset.id}><Database size={16} /><span><strong>{dataset.name}</strong><small>{dataset.format} · {(dataset.size / 1024 / 1024).toFixed(1)} MB{dataset.featureCount !== undefined ? ` · ${dataset.featureCount}개 피처` : ""}</small></span><Badge variant={dataset.status === "validated" ? "success" : dataset.status === "processing" ? "default" : "warning"}>{dataset.status === "validated" ? "검증 완료" : dataset.status === "processing" ? "처리 중" : "메타데이터"}</Badge></div>)}
              </Card>
            </div>
          )}

          {view === "admin" && (
            <div className="operations-admin-grid">
              <Card className="operations-panel operations-members"><div className="operations-panel-head"><div><span>MEMBERS</span><h2>기관 및 역할</h2></div><Users size={18} /></div>{state.users.map((user) => <div key={user.id}><span className="member-avatar">{user.name.slice(0, 1)}</span><span><strong>{user.name}</strong><small>{user.organization}</small></span><Badge variant={user.role === "admin" ? "default" : "secondary"}>{roleLabel[user.role]}</Badge></div>)}</Card>
              <Card className="operations-panel operations-audit"><div className="operations-panel-head"><div><span>IMMUTABLE EVENT VIEW</span><h2>작업 및 감사 기록</h2></div><Activity size={18} /></div><ActivityList activities={state.activities} /></Card>
              <Card className="operations-panel operations-system-card"><div><Database size={18} /><span><strong>저장소 상태</strong><small>{source === "cloud" ? "Cloudflare Worker · D1 · R2" : "브라우저 localStorage · 시연 모드"}</small></span></div><Button variant="outline" size="sm" onClick={restoreDemo}><RefreshCw size={14} /> 시연 데이터 초기화</Button></Card>
            </div>
          )}

          <div className="operations-toast" role="status"><span className={source === "cloud" ? "online" : "demo"} />{notice}</div>
        </section>
      </div>

      {listingDraft && (
        <div className="operations-modal-backdrop" role="presentation">
          <form className="operations-modal" onSubmit={saveListing}>
            <div className="operations-modal-head"><div><span>{listingDraft.id ? "EDIT LISTING" : "NEW LISTING"}</span><h2>{listingDraft.id ? "등록 정보 수정" : "새 운영 항목 등록"}</h2></div><button type="button" onClick={() => setListingDraft(null)} aria-label="닫기"><X size={18} /></button></div>
            <div className="operations-form-grid">
              <label>구분<select value={listingDraft.kind} onChange={(event) => setListingDraft({ ...listingDraft, kind: event.target.value as ListingKind })}><option value="supply">준설토 공급</option><option value="demand">복원 수요</option></select></label>
              <label>기관<input required value={listingDraft.organization} onChange={(event) => setListingDraft({ ...listingDraft, organization: event.target.value })} /></label>
              <label className="wide">사업명<input required value={listingDraft.title} onChange={(event) => setListingDraft({ ...listingDraft, title: event.target.value })} placeholder="예: 부산신항 항로 유지 준설토" /></label>
              <label>위치<input required value={listingDraft.location} onChange={(event) => setListingDraft({ ...listingDraft, location: event.target.value })} /></label>
              <label>물량 (m³)<input required type="number" min="1" value={listingDraft.volume} onChange={(event) => setListingDraft({ ...listingDraft, volume: event.target.value })} /></label>
              <label>토질·입도<input required value={listingDraft.material} onChange={(event) => setListingDraft({ ...listingDraft, material: event.target.value })} /></label>
              <label>작업 기간<input required value={listingDraft.period} onChange={(event) => setListingDraft({ ...listingDraft, period: event.target.value })} placeholder="2027.01–2027.03" /></label>
            </div>
            <div className="operations-modal-actions"><Button type="button" variant="outline" onClick={() => setListingDraft(null)}>취소</Button><Button type="submit"><Check size={15} /> 저장</Button></div>
          </form>
        </div>
      )}
    </main>
  );
}

function ActivityList({ activities }: { activities: OperationsState["activities"] }) {
  return <div className="operations-activity-list">{activities.map((activity) => <div key={activity.id}><i><Activity size={13} /></i><span><strong>{activity.action}</strong><small>{activity.target} · {activity.actor}</small></span><time>{formatActivityTime(activity.at)}</time></div>)}</div>;
}
