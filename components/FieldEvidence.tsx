"use client";

import { useState } from "react";
import { ArrowRight, ExternalLink, Landmark, Newspaper, Ship, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const articles = [
  {
    source: "신아일보",
    date: "2026.10.22",
    title: "양양군, 낙산항·동산항 준설 추진…어선 안전·연안 침식 대응",
    href: "https://www.shinailbo.co.kr/news/articleView.html?idxno=5074561",
  },
  {
    source: "해양레저신문",
    date: "2026.10.21",
    title: "낙산항·동산항 퇴적모래 걷어낸다…준설토는 해수욕장 양빈에 활용",
    href: "https://www.mnlnews.net/news/view.php?bIdx=51077",
  },
];

interface FieldEvidenceProps {
  visible: boolean;
  onClose: () => void;
}

export default function FieldEvidence({ visible, onClose }: FieldEvidenceProps) {
  const [expanded, setExpanded] = useState(false);

  if (!visible) return null;

  return (
    <>
      <aside className="field-evidence-card" aria-label="국내 현장 적용 사례">
        <div className="field-evidence-head">
          <span><Newspaper size={13} /> 국내 현장 적용 사례 · 강원 양양</span>
          <button type="button" onClick={onClose} aria-label="현장 적용 사례 닫기"><X size={15} /></button>
        </div>
        <strong>항만 퇴적모래를 걷어내고<br />침식 해안의 복원 재료로 연결합니다.</strong>
        <div className="field-evidence-metrics" aria-label="사업 핵심 수치">
          <span><b>10,458</b> ㎡ 준설</span>
          <span><b>3.32</b> 억원</span>
          <span><b>2026</b> 연말 준공</span>
        </div>
        <p>사질 준설물 적용 사례 · 토질 적합성 검토가 선행되어야 합니다.</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(true)}>
          사례 근거 보기 <ArrowRight size={14} />
        </Button>
      </aside>

      {expanded && (
        <div className="evidence-drawer-backdrop" role="presentation" onClick={() => setExpanded(false)}>
          <aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-drawer-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>FIELD EVIDENCE</span><h2 id="evidence-drawer-title">준설과 연안 복원이 이미 하나의 사업으로 연결되고 있습니다.</h2></div>
              <button type="button" onClick={() => setExpanded(false)} aria-label="사례 상세 닫기"><X size={19} /></button>
            </header>

            <div className="evidence-flow" aria-label="현장 사업 흐름">
              <div><i><Ship size={18} /></i><span><small>문제</small><strong>항내 모래 퇴적</strong><p>어선 입출항과 정박에 필요한 수심이 부족해집니다.</p></span></div>
              <ArrowRight size={18} />
              <div><i><Landmark size={18} /></i><span><small>조치</small><strong>낙산항·동산항 준설</strong><p>펌프선으로 퇴적모래를 제거해 안전 수심을 확보합니다.</p></span></div>
              <ArrowRight size={18} />
              <div><i><Waves size={18} /></i><span><small>활용</small><strong>인근 침식 해안 양빈</strong><p>적합한 모래를 해변에 보충해 유실을 완화합니다.</p></span></div>
            </div>

            <section className="evidence-facts">
              <div><small>총 사업비</small><strong>3억 3,210만원</strong></div>
              <div><small>준설 면적</small><strong>10,458㎡</strong></div>
              <div><small>낙산항</small><strong>4,476㎡</strong></div>
              <div><small>동산항</small><strong>5,982㎡</strong></div>
            </section>

            <div className="evidence-caveat">
              <strong>siltDA의 판단 기준</strong>
              <p>이 사례는 모래가 퇴적된 어항의 사질 재료 활용 사례입니다. 모든 준설토를 해수욕장에 투입할 수 있는 것은 아니며, 입도·오염도·함수비를 검토한 뒤 매립·습지·양빈 등 적합한 활용처로 분기해야 합니다.</p>
            </div>

            <section className="evidence-sources" aria-label="기사 원문">
              {articles.map((article) => (
                <a key={article.href} href={article.href} target="_blank" rel="noreferrer">
                  <span><small>{article.source} · {article.date}</small><strong>{article.title}</strong></span>
                  <ExternalLink size={16} />
                </a>
              ))}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
