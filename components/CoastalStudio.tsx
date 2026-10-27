"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Anchor, BarChart3, BoxSelect, Check, ChevronRight, CircleHelp, Database, Eye,
  Globe2, Layers3, LayoutDashboard, MapPinned, Maximize2, Minimize2, Mountain, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen, PanelTop, Route, Save, Ship, SlidersHorizontal,
  Undo2, Waves, X,
} from "lucide-react";
import CesiumScene from "./CesiumScene";
import ErosionRiskCard from "./ErosionRiskCard";
import OperationsInsight from "./OperationsInsight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { candidates, initialProject } from "@/lib/demoData";
import { centroid, distanceKm, polygonAreaMeters } from "@/lib/geo";
import type { CandidateKind, CompareMode, ProjectState, StepId } from "@/lib/types";

type SafariFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type SafariFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const steps = [
  { id: 1 as StepId, eyebrow: "STEP 01", title: "후보지 선정", icon: MapPinned },
  { id: 2 as StepId, eyebrow: "STEP 02", title: "준설 설계", icon: Anchor },
  { id: 3 as StepId, eyebrow: "STEP 03", title: "활용·복원 설계", icon: Waves },
];

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const PROJECT_STORAGE_KEY = "siltda-project-v2";

export default function CoastalStudio() {
  const [step, setStep] = useState<StepId>(1);
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [compareMode, setCompareMode] = useState<CompareMode>("after");
  const [drawTarget, setDrawTarget] = useState<"dredge" | "restore" | null>(null);
  const [satelliteVisible, setSatelliteVisible] = useState(true);
  const [candidatesVisible, setCandidatesVisible] = useState(true);
  const [flowVisible, setFlowVisible] = useState(true);
  const [volumeMarkersVisible, setVolumeMarkersVisible] = useState(true);
  const [mapStatus, setMapStatus] = useState("3D 엔진 초기화 중");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("가상 수심 DEM · 실제 측량 자료가 아닙니다");
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [candidateFocus, setCandidateFocus] = useState<{ id: string | null; requestId: number }>({ id: null, requestId: 0 });
  const [introActive, setIntroActive] = useState(true);
  const [introRunId, setIntroRunId] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [splashPhase, setSplashPhase] = useState<"visible" | "leaving" | "hidden">("visible");
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const splashVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<ProjectState>;
        const depositStillExists = candidates.some((candidate) => candidate.kind === "deposit" && candidate.id === parsed.selectedDepositId);
        const demandStillExists = candidates.some((candidate) => candidate.kind === "erosion" && candidate.id === parsed.selectedErosionId);
        const selectedDepositId = depositStillExists ? parsed.selectedDepositId ?? initialProject.selectedDepositId : initialProject.selectedDepositId;
        const selectedErosionId = demandStillExists ? parsed.selectedErosionId ?? initialProject.selectedErosionId : initialProject.selectedErosionId;
        setProject({
          ...initialProject,
          ...parsed,
          selectedDepositId,
          selectedErosionId,
          ...(!demandStillExists ? { restorationPolygon: initialProject.restorationPolygon } : {}),
        });
      } catch { /* ignore corrupt demo state */ }
    }
  }, []);

  useEffect(() => {
    const doc = document as SafariFullscreenDocument;
    const root = document.documentElement as SafariFullscreenElement;
    setFullscreenSupported(Boolean(root.requestFullscreen || root.webkitRequestFullscreen));
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 640px)");
    const syncPanels = () => {
      if (mobile.matches) {
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
      } else {
        setLeftPanelOpen(true);
        setRightPanelOpen(true);
      }
    };
    syncPanels();
    mobile.addEventListener("change", syncPanels);
    return () => mobile.removeEventListener("change", syncPanels);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumSplashElapsed(true), 3900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (splashPhase === "hidden") return;
    const video = splashVideoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    const resume = () => void video.play().catch(() => undefined);
    resume();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("touchstart", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("touchstart", resume);
    };
  }, [splashPhase]);

  useEffect(() => {
    if (!sceneReady || !minimumSplashElapsed) return;
    setSplashPhase((current) => current === "visible" ? "leaving" : current);
  }, [minimumSplashElapsed, sceneReady]);

  useEffect(() => {
    if (splashPhase !== "leaving") return;
    const timer = window.setTimeout(() => {
      setSplashPhase("hidden");
      setIntroRunId((current) => current + 1);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [splashPhase]);

  const deposit = candidates.find((candidate) => candidate.id === project.selectedDepositId) ?? candidates[0];
  const erosion = candidates.find((candidate) => candidate.id === project.selectedErosionId) ?? candidates[2];
  const dredgeArea = polygonAreaMeters(project.dredgePolygon);
  const restorationArea = polygonAreaMeters(project.restorationPolygon);
  const dredgeVolume = dredgeArea * project.dredgeDepth * 0.92;
  const restorationVolume = restorationArea * project.fillThickness * 1.12;
  const balance = dredgeVolume - restorationVolume;
  const routeDistance = distanceKm(centroid(deposit.polygon), centroid(erosion.polygon));
  const completion = Math.min(100, Math.round(((project.dredgePolygon.length >= 3 ? 1 : 0) + (project.restorationPolygon.length >= 3 ? 1 : 0) + (project.selectedDepositId ? 1 : 0) + (project.selectedErosionId ? 1 : 0)) / 4 * 100));

  const activePolygon = step === 2 ? project.dredgePolygon : project.restorationPolygon;

  const selectCandidate = (kind: CandidateKind, id: string) => {
    setProject((current) => ({
      ...current,
      [kind === "deposit" ? "selectedDepositId" : "selectedErosionId"]: id,
    }));
    setCandidateFocus((current) => ({ id, requestId: current.requestId + 1 }));
    setNotice(kind === "deposit" ? "준설 발생지를 프로젝트에 연결했습니다" : "활용 수요지를 프로젝트에 연결했습니다");
    if (window.matchMedia("(max-width: 640px)").matches) {
      setLeftPanelOpen(false);
      setRightPanelOpen(false);
    }
  };

  const toggleLeftPanel = () => {
    const next = !leftPanelOpen;
    setLeftPanelOpen(next);
    if (next && window.matchMedia("(max-width: 640px)").matches) setRightPanelOpen(false);
  };

  const toggleRightPanel = () => {
    const next = !rightPanelOpen;
    setRightPanelOpen(next);
    if (next && window.matchMedia("(max-width: 640px)").matches) setLeftPanelOpen(false);
  };

  const saveProject = () => {
    const next = { ...project, savedAt: new Date().toISOString() };
    setProject(next);
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(next));
    setSaved(true);
    setNotice("프로젝트 상태와 단계별 설계값을 이 브라우저에 저장했습니다");
    window.setTimeout(() => setSaved(false), 1800);
  };

  const finishIntro = useCallback(() => {
    setIntroActive(false);
  }, []);

  useEffect(() => {
    if (splashPhase !== "hidden" || !introActive) return;
    const timer = window.setTimeout(finishIntro, 4500);
    return () => window.clearTimeout(timer);
  }, [finishIntro, introActive, introRunId, splashPhase]);

  const replayIntro = useCallback(() => {
    setIntroRunId((current) => current + 1);
    setIntroActive(true);
  }, []);

  const toggleFullscreen = async () => {
    const doc = document as SafariFullscreenDocument;
    const root = document.documentElement as SafariFullscreenElement;
    try {
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      } else if (root.requestFullscreen) {
        await root.requestFullscreen({ navigationUI: "hide" });
      } else {
        await root.webkitRequestFullscreen?.();
      }
    } catch {
      setNotice("이 브라우저에서는 메뉴의 홈 화면 추가 후 전체 화면으로 사용할 수 있습니다");
    }
  };

  const changeStep = (next: StepId) => {
    setStep(next);
    setDrawTarget(null);
    setCompareMode(next === 1 ? "before" : "after");
  };

  const clearPolygon = () => {
    setProject((current) => ({
      ...current,
      [step === 2 ? "dredgePolygon" : "restorationPolygon"]: [],
    }));
    setDrawTarget(step === 2 ? "dredge" : "restore");
  };

  const undoVertex = () => {
    const key = step === 2 ? "dredgePolygon" : "restorationPolygon";
    setProject((current) => ({ ...current, [key]: current[key].slice(0, -1) }));
  };

  const currentCandidates = useMemo(() => candidates.filter((candidate) => (
    step === 1 || step === 2 ? candidate.kind === "deposit" : candidate.kind === "erosion"
  )), [step]);

  return (
    <main className={`studio-shell step-${step} ${introActive ? "intro-active" : "workspace-active"}`}>
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-copy">
            <span className="brand-mark">silt<span>DA</span></span>
            <span className="brand-subtitle">Coastal studio</span>
          </div>
        </div>
        <div className="project-identity">
          <span className="project-kicker">프로젝트</span>
          <strong>부산항 준설토 활용 실증</strong>
          <span className="project-id">SDA-BUSAN-2607</span>
        </div>
        <div className="header-status">
          <Badge variant="secondary" className="data-badge"><Database size={14} /> {mapStatus}</Badge>
          <Link href="/operations" className="ui-button operations-link"><LayoutDashboard size={15} /> 운영 콘솔</Link>
          <Button variant="outline" size="sm" className="globe-button" onClick={replayIntro}><Globe2 size={15} /> 지구본 보기</Button>
          {fullscreenSupported && (
            <Button variant="outline" size="sm" className="fullscreen-button" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {isFullscreen ? "전체 화면 종료" : "전체 화면"}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="icon-button" title="도움말"><CircleHelp size={18} /></Button>
          <Button size="sm" className={`save-button ${saved ? "saved" : ""}`} onClick={saveProject}>
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? "저장됨" : "프로젝트 저장"}
          </Button>
        </div>
      </header>

      <div className={`workspace-grid ${leftPanelOpen ? "" : "left-panel-collapsed"} ${rightPanelOpen ? "" : "right-panel-collapsed"} ${leftPanelOpen || rightPanelOpen ? "mobile-panel-open" : ""}`}>
        <button
          type="button"
          className="mobile-panel-backdrop"
          aria-label="사이드바 닫기"
          aria-hidden={!(leftPanelOpen || rightPanelOpen)}
          tabIndex={leftPanelOpen || rightPanelOpen ? 0 : -1}
          onClick={() => { setLeftPanelOpen(false); setRightPanelOpen(false); }}
        />
        <aside className="left-panel glass-panel" aria-hidden={!leftPanelOpen}>
          <div className="workflow-heading">
            <span>설계 과정</span>
            <span className="panel-heading-actions">
              <strong>{completion}%</strong>
              <Button variant="ghost" size="icon" className="mobile-panel-close" onClick={() => setLeftPanelOpen(false)} aria-label="설계 도구 닫기"><X size={16} /></Button>
            </span>
          </div>
          <Progress value={completion} className="workflow-progress" />

          <nav className="step-nav" aria-label="설계 단계">
            {steps.map(({ id, eyebrow, title, icon: Icon }) => (
              <Button key={id} variant="ghost" className={step === id ? "active" : ""} onClick={() => changeStep(id)}>
                <span className="step-icon"><Icon size={17} /></span>
                <span><small>{eyebrow}</small><strong>{title}</strong></span>
                <ChevronRight size={15} />
              </Button>
            ))}
          </nav>

          <Separator className="panel-separator" />
          <section className="tool-section">
            <div className="section-label"><Layers3 size={14} /> 지도 레이어</div>
            <div className="toggle-row">
              <span><Eye size={14} /> 위성영상</span>
              <Switch checked={satelliteVisible} onCheckedChange={setSatelliteVisible} aria-label="위성영상 표시" />
            </div>
            <div className="toggle-row">
              <span><BoxSelect size={14} /> 후보지 경계</span>
              <Switch checked={candidatesVisible} onCheckedChange={setCandidatesVisible} aria-label="후보지 경계 표시" />
            </div>
            <div className="toggle-row">
              <span><BarChart3 size={14} /> 수급 물량 기둥</span>
              <Switch checked={volumeMarkersVisible} onCheckedChange={setVolumeMarkersVisible} aria-label="수급 물량 기둥 표시" />
            </div>
            <div className="toggle-row">
              <span><Route size={14} /> 매칭 운송 흐름</span>
              <Switch checked={flowVisible} onCheckedChange={setFlowVisible} aria-label="매칭 운송 흐름 표시" />
            </div>
            <div className="toggle-row muted-toggle">
              <span><Mountain size={14} /> 가상 수심 DEM</span>
              <Switch checked disabled aria-label="가상 수심 DEM 표시" />
            </div>
          </section>

          {step === 1 ? (
            <section className="candidate-list">
            <div className="section-label"><MapPinned size={14} /> 후보지</div>
              {candidates.map((candidate) => {
                const selected = candidate.id === project.selectedDepositId || candidate.id === project.selectedErosionId;
                return (
                  <Button key={candidate.id} variant="ghost" className={`candidate-item ${selected ? "selected" : ""}`} onClick={() => selectCandidate(candidate.kind, candidate.id)}>
                    <span className={`site-dot ${candidate.kind}`} />
                    <span className="candidate-copy">
                      <strong>{candidate.name}</strong>
                      <small>{candidate.subtitle}</small>
                    </span>
                    <span className="score">{candidate.matchScore}</span>
                  </Button>
                );
              })}
            </section>
          ) : (
            <section className="draw-tools">
              <div className="section-label"><SlidersHorizontal size={14} /> 구역 편집</div>
              <Button className={`primary-tool ${drawTarget ? "active" : ""}`} onClick={() => setDrawTarget(drawTarget ? null : (step === 2 ? "dredge" : "restore"))}>
                <BoxSelect size={16} /> {drawTarget ? "입력 완료" : `${step === 2 ? "준설" : "복원"} 폴리곤 그리기`}
              </Button>
              <div className="tool-button-grid">
                <Button variant="outline" size="sm" onClick={undoVertex} disabled={!activePolygon.length}><Undo2 size={15} /> 실행 취소</Button>
                <Button variant="outline" size="sm" onClick={clearPolygon}><X size={15} /> 다시 그리기</Button>
              </div>
              <p className="microcopy">꼭짓점 {activePolygon.length}개 · 흰색 핸들을 드래그하면 경계가 즉시 갱신됩니다.</p>
            </section>
          )}

          <div className="data-disclaimer">
            <Database size={15} />
            <span><strong>가상 데이터</strong> 표시된 수심과 지형 변형은 시각화용 데이터입니다.</span>
          </div>
        </aside>

        <section className="map-column">
          {!introActive && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="panel-toggle panel-toggle-left"
                onClick={toggleLeftPanel}
                aria-label={leftPanelOpen ? "왼쪽 사이드바 닫기" : "왼쪽 사이드바 열기"}
                aria-expanded={leftPanelOpen}
                title={leftPanelOpen ? "설계 도구 닫기" : "설계 도구 열기"}
              >
                {leftPanelOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="panel-toggle panel-toggle-right"
                onClick={toggleRightPanel}
                aria-label={rightPanelOpen ? "오른쪽 사이드바 닫기" : "오른쪽 사이드바 열기"}
                aria-expanded={rightPanelOpen}
                title={rightPanelOpen ? "후보지 정보 닫기" : "후보지 정보 열기"}
              >
                {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              </Button>
            </>
          )}
          <CesiumScene
            project={project}
            step={step}
            introActive={introActive}
            introPlaying={introActive && splashPhase === "hidden"}
            introRunId={introRunId}
            compareMode={compareMode}
            drawTarget={drawTarget}
            satelliteVisible={satelliteVisible}
            candidatesVisible={candidatesVisible}
            flowVisible={flowVisible}
            volumeMarkersVisible={volumeMarkersVisible}
            focusCandidateId={candidateFocus.id}
            focusRequestId={candidateFocus.requestId}
            onProjectChange={setProject}
            onSelectCandidate={selectCandidate}
            onMapReady={setMapStatus}
            onSceneReady={() => setSceneReady(true)}
            onIntroComplete={finishIntro}
          />

          {splashPhase !== "hidden" && (
            <div className={`ocean-splash ${splashPhase === "leaving" ? "leaving" : ""}`} aria-label="3D 지도 준비 중">
              <video ref={splashVideoRef} autoPlay muted loop playsInline preload="auto" poster="/media/ocean-poster.jpg" aria-hidden="true">
                <source src="/media/ocean-loop.mp4" type="video/mp4" />
              </video>
              <div className="ocean-splash-shade" aria-hidden="true" />
              <div className="ocean-splash-wordmark" aria-label="siltDA">
                <span aria-hidden="true">siltDA</span>
              </div>
              {fullscreenSupported && !isFullscreen && (
                <Button type="button" variant="outline" className="ocean-fullscreen-button" onClick={toggleFullscreen}>
                  <Maximize2 size={16} /> 전체 화면으로 시작
                </Button>
              )}
            </div>
          )}

          {!introActive && step > 1 && (
            <div className="comparison-switch" role="group" aria-label="지형 비교 모드">
              {(["before", "after", "compare", "section"] as CompareMode[]).map((mode) => (
                <Button key={mode} variant="ghost" size="sm" className={compareMode === mode ? "active" : ""} onClick={() => setCompareMode(mode)}>
                  {{ before: "작업 전", after: "작업 후", compare: "전후 비교", section: "단면도" }[mode]}
                </Button>
              ))}
            </div>
          )}

          {!introActive && compareMode === "section" && step > 1 && (
            <Card className="section-chart glass-panel">
              <div className="section-chart-head">
                <span>{step === 2 ? "준설 횡단면 A—A′" : "복원 횡단면 B—B′"}</span>
                <small>수직 배율 4× · 가상 수심 DEM</small>
              </div>
              <svg viewBox="0 0 720 140" role="img" aria-label="작업 전후 단면도">
                <defs>
                  <linearGradient id="fillSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0ea5e9" stopOpacity=".34"/><stop offset="1" stopColor="#082f49" stopOpacity=".08"/></linearGradient>
                </defs>
                <path d="M0 46 C90 48 150 38 238 44 S400 55 486 43 S620 37 720 45 L720 140 L0 140 Z" fill="url(#fillSea)" />
                <path d="M0 77 C98 74 160 83 248 78 S410 75 510 82 S640 70 720 75" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 6" />
                <path d={step === 2 ? "M0 77 C120 74 182 82 250 80 L285 111 L448 111 L494 80 C580 78 650 72 720 75" : "M0 77 C120 74 182 82 250 80 L305 58 L430 58 L494 80 C580 78 650 72 720 75"} fill="none" stroke={step === 2 ? "#22d3ee" : "#fbbf24"} strokeWidth="4" />
                <text x="12" y="102" fill="#94a3b8" fontSize="12">작업 전</text>
                <text x="620" y="112" fill={step === 2 ? "#22d3ee" : "#fbbf24"} fontSize="12">작업 후</text>
              </svg>
            </Card>
          )}
        </section>

        <aside className="right-panel glass-panel" aria-hidden={!rightPanelOpen}>
          <div className="inspector-heading">
            <span>{step === 1 ? "후보지 정보" : step === 2 ? "준설 설계" : "활용·복원 설계"}</span>
            <span className="panel-heading-actions">
              <Badge variant="success" className="quality-chip"><span /> 데이터 확인됨</Badge>
              <Button variant="ghost" size="icon" className="mobile-panel-close" onClick={() => setRightPanelOpen(false)} aria-label="후보지 정보 닫기"><X size={16} /></Button>
            </span>
          </div>

          {step === 1 ? (
            <>
              <Card className="selection-card deposit-card">
                <span className="card-eyebrow">준설 발생지 · 공급원</span>
                <h2>{deposit.name}</h2>
                <p>{deposit.subtitle}</p>
                <div className="property-grid">
                  <div><small>가용 물량</small><strong>{compact.format(deposit.volume)} m³</strong></div>
                  <div><small>적합도</small><strong>{deposit.matchScore}<i>/100</i></strong></div>
                </div>
                <dl><div><dt>토질</dt><dd>{deposit.soil}</dd></div><div><dt>입도 분포</dt><dd>{deposit.grain}</dd></div></dl>
              </Card>
              <div className="match-connector"><span /><strong>{routeDistance.toFixed(1)} km</strong><span /></div>
              <Card className="selection-card erosion-card">
                <span className="card-eyebrow">활용처 · 수요 대상</span>
                <h2>{erosion.name}</h2>
                <p>{erosion.subtitle}</p>
                <div className="property-grid">
                  <div><small>설계 물량</small><strong>{compact.format(erosion.volume)} m³</strong></div>
                  <div><small>{erosion.demandMetricLabel ?? "검토 지표"}</small><strong>{erosion.demandMetricValue ?? "검토 중"}</strong></div>
                </div>
                <dl><div><dt>수용 조건</dt><dd>{erosion.soil}</dd></div><div><dt>재료 조건</dt><dd>{erosion.grain}</dd></div></dl>
              </Card>
              {erosion.demandType === "beach" && <ErosionRiskCard candidateId={erosion.id} />}
              <OperationsInsight deposit={deposit} erosion={erosion} distanceKm={routeDistance} />
              <Card className="recommendation-box">
                <Check size={16} />
                <div><strong>연결 검토 결과</strong><p>{erosion.demandType === "beach" ? "현재 뻘질 준설토는 양빈에 부적합합니다. 사질분 선별 물량만 별도 검토하세요." : "세립질 수용 조건과 공정 시기가 유사합니다. 토양오염 시험 적합 후 연결할 수 있습니다."}</p></div>
              </Card>
            </>
          ) : (
            <>
              <section className="model-summary">
                <span className="card-eyebrow">{step === 2 ? "사용자 정의 굴착 메시" : "사용자 정의 성토 메시"}</span>
                <h2>{step === 2 ? "준설 구역 설계" : "활용 구역 설계"}</h2>
                <p>Cesium 지형과 분리된 사용자 정의 삼각형 메시를 실시간으로 갱신합니다.</p>
              </section>

              <section className="metric-stack">
                <Card className="large-metric">
                  <small>선택 면적</small>
                  <strong>{integer.format(step === 2 ? dredgeArea : restorationArea)} <i>m²</i></strong>
                </Card>
                <Card className="large-metric accent">
                  <small>{step === 2 ? "예상 준설량" : "투입 필요량"}</small>
                  <strong>{integer.format(step === 2 ? dredgeVolume : restorationVolume)} <i>m³</i></strong>
                </Card>
              </section>

              <Card className="slider-panel">
                <div className="slider-heading">
                  <span>{step === 2 ? "굴착 깊이" : "성토 두께"}</span>
                  <strong>{step === 2 ? project.dredgeDepth.toFixed(1) : project.fillThickness.toFixed(1)} m</strong>
                </div>
                <input
                  type="range"
                  min={step === 2 ? 0.5 : 0.2}
                  max={step === 2 ? 8 : 4}
                  step="0.1"
                  value={step === 2 ? project.dredgeDepth : project.fillThickness}
                  onChange={(event) => setProject((current) => ({
                    ...current,
                    [step === 2 ? "dredgeDepth" : "fillThickness"]: Number(event.target.value),
                  }))}
                />
                <div className="range-labels"><span>{step === 2 ? "0.5 m" : "0.2 m"}</span><span>{step === 2 ? "8.0 m" : "4.0 m"}</span></div>
              </Card>

              <section className="calculation-card">
                <div><span>평면 면적</span><strong>{integer.format(step === 2 ? dredgeArea : restorationArea)} m²</strong></div>
                <div><span>{step === 2 ? "굴착 깊이" : "투입 두께"}</span><strong>{step === 2 ? project.dredgeDepth : project.fillThickness} m</strong></div>
                <div><span>{step === 2 ? "경사 보정" : "다짐 보정"}</span><strong>{step === 2 ? "0.92" : "1.12"}</strong></div>
                <div className="formula"><span>계산식</span><code>면적 × 높이 × 보정계수</code></div>
              </section>

              {step === 3 && (
                <Card className={`balance-callout ${balance < 0 ? "shortage" : "surplus"}`}>
                  <span>{balance < 0 ? "공급 부족" : "잔여 준설토"}</span>
                  <strong>{integer.format(Math.abs(balance))} m³</strong>
                  <p>{balance < 0 ? "활용 설계를 축소하거나 추가 공급원을 연결하세요." : "잔여량은 인근 매립·습지 후보지에 재배분할 수 있습니다."}</p>
                </Card>
              )}
            </>
          )}

          <div className="inspector-footer">
            <span><PanelTop size={14} /> {step === 1 ? "두 후보가 프로젝트에 저장됨" : `${activePolygon.length}개 꼭짓점 · 실시간 계산`}</span>
          </div>
        </aside>
      </div>

      <footer className="material-balance">
        <div className="balance-title">
          <Ship size={18} />
          <span><small>토량 수급</small><strong>준설토 수급 현황</strong></span>
        </div>
        <div className="balance-stat supply"><small>준설 공급량</small><strong>{integer.format(dredgeVolume)} <i>m³</i></strong></div>
        <div className="balance-flow"><span style={{ width: `${Math.min(100, restorationVolume && dredgeVolume ? (Math.min(dredgeVolume, restorationVolume) / Math.max(dredgeVolume, restorationVolume)) * 100 : 0)}%` }} /></div>
        <div className="balance-stat demand"><small>활용 필요량</small><strong>{integer.format(restorationVolume)} <i>m³</i></strong></div>
        <div className={`balance-result ${balance < 0 ? "negative" : "positive"}`}>
          <small>{balance < 0 ? "부족" : "잔여"}</small>
          <strong>{balance < 0 ? "−" : "+"}{integer.format(Math.abs(balance))} m³</strong>
        </div>
        <div className="system-note"><span className="status-light" />{notice}</div>
      </footer>
    </main>
  );
}
