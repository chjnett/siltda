# siltDA 3D Coastal Studio

준설 구역과 침식지 복원 구역을 3D에서 설계하고, 굴착·성토량을 연계하는 CesiumJS 기반 프론트엔드 프로토타입입니다.

## 실행

```bash
npm install
npm run dev
```

프로덕션 검증:

```bash
npm run typecheck
npm run build
```

Cesium의 Worker, Assets, Widgets, ThirdParty 런타임 파일은 `postinstall`과 `build` 시 `public/cesium`으로 복사됩니다.

## 구현된 기능

- 첫 진입 시 지구 → 대한민국 → 부산으로 이어지는 3D 카메라 시퀀스
- 인트로 건너뛰기와 작업 화면의 `지구본 보기` 재생 기능
- 해양 연구·공공 GIS 성격의 단계별 디자인 시스템
- CesiumJS 3D 지구본과 Esri 위성영상
- 항만 준설 후보와 침식 복원 후보 폴리곤
- 후보 선택 및 부드러운 카메라 이동
- 상공·사선·근접 카메라 프리셋
- 준설·복원 구역 다각형 입력
- 꼭짓점 드래그 수정, 실행 취소, 삭제 후 재작성
- 굴착 깊이와 성토 두께 실시간 변경
- 사용자 정의 삼각형 메시의 높이 실시간 재생성
- 작업 전, 작업 후, 전후 비교, 단면도 모드
- 준설량·복원량·잔여량 또는 부족량 계산
- 브라우저 로컬 프로젝트 저장
- 모든 단계에서 유지되는 해양 영상 배경

## 데이터와 높이 기준

- 위치 좌표는 GeoJSON과 호환되는 WGS84 경위도 순서 `[longitude, latitude]`를 사용합니다.
- Cesium 렌더링 높이는 WGS84 타원체고를 사용합니다.
- 현재 수심 표면은 실제 측량 자료가 없는 경우를 위한 가상 DEM입니다. UI에 `가상 데이터`로 명시됩니다.
- 위성영상은 표면 영상이며 수심 데이터가 아닙니다.
- 준설·복원 변형은 Cesium 지형 타일을 수정하지 않습니다. 독립적인 `Cesium.Geometry` 삼각형 메시를 생성하고, 슬라이더 값에 따라 정점 높이를 다시 계산합니다.
- 실제 프로젝트에서는 GeoTIFF/DEM을 서버 또는 Web Worker에서 격자로 변환한 뒤 셀별 전후 높이 차를 적분하도록 `lib/geo.ts` 계산 계층을 교체할 수 있습니다.

## 지도 공급자와 대체 경로

기본 실행에는 API 키가 필요하지 않습니다.

1. 로컬 Cesium Natural Earth 자산을 항상 먼저 올립니다.
2. 접속 가능하면 키 없는 Esri World Imagery를 위성영상 레이어로 추가합니다.
3. Esri 레이어가 실패해도 로컬 지구본이 유지됩니다.
4. `NEXT_PUBLIC_CESIUM_ION_TOKEN`이 있으면 Cesium World Terrain을 사용합니다.
5. `NEXT_PUBLIC_GOOGLE_MAPS_KEY`가 있으면 Google Photorealistic 3D Tiles를 추가합니다.

Cesium ion, Google Maps Platform, Esri의 서비스 약관, 표시 의무, 할당량과 과금 조건은 배포 주체가 별도로 검토해야 합니다. 공개 클라이언트 환경 변수는 비밀 저장소가 아니므로 공급자 콘솔에서 도메인 제한을 설정해야 합니다.

## 참고 프로젝트에서 적용한 패턴

[God's Eye View](https://github.com/bilawalsidhu/gods-eye-view)의 다음 설계 패턴을 분석해 적용했습니다.

- 지도 공급자를 기능과 분리하고 실패 시 대체 경로 유지
- `flyTo`와 cubic easing을 이용한 대상 포커스
- 상공과 사선 시점 전환
- 레이어별 독립적인 표시 상태
- 키 없는 기본 경험과 선택적 고해상도 공급자

항공기 추적, 군사용 HUD, 감시 기능은 사용하지 않았습니다.

## 주요 파일

- `components/CesiumScene.tsx`: Cesium 초기화, 지도 공급자, 후보 레이어, 입력 이벤트, 카메라, 메시 반영
- `components/CoastalStudio.tsx`: 3단계 워크플로, 설계 패널, 계산 결과, 프로젝트 저장
- `lib/geo.ts`: 면적·거리·삼각분할·사용자 정의 3D 변형 메시
- `lib/demoData.ts`: 부산 연안 데모 후보와 초기 프로젝트
- `app/globals.css`: 공공 GIS 콘솔 레이아웃과 반응형 스타일

## 실제 데이터로 전환할 때

1. 후보지를 GeoJSON API로 교체합니다.
2. 수심 GeoTIFF를 동일 수평좌표계와 명시된 수직기준면으로 정규화합니다.
3. 폴리곤 내부 셀을 클리핑해 실제 굴착·성토 메시를 생성합니다.
4. 경사면, 다짐계수, 작업 허용 오차를 프로젝트 규칙으로 전달합니다.
5. 시뮬레이션 결과와 원본 측량 데이터를 별도 버전으로 보관합니다.
