# `apps/cli/data/rules/*` Agent Skills 외부화 통합 계획

## Summary

- 원칙(토큰 절감, 컨텍스트 과부하 방지, 실행 안전성) 기준으로 보면, 즉시 외부화 우선 후보는 4개 묶음이다.
- 현재 구조는 `global`/`domain` 1차 분리는 되어 있으나, `standard` 계열이 글로벌로 상시 로드되어 토큰 부담이 남아 있다.
- 전략은 `코어(항상 로드)`를 최소화하고, 대형/특수/고위험 규칙을 `Agent Skills`로 조건부 로드하는 방식이다.

## 외부화 우선 후보 + 분리 스펙

1. `engineering-standards`

- 이유: 용량 최상위 + 범위가 넓어 집중도 저하 가능성이 큼.
- Skill 구성:
  - `skill-engineering-standards-core`
  - `skill-engineering-standards-safety`
- Skill로 이동할 내용:
  - money minor-unit/ISO4217, UUID v7, UTC/ISO8601/TIMESTAMPTZ
  - error/response envelope, input size limits
  - Idempotency-Key, X-Request-Id propagation
  - `/health`/`/ready`, SIGTERM graceful shutdown
  - decision table 전부
- 코어에 남길 최소 규칙:
  - 에러 shape 일관성
  - UTC timestamp 통일
- 트리거:
  - API contract 설계, 결제/금액, 신뢰성/운영성 작업

2. GraphQL 묶음 (`graphql-core`, `graphql-server`, `graphql-client-web`, `graphql-client-app`, `nestjs-graphql`)

- 이유: GraphQL 작업이 아닐 때는 대부분 불필요한 대형 컨텍스트.
- Skill 구성:
  - `skill-graphql-contract`
  - `skill-graphql-server-runtime`
  - `skill-graphql-client-integration`
- Skill로 이동할 내용:
  - nullability/pagination/deprecation 호환 정책
  - Query/Mutation 책임 분리
  - typed userErrors/partial success 처리
  - DataLoader/N+1 방지
  - depth/complexity 제한, subscription auth
  - codegen 기반 typed docs/models, fetchPolicy/caching 정책
- 코어에 남길 최소 규칙:
  - contract 변경은 deprecate-first
  - N+1 금지
- 트리거:
  - `.graphql/.gql`, resolver, Apollo/client, codegen 관련 변경

3. DB/마이그레이션 안전 묶음 (`prisma-postgresql`, `sqlalchemy`)

- 이유: 마이그레이션/트랜잭션/Raw SQL은 실행 안전성 영향이 큼.
- Skill 구성:
  - `skill-db-prisma-postgresql`
  - `skill-db-sqlalchemy-postgresql`
  - `skill-db-migration-safety-gate`
- Skill로 이동할 내용:
  - Prisma raw query safety, migrate deploy, extension 정책
  - SQLAlchemy 2.x 패턴, commit boundary, Alembic 필수
  - timeout/maxWait/index/cursor pagination/soft delete 정책
- 코어에 남길 최소 규칙:
  - migration 없는 schema change 금지
  - parameterized SQL only
- 트리거:
  - `prisma/**`, `alembic/**`, schema/index/transaction 변경

4. 특수 Python 도메인 묶음 (`ai-llm-python`, `data-pipeline-python`)

- 이유: 일반 백엔드 대비 사용 빈도 낮고 문서 밀도 높음.
- Skill 구성:
  - `skill-ai-llm-python-runtime`
  - `skill-data-pipeline-python-performance`
- Skill로 이동할 내용:
  - LLM structured output, prompt versioning, token budget, fallback/retry, PII logging 금지
  - async/sync SDK 경계
  - Polars lazy, DuckDB out-of-core, partitioned parquet, explicit schema
  - data quality validation 운영 규칙
- 코어에 남길 최소 규칙:
  - LLM parsing schema-first
  - large data는 out-of-core 우선
- 트리거:
  - `agents/`, `chains/`, prompt/model 코드, `pipelines/`, `etl/`

## 유지 권장 (외부화 불필요)

- `role-persona`, `communication`, `code-philosophy`, `naming-convention`
- 기본 언어/프레임워크 코어: `typescript`, `python`, `react-typescript`, `nextjs`, `nestjs`, `fastapi` 등
- 근거: 짧거나 상시 품질 가드에 직접 기여하며 컨텍스트 비용 대비 효용이 높음.

## 적용 규칙 (Decision Complete)

1. `global`에는 “짧은 범용 규칙”만 유지한다.
2. 대형 + 도메인 특화 + 비상시만 필요한 절차 규칙은 Skill로 이동한다.
3. 배포/마이그레이션/파괴 가능 작업은 Safety Skill을 명시적으로 로드한 경우에만 상세 절차를 적용한다.
4. Skill 미로드 상태에서는 코어 최소 안전 규칙만 적용하고, 해당 도메인 작업 감지 시 Skill 로드를 우선 제안한다.

## Test Plan

1. 일반 CRUD/프론트 작업에서 상시 로드 규칙 토큰량 전후 비교(감소 확인).
2. GraphQL/DB/LLM/ETL 작업에서 각 Skill 로드시 기존 규칙 품질 동등성 검증.
3. 마이그레이션/위험 작업에서 Safety Skill 게이트 동작 검증.
4. 코어+Skill 조합으로 회귀(누락된 안전 규칙, 응답 품질 저하) 없는지 시나리오 테스트.

## Assumptions

- Agent Skills는 조건부 로드 가능한 외부 규칙 단위다.
- 이번 요청 범위는 “외부화 대상/구성 제안”이며 실제 룰 파일 변경은 포함하지 않는다.
- “반드시 분리” 기준을 엄격 적용했을 때, 우선 후보 4개 외는 즉시 분리 필요성이 낮다.
