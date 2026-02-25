# Phase 2-B-10: engineering-standards.yaml 구현

## Context

Phase 2-B-9까지 14개 Rule YAML 완성. 기존 rule들이 특정 프레임워크/라이브러리의 **HOW**(사용 패턴)와 **WHICH**(선택)를 다룬다면, 이 rule은 프레임워크에 무관한 **횡단 엔지니어링 표준** — 시스템 간 데이터 교환 포맷, API 계약, 안정성 패턴에 집중.

핵심 설계 기준: AI 모델이 **실제로 자주 틀리는** 데이터 포맷/프로토콜 관행만 포함. 공식 문서에 명확한 기본 사용법은 제외.

---

## Metadata

| 항목     | 값                                                        |
| -------- | --------------------------------------------------------- |
| 파일     | `packages/compiler/data/rules/engineering-standards.yaml` |
| id       | `engineering-standards`                                   |
| category | `standard`                                                |
| tags     | `general`, `api`, `data-format`, `cross-cutting`          |
| priority | **70**                                                    |

---

## 기존 Rule 중복 분석 (제외 근거)

| 후보 항목                | 이미 존재하는 Rule                   | 조치                                 |
| ------------------------ | ------------------------------------ | ------------------------------------ |
| ConfigService로 env 주입 | nestjs.yaml constraint #4            | 제외 (NestJS-specific 주입 메커니즘) |
| pino 구조화 로깅         | libs-backend.yaml constraint #6      | 제외                                 |
| date-fns 사용            | libs-backend.yaml constraint #1      | 제외 (도구 선택)                     |
| Zod 검증                 | typescript.yaml decision_table #1    | 제외                                 |
| updatedAt 필드           | prisma-postgresql.yaml constraint #3 | 제외                                 |
| cursor-based pagination  | prisma-postgresql.yaml guideline #7  | 제외                                 |
| 불변성/순수함수          | code-philosophy.yaml                 | 제외                                 |

→ engineering-standards는 **데이터 포맷/프로토콜/계약 수준**에서만 규칙을 정의. 도구/프레임워크 레이어와 겹치지 않음.

---

## Content 설계

### constraints (6개)

1. **금전 부동소수점 금지** → 정수 minor units + ISO 4217 통화 코드. AI가 `price: number`로 산술 연산을 빈번히 생성 (IEEE 754 정밀도 문제)
2. **순차/auto-increment ID 외부 노출 금지** → UUID 사용. AI가 `/users/1`, `/orders/42` 패턴을 기본 생성 (열거 공격, 정보 누출)
3. **타임존 없는 timestamp 금지** → ISO 8601 UTC 필수. AI가 `YYYY-MM-DD HH:mm:ss` 형식을 timezone 없이 생성
4. **매직 넘버/스트링 금지** → 명명 상수 또는 env config. AI가 `if (retries > 3)`, `setTimeout(fn, 5000)` 인라인 생성
5. **비일관 에러 응답 형태 금지** → 표준 에러 envelope (code + message + requestId). AI가 엔드포인트마다 다른 에러 구조 생성
6. **무제한 입력 허용 금지** → Content-Length, body size, 배열 길이, 문자열 길이 제한 필수. AI가 boundary validation 누락

### guidelines (10개)

1. UTC 저장 원칙: DB·API·로그 모두 ISO 8601 UTC, 프레젠테이션 레이어에서만 로컬 변환
2. REST API envelope: `{ data, error, meta: { requestId, timestamp } }` 일관 구조
3. Correlation ID (X-Request-Id) 전파: API gateway → 서비스 → DB 쿼리 → 로그 → 하류 HTTP
4. 환경 변수 스키마 검증: 앱 시작 시 Zod parse, 누락/유효하지 않은 변수 전체 목록 출력 후 fail fast
5. 도메인 에러 코드: `DOMAIN_ACTION_REASON` (예: `PAYMENT_CHARGE_INSUFFICIENT_FUNDS`). 제네릭 코드 금지
6. 멱등성 키: 비멱등 mutation (POST/PATCH)에 Idempotency-Key 헤더 수용, TTL 내 캐시 응답 반환
7. 헬스체크: `GET /health` (liveness) + `GET /ready` (readiness, 종속 서비스 확인)
8. 금전 표현: `{ amount: number (정수 cents), currency: string (ISO 4217) }`. 표시 시 minor unit factor로 나누기
9. **Nullable vs Empty Collection**: 컬렉션 필드가 비어있을 때 `null` 대신 빈 배열(`[]`) 반환. 클라이언트가 `.map()` 호출 시 null 체크 없이 안전하게 순회 가능. 같은 원칙을 빈 객체(`{}`)에도 적용
10. **Graceful Shutdown**: SIGTERM 수신 시 (1) 새 요청 수락 중단 (2) 진행 중인 요청 완료 대기 (3) DB 커넥션 풀·메시지 큐 정리 후 종료. K8s terminationGracePeriodSeconds와 연계하여 타임아웃 설정

### decision_table (4개)

1. **엔티티 PK** → UUID v7 (RFC 9562, 시간 정렬 가능, B-tree 친화) | avoid: auto-increment (열거), UUID v4 (비정렬, B-tree 분열)
2. **API 에러 포맷** → 구조화 envelope (code + message + details[]) + RFC 9457 참조 | avoid: `{ success: false, msg }` 임의 객체
3. **시스템 간 timestamp** → ISO 8601 UTC (API/로그/DB TIMESTAMPTZ) | avoid: Unix epoch ms (디버깅 불가, timezone 의도 소실). JWT exp/iat 등 compact format에만 epoch 허용
4. **API 버전 관리** → URL path prefix (`/v1/`) — 명시적, 캐시 가능, 라우팅 단순 | avoid: 헤더 기반 (브라우저/curl 불가시, 캐시 복잡)

---

## 수정 대상 파일

| 파일                                                        | 작업                            |
| ----------------------------------------------------------- | ------------------------------- |
| `packages/compiler/data/rules/engineering-standards.yaml`   | **새로 생성**                   |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles에 1개 추가 |

## 참조 파일

| 파일                                                  | 용도                               |
| ----------------------------------------------------- | ---------------------------------- |
| `packages/compiler/src/schemas/rule.schema.ts`        | Zod 스키마 검증 대상               |
| `packages/compiler/data/rules/nestjs.yaml`            | 중복 확인 (ConfigService 규칙)     |
| `packages/compiler/data/rules/libs-backend.yaml`      | 중복 확인 (날짜/로깅 규칙)         |
| `packages/compiler/data/rules/prisma-postgresql.yaml` | 중복 확인 (pagination/soft delete) |

---

## Verification

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

- 15개 rule YAML 스키마 검증 통과
- id 유일성 (15개) 통과
- priority 유일성 (15개) 통과
