"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Anchor, BoxSelect, Check, ChevronRight, CircleHelp, Database, Eye,
  Layers3, MapPinned, Mountain, PanelTop, Rotate3D, Save, Ship, SlidersHorizontal,
  Sparkles, Undo2, Waves, X, ZoomIn,
} from "lucide-react";
import CesiumScene from "./CesiumScene";
import { candidates, initialProject } from "@/lib/demoData";
import { centroid, distanceKm, polygonAreaMeters } from "@/lib/geo";
import type { CandidateKind, CompareMode, ProjectState, StepId } from "@/lib/types";

const steps = [
  { id: 1 as StepId, eyebrow: "STEP 01", title: "후보지 선정", icon: MapPinned },
  { id: 2 as StepId, eyebrow: "STEP 02", title: "준설 설계", icon: Anchor },
  { id: 3 as StepId, eyebrow: "STEP 03", title: "복원 설계", icon: Waves },
];

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export default function CoastalStudio() {
  const [step, setStep] = useState<StepId>(1);
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [compareMode, setCompareMode] = useState<CompareMode>("after");
  const [drawTarget, setDrawTarget] = useState<"dredge" | "restore" | null>(null);
  const [satelliteVisible, setSatelliteVisible] = useState(true);
  const [candidatesVisible, setCandidatesVisible] = useState(true);
  const [mapStatus, setMapStatus] = useState("3D 엔진 초기화 중");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("가상 수심 DEM · 실제 측량 자료가 아닙니다");

  useEffect(() => {
    const stored = localStorage.getItem("siltda-project-v1");
    if (stored) {
      try { setProject({ ...initialProject, ...JSON.parse(stored) }); } catch { /* ignore corrupt demo state */ }
    }
  }, []);

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
    setNotice(kind === "deposit" ? "퇴적지 후보를 프로젝트에 연결했습니다" : "침식지 후보를 프로젝트에 연결했습니다");
  };

  const saveProject = () => {
    const next = { ...project, savedAt: new Date().toISOString() };
    setProject(next);
    localStorage.setItem("siltda-project-v1", JSON.stringify(next));
    setSaved(true);
    setNotice("프로젝트 상태와 단계별 설계값을 이 브라우저에 저장했습니다");
    window.setTimeout(() => setSaved(false), 1800);
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
    <main className="studio-shell">
      <header className="app-header">
        <div className="brand-block">
          <video className="brand-video" autoPlay muted loop playsInline aria-hidden="true">
            <source src="/media/ocean-loop.mp4" type="video/mp4" />
          </video>
          <div className="brand-copy">
            <span className="brand-mark">silt<span>DA</span></span>
            <span className="brand-subtitle">COASTAL DIGITAL TWIN</span>
          </div>
        </div>
        <div className="project-identity">
          <span className="project-kicker">ACTIVE PROJECT</span>
          <strong>부산 연안 퇴적물 순환 실증</strong>
          <span className="project-id">SDA-BUSAN-2607</span>
        </div>
        <div className="header-status">
          <span className="data-badge"><Database size={14} /> {mapStatus}</span>
          <button className="icon-button" title="도움말"><CircleHelp size={18} /></button>
          <button className={`save-button ${saved ? "saved" : ""}`} onClick={saveProject}>
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? "저장됨" : "프로젝트 저장"}
          </button>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="left-panel glass-panel">
          <div className="workflow-heading">
            <span>WORKFLOW</span>
            <strong>{completion}%</strong>
          </div>
          <div className="workflow-progress"><span style={{ width: `${completion}%` }} /></div>

          <nav className="step-nav" aria-label="설계 단계">
            {steps.map(({ id, eyebrow, title, icon: Icon }) => (
              <button key={id} className={step === id ? "active" : ""} onClick={() => changeStep(id)}>
                <span className="step-icon"><Icon size={17} /></span>
                <span><small>{eyebrow}</small><strong>{title}</strong></span>
                <ChevronRight size={15} />
              </button>
            ))}
          </nav>

          <section className="tool-section">
            <div className="section-label"><Layers3 size={14} /> 지도 레이어</div>
            <label className="toggle-row">
              <span><Eye size={14} /> 위성영상</span>
              <input type="checkbox" checked={satelliteVisible} onChange={(event) => setSatelliteVisible(event.target.checked)} />
              <i />
            </label>
            <label className="toggle-row">
              <span><BoxSelect size={14} /> 후보지 경계</span>
              <input type="checkbox" checked={candidatesVisible} onChange={(event) => setCandidatesVisible(event.target.checked)} />
              <i />
            </label>
            <label className="toggle-row muted-toggle">
              <span><Mountain size={14} /> 가상 수심 DEM</span>
              <input type="checkbox" checked readOnly />
              <i />
            </label>
          </section>

          {step === 1 ? (
            <section className="candidate-list">
              <div className="section-label"><Sparkles size={14} /> AI 추천 후보</div>
              {candidates.map((candidate) => {
                const selected = candidate.id === project.selectedDepositId || candidate.id === project.selectedErosionId;
                return (
                  <button key={candidate.id} className={`candidate-item ${selected ? "selected" : ""}`} onClick={() => selectCandidate(candidate.kind, candidate.id)}>
                    <span className={`site-dot ${candidate.kind}`} />
                    <span className="candidate-copy">
                      <strong>{candidate.name}</strong>
                      <small>{candidate.subtitle}</small>
                    </span>
                    <span className="score">{candidate.matchScore}</span>
                  </button>
                );
              })}
            </section>
          ) : (
            <section className="draw-tools">
              <div className="section-label"><SlidersHorizontal size={14} /> 구역 편집</div>
              <button className={`primary-tool ${drawTarget ? "active" : ""}`} onClick={() => setDrawTarget(drawTarget ? null : (step === 2 ? "dredge" : "restore"))}>
                <BoxSelect size={16} /> {drawTarget ? "입력 완료" : `${step === 2 ? "준설" : "복원"} 폴리곤 그리기`}
              </button>
              <div className="tool-button-grid">
                <button onClick={undoVertex} disabled={!activePolygon.length}><Undo2 size={15} /> 실행 취소</button>
                <button onClick={clearPolygon}><X size={15} /> 다시 그리기</button>
              </div>
              <p className="microcopy">꼭짓점 {activePolygon.length}개 · 흰색 핸들을 드래그하면 경계가 즉시 갱신됩니다.</p>
            </section>
          )}

          <div className="data-disclaimer">
            <Database size={15} />
            <span><strong>DEMO DATA</strong> 표시된 수심과 지형 변형은 시각화용 가상 데이터입니다.</span>
          </div>
        </aside>

        <section className="map-column">
          <CesiumScene
            project={project}
            step={step}
            compareMode={compareMode}
            drawTarget={drawTarget}
            satelliteVisible={satelliteVisible}
            candidatesVisible={candidatesVisible}
            onProjectChange={setProject}
            onSelectCandidate={selectCandidate}
            onMapReady={setMapStatus}
          />

          {step > 1 && (
            <div className="comparison-switch" role="group" aria-label="지형 비교 모드">
              {(["before", "after", "compare", "section"] as CompareMode[]).map((mode) => (
                <button key={mode} className={compareMode === mode ? "active" : ""} onClick={() => setCompareMode(mode)}>
                  {{ before: "작업 전", after: "작업 후", compare: "전후 비교", section: "단면도" }[mode]}
                </button>
              ))}
            </div>
          )}

          {compareMode === "section" && step > 1 && (
            <div className="section-chart glass-panel">
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
            </div>
          )}
        </section>

        <aside className="right-panel glass-panel">
          <div className="inspector-heading">
            <span>{step === 1 ? "SITE INSPECTOR" : step === 2 ? "DREDGING MODEL" : "RESTORATION MODEL"}</span>
            <span className="quality-chip"><span /> VERIFIED INPUT</span>
          </div>

          {step === 1 ? (
            <>
              <section className="selection-card deposit-card">
                <span className="card-eyebrow">퇴적지 · SOURCE</span>
                <h2>{deposit.name}</h2>
                <p>{deposit.subtitle}</p>
                <div className="property-grid">
                  <div><small>가용 물량</small><strong>{compact.format(deposit.volume)} m³</strong></div>
                  <div><small>AI 적합도</small><strong>{deposit.matchScore}<i>/100</i></strong></div>
                </div>
                <dl><div><dt>토질</dt><dd>{deposit.soil}</dd></div><div><dt>입도 분포</dt><dd>{deposit.grain}</dd></div></dl>
              </section>
              <div className="match-connector"><span /><strong>{routeDistance.toFixed(1)} km</strong><span /></div>
              <section className="selection-card erosion-card">
                <span className="card-eyebrow">침식지 · DESTINATION</span>
                <h2>{erosion.name}</h2>
                <p>{erosion.subtitle}</p>
                <div className="property-grid">
                  <div><small>필요 토량</small><strong>{compact.format(erosion.volume)} m³</strong></div>
                  <div><small>연간 침식률</small><strong>{erosion.erosionRate} m</strong></div>
                </div>
                <dl><div><dt>토질</dt><dd>{erosion.soil}</dd></div><div><dt>요구 입도</dt><dd>{erosion.grain}</dd></div></dl>
              </section>
              <div className="recommendation-box">
                <Sparkles size={16} />
                <div><strong>추천 연결</strong><p>입도 조건과 공급 시기가 일치하며 해상 운송 거리가 짧습니다.</p></div>
              </div>
            </>
          ) : (
            <>
              <section className="model-summary">
                <span className="card-eyebrow">{step === 2 ? "CUSTOM EXCAVATION MESH" : "CUSTOM FILL MESH"}</span>
                <h2>{step === 2 ? "준설 구역 설계" : "침식지 복원 설계"}</h2>
                <p>Cesium 지형과 분리된 사용자 정의 삼각형 메시를 실시간으로 갱신합니다.</p>
              </section>

              <section className="metric-stack">
                <div className="large-metric">
                  <small>선택 면적</small>
                  <strong>{integer.format(step === 2 ? dredgeArea : restorationArea)} <i>m²</i></strong>
                </div>
                <div className="large-metric accent">
                  <small>{step === 2 ? "예상 준설량" : "복원 필요량"}</small>
                  <strong>{integer.format(step === 2 ? dredgeVolume : restorationVolume)} <i>m³</i></strong>
                </div>
              </section>

              <section className="slider-panel">
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
              </section>

              <section className="calculation-card">
                <div><span>평면 면적</span><strong>{integer.format(step === 2 ? dredgeArea : restorationArea)} m²</strong></div>
                <div><span>{step === 2 ? "굴착 깊이" : "투입 두께"}</span><strong>{step === 2 ? project.dredgeDepth : project.fillThickness} m</strong></div>
                <div><span>{step === 2 ? "경사 보정" : "다짐 보정"}</span><strong>{step === 2 ? "0.92" : "1.12"}</strong></div>
                <div className="formula"><span>계산식</span><code>면적 × 높이 × 보정계수</code></div>
              </section>

              {step === 3 && (
                <section className={`balance-callout ${balance < 0 ? "shortage" : "surplus"}`}>
                  <span>{balance < 0 ? "공급 부족" : "잔여 준설토"}</span>
                  <strong>{integer.format(Math.abs(balance))} m³</strong>
                  <p>{balance < 0 ? "복원 설계를 축소하거나 추가 공급원을 연결하세요." : "잔여량은 인근 후보지에 재배분할 수 있습니다."}</p>
                </section>
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
          <span><small>MATERIAL BALANCE</small><strong>준설토 수급 현황</strong></span>
        </div>
        <div className="balance-stat supply"><small>준설 공급량</small><strong>{integer.format(dredgeVolume)} <i>m³</i></strong></div>
        <div className="balance-flow"><span style={{ width: `${Math.min(100, restorationVolume && dredgeVolume ? (Math.min(dredgeVolume, restorationVolume) / Math.max(dredgeVolume, restorationVolume)) * 100 : 0)}%` }} /></div>
        <div className="balance-stat demand"><small>복원 필요량</small><strong>{integer.format(restorationVolume)} <i>m³</i></strong></div>
        <div className={`balance-result ${balance < 0 ? "negative" : "positive"}`}>
          <small>{balance < 0 ? "부족" : "잔여"}</small>
          <strong>{balance < 0 ? "−" : "+"}{integer.format(Math.abs(balance))} m³</strong>
        </div>
        <div className="system-note"><span className="status-light" />{notice}</div>
      </footer>
    </main>
  );
}
