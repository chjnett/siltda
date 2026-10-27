/**
 * 항만/해안 대표 썸네일 대체 이미지. 실제 사진 자산이 없으므로 항만 이름 기반의 깔끔한 일러스트를 사용한다.
 * 실제 사진이 준비되면 Port/RestorationDemand에 imageUrl을 추가하고 이 컴포넌트에서 분기하면 된다.
 */
export default function PortThumb({ name, variant }: { name: string; variant: "port" | "coast" }) {
  const sea = variant === "port" ? ["#18181B", "#0E3A46"] : ["#18181B", "#1F3B3A"];
  return (
    <svg className="dash-thumb" viewBox="0 0 160 90" role="img" aria-label={`${name} 대표 이미지(일러스트)`} preserveAspectRatio="xMidYMid slice">
      <rect width="160" height="90" fill={sea[0]} />
      <rect y="52" width="160" height="38" fill={sea[1]} />
      <path d="M0 62 Q20 57 40 62 T80 62 T120 62 T160 62 V90 H0Z" fill="#FFFFFF" opacity=".08" />
      {variant === "port" ? (
        <g fill="#22D3EE">
          <rect x="22" y="48" width="116" height="7" fill="#52525B" />
          <rect x="40" y="22" width="4" height="26" />
          <rect x="40" y="22" width="34" height="4" />
          <rect x="70" y="22" width="2" height="14" fill="#52525B" />
          <rect x="96" y="30" width="4" height="18" />
          <rect x="96" y="30" width="24" height="3" />
          <rect x="108" y="38" width="10" height="10" fill="#F59E0B" />
          <rect x="120" y="42" width="10" height="6" fill="#52525B" />
        </g>
      ) : (
        <g>
          <path d="M0 58 Q40 46 80 54 T160 50 V62 Q120 58 80 64 T0 66Z" fill="#A8956A" />
          <path d="M0 66 Q40 60 80 66 T160 62 V90 H0Z" fill="#2B6B78" opacity=".6" />
        </g>
      )}
    </svg>
  );
}
