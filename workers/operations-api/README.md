# siltDA Operations API

Cloudflare Worker에서 실행되는 운영 데이터 API입니다.

- D1: 사용자, 기관, 공급·수요, 매칭 상태, 감사 기록
- R2: 시험성적서, 허가서, 계약서와 공간 데이터 원본
- Cloudflare Access: 운영 사용자 이메일 인증

## 준비

```bash
npx wrangler d1 create siltda-operations
npx wrangler r2 bucket create siltda-project-files
```

생성된 D1 ID를 `wrangler.jsonc`의 `database_id`에 입력한 뒤 마이그레이션을 적용합니다.

```bash
npx wrangler d1 migrations apply siltda-operations --config workers/operations-api/wrangler.jsonc --remote
npx wrangler deploy --config workers/operations-api/wrangler.jsonc
```

운영 Worker는 Cloudflare Access 애플리케이션으로 보호해야 합니다. Access에서 인증한 이메일은 D1 `users.email`과 일치해야 합니다. 예제 마이그레이션의 `.invalid` 이메일은 실제 팀 계정으로 변경한 별도 마이그레이션에서 갱신합니다.

배포 직후에는 `API_ENABLED=false`이므로 `/health`를 제외한 모든 API가 잠깁니다. 다음 조건을 모두 충족한 뒤에만 `wrangler.jsonc`의 값을 `true`로 바꾸고 다시 배포합니다.

1. Worker 호스트를 Cloudflare Access 애플리케이션으로 보호
2. Access 정책에서 허용할 팀 이메일을 확정
3. 별도 D1 마이그레이션으로 `users.email`을 실제 이메일에 연결
4. 인증하지 않은 요청과 임의 인증 헤더가 Access 경계에서 차단되는지 확인

이 잠금은 Access가 없는 공개 Worker에서 `cf-access-authenticated-user-email` 헤더를 직접 보내 권한을 가장하는 상황을 막기 위한 안전장치입니다.

프론트 빌드에는 다음 공개 환경 변수 이름만 사용합니다.

```text
NEXT_PUBLIC_SILTDA_OPERATIONS_API_URL=https://<operations-worker-domain>
```

현재 전체 snapshot 저장은 관리자 역할만 허용합니다. 항만·복원 기관의 세부 쓰기 권한은 매물/매칭별 API로 분리해 확장해야 합니다.
