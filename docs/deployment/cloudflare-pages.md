# Cloudflare Pages 배포 설정

이 저장소의 `.github/workflows/ci-cd.yml`은 Pull Request에서 전체 검증을 실행하고, 검증을 통과한 `main` 커밋만 Cloudflare Pages에 배포합니다.

## 1. Pages 프로젝트 생성

Cloudflare 대시보드에서 Direct Upload 방식의 Pages 프로젝트 `siltda`를 한 번 생성합니다. Wrangler를 사용한다면 인증 후 다음 명령을 실행할 수 있습니다.

```bash
npx wrangler pages project create siltda --production-branch main
```

> Direct Upload 프로젝트와 Git 연동 프로젝트는 나중에 서로 전환할 수 없습니다. 이 저장소는 GitHub Actions가 검증한 동일한 `out/` 아티팩트를 배포하도록 Direct Upload 방식을 사용합니다.

## 2. GitHub Actions 환경 구성

GitHub 저장소의 **Settings → Environments**에서 `cloudflare-pages-production` 환경을 생성한 뒤 다음 비밀 값을 등록합니다.

### Environment secrets

| 이름 | 값 |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `CLOUDFLARE_API_TOKEN` | `Account / Cloudflare Pages / Edit` 권한의 API 토큰 |

운영 API 주소는 PR과 `main`의 프론트 빌드에서 모두 필요하므로 **Settings → Secrets and variables → Actions → Variables**에 저장소 변수로 등록합니다.

### Repository variable

| 이름 | 값 |
| --- | --- |
| `NEXT_PUBLIC_SILTDA_ML_API_URL` | 운영 FastAPI의 HTTPS 주소. 예: `https://siltda-ml-api.onrender.com` |

환경에는 필요하면 승인자와 배포 브랜치 `main` 보호 규칙도 설정합니다. 토큰은 저장소 파일이나 일반 변수에 넣지 않습니다.

## 3. GitHub 브랜치 보호

`main` 브랜치에 다음 상태 검사를 필수로 지정합니다.

- `Frontend / typecheck and static build`
- `Backend / tests and model compatibility`
- `Backend / production container build`

PR #1처럼 외부 fork에서 만들어진 Pull Request에도 비밀 값 없이 세 CI 검사가 실행됩니다. Cloudflare 자격 증명은 `main` 배포 작업에서만 읽습니다.

## 4. 배포 흐름

1. Pull Request 생성 또는 갱신
2. 프론트 정적 빌드, Python 테스트와 실제 모델 로드, Docker 이미지 빌드
3. 리뷰 후 `main` 병합
4. 같은 세 검사를 `main`에서 다시 실행
5. 성공한 프론트 `out/` 아티팩트만 Pages에 배포

배포 작업은 `NEXT_PUBLIC_SILTDA_ML_API_URL`이 비어 있거나 HTTPS가 아니면 중단됩니다. 배포 결과 URL은 GitHub Deployment와 작업 요약에 기록됩니다.

## 5. ML API 배포

현재 모델은 scikit-learn·LightGBM·joblib 고정 버전에 의존하므로 `render.yaml`과 `backend/Dockerfile`을 통한 컨테이너 배포를 유지합니다. Cloudflare Containers 이전은 별도 PoC에서 모델 크기, 시작 시간, 비용을 검증한 뒤 진행합니다.
