"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt1, fmt2, fmtInt, fmtM3, fmtPct, monthRange, stageLabels } from "@/src/domain/format";
import { SIGNAL_LABELS, type SignalId } from "@/src/domain/overview";
import { suitableUses } from "@/src/domain/suitability";
import { useStore } from "@/src/state/DealStore";
import type { Stage } from "@/src/types";
import { Donut, TimelineChart } from "./charts";
import HomeMap, { LAYER_LABELS, type LayerId } from "./HomeMap";
import PortSatellite from "./PortSatellite";
import { Formula, Pill, UseBadge, VerificationBadge, useCountUp } from "./ui";
import WeekWeather from "./WeekWeather";

const signalRules: Record<SignalId, string> = {
  direct: "활용 가능한 공급이 수요를 채울 수 있고, 최적 후보의 준설·복원 시기가 겹치면 '직송 가능'입니다.",
  stockpile: "물량은 맞지만 준설 시기가 복원 시기보다 앞서 임시적치가 필요하면 '임시적치 권장'입니다.",
  substitute: "잔여 부족량이 활용 가능한 미매칭 공급보다 크면 '대체 자재 조달 필요'입니다.",
};
const signalTone: Record<SignalId, "teal" | "amber" | "red"> = { direct: "teal", stockpile: "amber", substitute: "red" };

