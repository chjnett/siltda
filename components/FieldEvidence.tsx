"use client";

import { ExternalLink, Newspaper, X } from "lucide-react";

const articles = [
  {
    source: "신아일보",
    date: "2026.10.22",
    title: "양양군, 낙산항·동산항 준설 추진…어선 안전·연안 침식 대응",
    href: "https://www.shinailbo.co.kr/news/articleView.html?idxno=5074561",
    image: "https://cdn.shinailbo.co.kr/news/photo/202610/5074561_2072082_3156.jpg",
  },
  {
    source: "해양레저신문",
    date: "2026.10.21",
    title: "낙산항·동산항 퇴적모래 걷어낸다…준설토는 해수욕장 양빈에 활용",
    href: "https://www.mnlnews.net/news/view.php?bIdx=51077",
    image: "https://www.mnlnews.net/thumb_image/mnlnews/3_/600_315_20261021_MC40MjI2NzcwMCAxNzkyNTQ1MTM1.jpeg",
  },
];

interface FieldEvidenceProps {
  visible: boolean;
  onClose: () => void;
}

export default function FieldEvidence({ visible, onClose }: FieldEvidenceProps) {
  if (!visible) return null;

  return (
    <aside className="field-evidence-card field-news-list" aria-label="관련 뉴스 원문">
      <div className="field-evidence-head">
        <span><Newspaper size={13} /> 관련 보도 · 강원 양양</span>
        <button type="button" onClick={onClose} aria-label="관련 뉴스 닫기"><X size={15} /></button>
      </div>

      <div className="field-news-items">
        {articles.map((article) => (
          <a key={article.href} href={article.href} target="_blank" rel="noreferrer">
            <span className="field-news-copy">
              <small>{article.source}</small>
              <strong>{article.title}</strong>
              <time dateTime={article.date.replaceAll(".", "-")}>{article.date}</time>
            </span>
            <span className="field-news-thumb">
              <img src={article.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              <ExternalLink size={12} />
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
}
