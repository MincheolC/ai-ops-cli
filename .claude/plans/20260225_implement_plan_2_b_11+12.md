# Phase 2-B-11,12: GraphQL Rule YAML 구현

## Context

Phase 2-B-10까지 TS/Dart 규칙, 2-B-13~18 Python 규칙이 완료된 상태. 마스터 플랜에 정의된 2-B-11(`graphql.yaml`)과 2-B-12(`nestjs-graphql.yaml`)만 미구현. 기존 rule들이 GraphQL **WHICH**(라이브러리 선택)를 다루고 있으므로, 이번 추가는 **HOW**(스키마 설계 원칙, NestJS 코드 패턴)에 집중.

### 중복 방지 경계

| 기존 rule               | 이미 커버하는 GraphQL 내용                                              | 건드리지 않는 영역     |
| ----------------------- | ----------------------------------------------------------------------- | ---------------------- |
| `libs-backend-ts`       | `@nestjs/graphql`, `@apollo/server`, `@graphql-codegen` 라이브러리 선택 | 스키마 설계 원칙       |
| `libs-frontend-web`     | `@apollo/client`, `@graphql-codegen` 클라이언트 라이브러리 선택         | 쿼리/뮤테이션 설계     |
| `nestjs`                | guideline#5: "GraphQL은 SDL이 contract" 한 줄 언급                      | resolver 패턴, DI 통합 |
| `engineering-standards` | API envelope, error format, UUID, pagination 일반론                     | GraphQL-specific 에러  |

---

## 최종 파일 목록 (3 operations)

| #   | 파일                  | 작업     | id               | category    | priority |
| --- | --------------------- | -------- | ---------------- | ----------- | -------- |
| 1   | `graphql.yaml`        | **신규** | `graphql`        | `api`       | **48**   |
| 2   | `nestjs-graphql.yaml` | **신규** | `nestjs-graphql` | `framework` | **43**   |
| 3   | `rule-data.test.ts`   | **수정** | —                | —           | —        |

### Priority Map (변경 후, 22개)

```
90 role-persona
85 communication
80 code-philosophy
75 naming-convention
70 engineering-standards
65 typescript
60 react-typescript
55 python
50 nextjs
48 graphql              ← NEW
45 nestjs
43 nestjs-graphql       ← NEW
42 fastapi
40 prisma-postgresql
38 sqlalchemy
35 shadcn-ui
33 data-pipeline-python
30 flutter
28 ai-llm-python
25 libs-backend-ts
22 libs-backend-python
20 libs-frontend-web
15 libs-frontend-app
```

---

## 1. `graphql.yaml` — Schema Design Principles (priority 48)

Framework-agnostic GraphQL 설계 원칙. REST의 `engineering-standards.yaml`와 대칭.

**constraints (5):**

1. nullable field 기본값 의존 금지 → 모든 필드 명시적 nullability 선언. non-null(`!`)이 기본, nullable은 의도적으로만
2. Query에서 데이터 변경(side effect) 금지 → 읽기=Query, 쓰기=Mutation 엄격 분리
3. generic `Error` 타입 반환 금지 → 도메인별 union error 타입 (`type CreateUserPayload = User | EmailTakenError | ValidationError`)
4. unbounded list 반환 금지 → 컬렉션은 반드시 pagination 적용 (cursor-based `first/after` 또는 offset `limit/offset`)
5. 클라이언트가 서버 내부 구현을 추론해야 하는 enum value naming 금지 → SCREAMING_SNAKE_CASE enum 사용, DB 컬럼명 노출 금지

**guidelines (6):**

1. Cursor-based pagination: `first/after` 패턴 권장 (UUID v7 PK 활용, offset drift 없음). Relay Connection spec(`edges/node/pageInfo`)은 선택적 — 단순 `{ nodes, pageInfo { hasNextPage, endCursor } }` 형태도 허용
2. Input type 설계: mutation 인자는 단일 `input: CreateUserInput!` 패턴. 개별 scalar 인자 나열 금지
3. Mutation 응답은 Payload 패턴: `type CreateUserPayload { user: User, userErrors: [UserError!]! }`. HTTP 200 + application-level error
4. N+1 해결: DataLoader 패턴 필수. resolver에서 직접 DB 쿼리 금지 → batch loader로 위임
5. Schema naming: `PascalCase` 타입, `camelCase` 필드/인자, `SCREAMING_SNAKE_CASE` enum 값
6. deprecated 필드는 `@deprecated(reason: "...")` 디렉티브로 마킹. 즉시 삭제 대신 점진적 마이그레이션

**decision_table (4):**

