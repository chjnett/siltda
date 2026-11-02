"use client";

import { useState } from "react";
import { ArrowRight, ExternalLink, Newspaper, X } from "lucide-react";
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
  const [activeArticleIndex, setActiveArticleIndex] = useState(0);

  const activeArticle = articles[activeArticleIndex];

  if (!visible) return null;

  return (
    <>
      <aside className="field-evidence-card" aria-label="관련 뉴스 원문">
        <div className="field-evidence-head">
          <span><Newspaper size={13} /> 관련 보도 · 강원 양양</span>
          <button type="button" onClick={onClose} aria-label="관련 뉴스 닫기"><X size={15} /></button>
        </div>
        <strong>{articles[0].title}</strong>
        <p>{articles.length}개 언론사의 원문 페이지를 그대로 확인할 수 있습니다.</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(true)}>
          원문 뉴스 미리보기 <ArrowRight size={14} />
        </Button>
      </aside>

      {expanded && (
        <div className="evidence-drawer-backdrop" role="presentation" onClick={() => setExpanded(false)}>
          <aside className="evidence-news-preview" role="dialog" aria-modal="true" aria-labelledby="evidence-preview-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>ORIGINAL NEWS</span>
                <h2 id="evidence-preview-title">원문 뉴스 미리보기</h2>
                <p>아래 화면은 언론사 페이지를 수정 없이 그대로 불러옵니다.</p>
              </div>
              <div className="evidence-preview-actions">
                <a href={activeArticle.href} target="_blank" rel="noreferrer">
                  원문 새 탭 <ExternalLink size={14} />
                </a>
                <button type="button" onClick={() => setExpanded(false)} aria-label="뉴스 미리보기 닫기"><X size={19} /></button>
              </div>
            </header>

            <nav className="evidence-source-tabs" aria-label="뉴스 원문 선택">
              {articles.map((article, index) => (
                <button
                  key={article.href}
                  type="button"
                  className={index === activeArticleIndex ? "active" : ""}
                  onClick={() => setActiveArticleIndex(index)}
                  aria-pressed={index === activeArticleIndex}
                >
                  <small>{article.source} · {article.date}</small>
                  <strong>{article.title}</strong>
                </button>
              ))}
            </nav>

            <div className="evidence-iframe-shell">
              <div className="evidence-browser-bar" aria-hidden="true">
                <span /><span /><span />
                <p>{activeArticle.href}</p>
              </div>
              <iframe
                key={activeArticle.href}
                src={activeArticle.href}
                title={`${activeArticle.source} 원문 뉴스`}
                loading="eager"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
