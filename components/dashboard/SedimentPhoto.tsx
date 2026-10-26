import { PHOTO_CREDITS } from "@/src/data/photoCredits";
import type { GrainClass } from "@/src/domain/suitability";

/** 입도 등급별로 어울리는 참고 사진 후보 */
const POOLS: Record<GrainClass, string[]> = {
  sand: ["sand-1", "nourish-1", "nourish-2"],
  "silty-sand": ["nourish-1", "dredger-2", "dredger-1"],
  mixed: ["dredger-1", "dredged-1", "dredged-2"],
  silt: ["tidal-1", "tidal-2", "dredged-2"],
};

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** 매물 id로 결정되는 참고 사진 키(같은 매물은 항상 같은 사진) */
export const photoKeyFor = (id: string, grain: GrainClass) => {
  const pool = POOLS[grain];
  return pool[hash(id) % pool.length];
};

/**
 * 준설·퇴적물 유형을 보여 주는 참고 사진. 해당 항만의 실제 현장 사진이 아니므로 그 사실과 출처(작가·라이선스)를 함께 표시한다.
 * 현장 사진이 준비되면 Listing에 imageUrl을 추가하고 이곳에서 분기하면 된다.
 */
export default function SedimentPhoto({ id, grain, label, showCredit = true }: { id: string; grain: GrainClass; label: string; showCredit?: boolean }) {
  const credit = PHOTO_CREDITS[photoKeyFor(id, grain)];
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="dash-photo" src={credit.file} alt={`${label} — 참고 사진(실제 현장 아님): ${credit.title}`} loading="lazy" decoding="async" />
      {showCredit && (
        <a className="dash-photo-tag" href={credit.source} target="_blank" rel="noreferrer" title={`${credit.title} · ${credit.author} · ${credit.license}`}>
          참고 사진 · {credit.author.length > 22 ? `${credit.author.slice(0, 22)}…` : credit.author} · {credit.license}
        </a>
      )}
    </>
  );
}