1. 컬렉션 반환 → cursor-based pagination (`first/after`, UUID v7 PK 기반) — 실시간 데이터·무한 스크롤에 안정적. 관리자 테이블 등 단순 케이스에서는 offset(`limit/offset`)도 허용 | avoid: unbounded `[Node!]!` (메모리·성능 위험)
2. mutation 에러 전달 → Payload union 타입 (`User | ValidationError`) + `userErrors` 필드 | avoid: top-level GraphQL errors (클라이언트 분기 어려움)
3. 스키마 변경 시 기존 필드 제거 → `@deprecated` 마킹 → 클라이언트 마이그레이션 확인 → 다음 메이저 버전에서 제거 | avoid: 즉시 삭제 (클라이언트 장애)
4. 복잡한 필터링/정렬 → dedicated `FilterInput` / `OrderByInput` 타입 정의 | avoid: JSON string 파라미터 (타입 안전성 없음, IDE 지원 불가)

---

## 2. `nestjs-graphql.yaml` — NestJS Code-First Patterns (priority 43)

`nestjs.yaml`의 GraphQL 특화 확장. Code-first + Resolver DI.

**constraints (5):**

1. Resolver에 비즈니스 로직 금지 → Service로 위임 (nestjs.yaml Controller 규칙과 동일 원칙)
2. `@Args()` 없이 raw GraphQL context 직접 접근 금지 → 타입 안전한 `@Args('input') input: CreateUserInput` 사용
3. `@ResolveField()` 내 직접 DB 쿼리 금지 → DataLoader 주입으로 N+1 방지
4. `@Subscription()` 에서 인증 없이 데이터 노출 금지 → Guard 적용 또는 filter 함수에서 권한 검증
5. 수동 schema SDL 파일 작성 금지 (code-first 프로젝트) → TypeScript 데코레이터(`@ObjectType`, `@Field`)가 single source of truth

**guidelines (6):**

1. `@Resolver(() => Entity)` + `@Query()` / `@Mutation()` / `@ResolveField()` 데코레이터로 resolver 구성. 도메인별 하나의 resolver 파일
2. DataLoader를 NestJS request-scoped provider로 등록. `@nestjs/dataloader` 또는 커스텀 `DataLoaderFactory` 사용
3. `@ObjectType()` / `@InputType()` / `@ArgsType()`에 `{ description: '...' }` 명시 → 자동 생성 SDL 문서화
4. complexity/depth limiting: `graphql-query-complexity` + `@nestjs/graphql` complexity plugin 적용. DoS 방어
5. Custom scalar (`DateTime`, `JSON` 등)는 `@Scalar()` 데코레이터 + 전용 클래스로 정의. 글로벌 등록
6. `@UseGuards()` / `@UseInterceptors()`를 resolver 레벨에 적용. REST Guard와 동일하게 `ExecutionContext`에서 GQL context 추출 (`GqlExecutionContext.create(ctx)`)

**decision_table (3):**

1. Field-level 데이터 로딩 → `@ResolveField()` + DataLoader (배치 로딩) | avoid: `@ResolveField()` 내 직접 repository 호출 (N+1)
2. 실시간 데이터 → `@Subscription()` + Redis PubSub (`graphql-redis-subscriptions`) | avoid: in-memory PubSub (단일 인스턴스에서만 동작, 수평 확장 불가)
3. 인증/인가 → `@UseGuards(GqlAuthGuard)` + `GqlExecutionContext` | avoid: resolver 함수 내 수동 토큰 검증 (횡단 관심사 혼재)

---

## 수정 대상 파일 요약

| 파일                                                        | 작업                                        |
| ----------------------------------------------------------- | ------------------------------------------- |
| `packages/compiler/data/rules/graphql.yaml`                 | **신규**                                    |
| `packages/compiler/data/rules/nestjs-graphql.yaml`          | **신규**                                    |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles 배열에 2개 추가 (22개) |

## 참조 파일

| 파일                                                      | 용도                                                  |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `packages/compiler/src/schemas/rule.schema.ts`            | Zod 스키마 검증 구조                                  |
| `packages/compiler/data/rules/nestjs.yaml`                | 중복 방지 (guideline#5 GraphQL 언급)                  |
| `packages/compiler/data/rules/libs-backend-ts.yaml`       | 중복 방지 (apollo/server, graphql-codegen 라이브러리) |
| `packages/compiler/data/rules/libs-frontend-web.yaml`     | 중복 방지 (apollo/client, graphql-codegen client)     |
| `packages/compiler/data/rules/engineering-standards.yaml` | 대칭 구조 참조 (API 에러, pagination 일반론)          |

## Verification

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

- 22개 rule YAML 스키마 검증 통과
- id 유일성 (22개) 통과
- priority 유일성 (22개) 통과