export default function HomePage() {
  const router = useRouter();
  const { state, overview, openPassport, selectSite, setStageFilter } = useStore();
  const { data, base } = state;

  const [layers, setLayers] = useState<Record<LayerId, boolean>>({ dredge: true, erosion: true, stockpile: true, routes: true, infra: true });
  const [showWeather, setShowWeather] = useState(true);
  const [hourIndex, setHourIndex] = useState(12);
  useEffect(() => {
    const update = () => setHourIndex(new Date().getHours());
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);
  const [weatherPortId, setWeatherPortId] = useState(data.ports[0]?.id ?? "");
  const [signalOpen, setSignalOpen] = useState<SignalId | null>(null);

  const port = data.ports.find((p) => p.id === weatherPortId) ?? data.ports[0];

  const openSite = useCallback((id: string) => { selectSite(id); router.push("/dashboard/candidates"); }, [selectSite, router]);
  const openPass = useCallback((id: string) => openPassport(id), [openPassport]);
  const toggle = (id: LayerId) => setLayers((l) => ({ ...l, [id]: !l[id] }));
  const goStage = (stage: Stage) => { setStageFilter(stage); router.push("/dashboard/list"); };

  const k = overview.kpis;
  const waiting = useCountUp(k.waitingSupply);
  const fulfil = useCountUp(k.fulfillmentPct ?? 0);
  const net = useCountUp(k.netBenefitEok * 100) / 100;
  const avoided = useCountUp(k.avoidedDisposal);

  return (
    <div className="dash-home">
      <section className="dash-card" aria-label="수급 지도">
        <header className="dash-card-head">
          <div><h2>준설토 수급 지도</h2><p>공급(항만)과 수요(침식지)를 한 지도에서 확인</p></div>
          <div className="dash-layer-toggles" role="group" aria-label="지도 레이어">
            {(Object.keys(LAYER_LABELS) as LayerId[]).map((id) => (
              <label key={id} className="dash-chip" data-active={layers[id] || undefined}>
                <input type="checkbox" checked={layers[id]} onChange={() => toggle(id)} /> {LAYER_LABELS[id]}
              </label>
            ))}
            <label className="dash-chip" data-active={showWeather || undefined}>
              <input type="checkbox" checked={showWeather} onChange={() => setShowWeather((v) => !v)} /> 풍속·파고(현재 시각)
            </label>
          </div>
        </header>
        <HomeMap data={data} base={base} layers={layers} showWeather={showWeather} hourIndex={hourIndex} highlightDealId={state.lastDealId} onOpenPassport={openPass} onOpenSite={openSite} />
      </section>

      <div className="dash-home-grid">
        <section className="dash-card" aria-label="수급 균형" data-demo="balance">
          <header className="dash-card-head"><div><h2>수급 균형</h2><p>열린 복원 수요 기준</p></div></header>
          <div className="dash-balance">
            <div><span>복원 수요 합계</span><b>{fmtInt(overview.demandTotal)}</b></div>
            <i aria-hidden="true">−</i>
            <div><span>매칭된 공급</span><b>{fmtInt(overview.matchedVolume)}</b></div>
            <i aria-hidden="true">=</i>
            <div data-tone="short"><span>잔여 부족량 <Formula title="잔여 부족량" lines={[
              `= 복원 수요 합계 ${fmtInt(overview.demandTotal)} − 매칭된 공급 ${fmtInt(overview.matchedVolume)}`,
              `= ${fmtInt(overview.shortage)} m³ (음수면 0으로 표시, 부족은 − 방향)`,
            ]} /></span><b>−{fmtInt(overview.shortage)}</b></div>
          </div>
          <div className="dash-balance-extra">
            <span>미매칭 공급(처분 위기 물량) <Formula title="미매칭 공급" lines={[
              "= Σ (등록 매물 물량 − 이미 매칭된 물량), 포설 완료 매물 제외",
              `= ${fmtInt(overview.unmatchedSupply)} m³ (과잉은 + 방향)`,
            ]} /></span>
            <b data-tone="over">+{fmtInt(overview.unmatchedSupply)} m³</b>
          </div>
          <div className="dash-signals" role="group" aria-label="조정 신호">
            {(Object.keys(SIGNAL_LABELS) as SignalId[]).map((id) => (
              <button key={id} type="button" className="dash-signal" data-active={overview.signal.id === id || undefined} data-tone={signalTone[id]} aria-expanded={signalOpen === id} onClick={() => setSignalOpen(signalOpen === id ? null : id)}>
                {SIGNAL_LABELS[id]}
              </button>
            ))}
          </div>
          {signalOpen && (
            <div className="dash-signal-basis" role="region" aria-label="신호 판단 근거">
              <p><b>{SIGNAL_LABELS[signalOpen]}</b> — {overview.signal.id === signalOpen ? "현재 해당" : "현재 해당하지 않음"}</p>
              <p className="dash-muted">{signalRules[signalOpen]}</p>
              {overview.signal.id === signalOpen && <ul>{overview.signal.basis.map((b) => <li key={b}>{b}</li>)}</ul>}
            </div>
          )}
        </section>

        <section className="dash-card" aria-label="진행 파이프라인" data-demo="pipeline">
          <header className="dash-card-head"><div><h2>진행 파이프라인</h2><p>단계를 누르면 해당 단계의 수급 목록으로 이동합니다</p></div></header>
          <ol className="dash-pipeline">
            {overview.pipeline.map((p, i) => (
              <li key={p.stage}>
                <button type="button" onClick={() => goStage(p.stage)} aria-label={`${stageLabels[p.stage]} ${p.count}건 목록 보기`}>
                  <span className="dash-pipe-step">{i + 1}</span>
                  <b>{stageLabels[p.stage]}</b>
                  <span>{p.count}건</span>
                  <small>{fmtInt(p.volumeM3)} m³</small>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="dash-card" aria-label="12개월 공급·수요 타임라인" data-demo="timeline">
        <header className="dash-card-head"><div><h2>12개월 공급·수요 타임라인</h2><p>막대에 마우스를 올리면 공급자·수요자 목록이 나옵니다 <Formula title="타임라인 계산" lines={[
          "월별 공급 = 해당 월에 준설 중인 매물 물량을 준설 기간으로 균등 배분한 합",
          "월별 수요 = 해당 월이 복원 필요 기간에 속한 열린 후보지 필요 토량을 기간으로 균등 배분한 합",
          "붉은 강조 = 공급과 수요 중 큰 쪽이 작은 쪽의 배수(시연용 가정값)를 넘거나 한쪽이 0인 달",
        ]} /></p></div></header>
        <TimelineChart months={overview.timeline} base={base} />
      </section>

      <section className="dash-card" aria-label="주간 해상기상" data-demo="weather">
        <header className="dash-card-head">
          <div><h2>주간 해상기상</h2><p>선택한 항만의 7일 예보</p></div>
          <label className="dash-filter"><span>항만</span>
            <select value={weatherPortId} onChange={(e) => setWeatherPortId(e.target.value)}>
              {data.ports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </header>
        {port && <WeekWeather id={port.id} name={port.name} coordinate={port.coordinate} />}
      </section>

      <section className="dash-kpis" aria-label="핵심 지표" data-demo="kpis">
        <article className="dash-kpi">
          <h3>활용 대기 준설토 물량 <Formula title="활용 대기 준설토 물량" lines={[
            "= 미매칭 공급 중 양빈·갯벌 용도로 부적합이 아닌 매물의 남은 물량 합",
            `= ${fmtInt(k.waitingSupply)} m³ (미매칭 전체 ${fmtInt(overview.unmatchedSupply)} m³)`,
          ]} /></h3>
          <p className="dash-big">{fmtInt(waiting)}<small> m³</small></p>
        </article>
        <article className="dash-kpi dash-kpi--donut">
          <div>
            <h3>복원 수요 충족률 <Formula title="복원 수요 충족률" lines={[
              `= 매칭된 공급 ${fmtInt(overview.matchedVolume)} ÷ 복원 수요 합계 ${fmtInt(overview.demandTotal)}`,
              `= ${k.fulfillmentPct === null ? "수요 없음" : fmtPct(k.fulfillmentPct)}`,
            ]} /></h3>
            <p className="dash-big">{k.fulfillmentPct === null ? "—" : `${fmt1(fulfil)}%`}</p>
          </div>
          <Donut pct={k.fulfillmentPct} label="복원 수요 충족률" size={84} />
        </article>
        <article className="dash-kpi">
          <h3>예상 순편익 <Formula title="예상 순편익" lines={[
            "= 회피 처분비 + 자재 조달 절감 − 추가 비용(운송·품질검사·임시적치)",
            `확정 거래 ${k.dealCount}건의 순편익 합 = ${fmt2(k.netBenefitEok)}억원`,
            "단가는 모두 시연용 가정값",
          ]} /></h3>
          <p className="dash-big">{fmt2(net)}<small> 억원</small></p>
        </article>
        <article className="dash-kpi">
          <h3>처분 회피 물량 <Formula title="처분 회피 물량" lines={[
            "= 매칭이 확정된 거래의 물량 합(처분 대신 복원에 쓰이는 물량)",
            `= ${fmtInt(k.avoidedDisposal)} m³ (${k.dealCount}건)`,
          ]} /></h3>
          <p className="dash-big">{fmtInt(avoided)}<small> m³</small></p>
        </article>
      </section>

      <RecentListings onAll={() => router.push("/dashboard/supplies")} />
    </div>
  );
}

function RecentListings({ onAll }: { onAll: () => void }) {
  const { state, openPassport } = useStore();
  const { data, base } = state;
  const recent = [...data.listings].sort((a, b) => a.registeredDaysAgo - b.registeredDaysAgo).slice(0, 4);
  return (
    <section className="dash-card" aria-label="최근 등록 매물" data-demo="recent">
      <header className="dash-card-head">
        <div><h2>최근 등록 매물</h2><p>가장 최근에 등록된 준설토 4건</p></div>
        <div className="dash-head-actions">
          <button type="button" className="dash-btn" onClick={onAll}>전체 보기</button>
        </div>
      </header>
      <ul className="dash-recent">
        {recent.map((l) => {
          const p = data.ports.find((x) => x.id === l.portId);
          return (
            <li key={l.id} className="dash-recent-card">
              {p && <PortSatellite name={p.name} coordinate={p.coordinate} />}
              <div>
                <b>{p?.name} · {l.project}</b>
                <p>{fmtM3(l.volumeM3)} · {monthRange(base, l.dredgeStart, l.dredgeEnd)}</p>
                <p className="dash-pill-row"><VerificationBadge v={l.verification} />{suitableUses(l.quality).slice(0, 2).map((u) => <UseBadge key={u} use={u} />)}</p>
                <p className="dash-muted-line">{l.registeredDaysAgo === 0 ? "오늘" : `${l.registeredDaysAgo}일 전`} 등록 <Pill tone="gray">{stageLabels[l.stage]}</Pill></p>
                <button type="button" className="dash-btn dash-btn-sm" onClick={() => openPassport(l.id)}>퇴적물 여권</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
