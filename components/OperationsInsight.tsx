import { CalendarRange, CheckCircle2, Container, Route, Scale, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getMatchInsight, timelineMonths, timelineStyle } from "@/lib/operations";
import type { CandidateSite } from "@/lib/types";

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });

interface Props {
  deposit: CandidateSite;
  erosion: CandidateSite;
  distanceKm: number;
}

export default function OperationsInsight({ deposit, erosion, distanceKm }: Props) {
  const match = getMatchInsight(deposit, erosion, distanceKm);
  const verification = deposit.operation.verification === "verified" ? "검증 완료" : "검증 중";

  return (
    <Card className="operations-insight" aria-label="3D 매칭 운영 정보">
      <div className="operations-insight-head">
        <div>
          <span className="card-eyebrow">SPATIAL MATCH</span>
          <h3>3D 매칭 운영 정보</h3>
        </div>
        <Badge variant="secondary" className="match-score-badge">{match.totalScore}점</Badge>
      </div>

      <div className="operations-route-line">
        <span><Container size={13} /> {deposit.name.replace(" 후보 A", "").replace(" 후보 B", "")}</span>
        <i><Route size={13} /> {distanceKm.toFixed(1)} km</i>
        <span>{erosion.name.replace(" 복원지", "")} <Scale size={13} /></span>
      </div>

      <div className="operations-score-grid">
        <div><small>연계 방식</small><strong>{match.strategy}</strong></div>
        <div><small>공급 가능</small><strong>{compact.format(match.matchedVolume)} m³</strong></div>
        <div><small>수요 충족</small><strong>{match.coveragePct.toFixed(0)}%</strong></div>
        <div><small>예상 순편익</small><strong>{match.netBenefitEok.toFixed(1)} 억</strong></div>
      </div>

      <div className="operations-timeline" aria-label="준설과 복원 일정 비교">
        <div className="operations-timeline-title"><CalendarRange size={13} /><span>12개월 일정 정합성</span></div>
        <div className="timeline-months">{timelineMonths.map((month) => <span key={month}>{month}</span>)}</div>
        <div className="timeline-track"><span className="timeline-label">준설</span><i className="timeline-bar supply" style={timelineStyle(deposit)} /></div>
        <div className="timeline-track"><span className="timeline-label">복원</span><i className="timeline-bar demand" style={timelineStyle(erosion)} /></div>
      </div>

      <div className="passport-strip">
        <span><ShieldCheck size={13} /> {verification}</span>
        <span>실트·점토 {deposit.operation.finesPct ?? "—"}%</span>
        <span>중앙입경 {deposit.operation.medianMm ?? "—"} mm</span>
        <span><CheckCircle2 size={13} /> {deposit.operation.use}</span>
      </div>
      <p className="operations-assumption">금액·품질·일정 기준은 해커톤 시연용 가정값입니다.</p>
    </Card>
  );
}
