# Phase 2-B-6: prisma-postgresql.yaml 구현 계획

## Context

Phase 2-B-5까지 8개 Rule YAML이 완성됨 (priority: 90, 85, 80, 75, 65, 60, 50, 45).
이번 Phase에서 Prisma ORM + PostgreSQL 컨벤션 규칙을 `prisma-postgresql.yaml`로 작성한다.

Prisma v7이 최신 버전이며, 주요 변경사항(Rust→TypeScript 마이그레이션, ESM 전용, driver adapter 필수, `$use()` middleware 제거, `prisma-client` generator)을 반영한다.

Rule 콘텐츠 작성 원칙(constraints=hard ban, guidelines=positive pattern, decision_table=ambiguous A vs B)을 준수하며, AI가 이미 잘 아는 기본 CRUD 사용법은 제외한다.

---

## 설계 결정

### Priority & Category

- **id:** `prisma-postgresql`
- **category:** `database`
- **tags:** `typescript`, `prisma`, `postgresql`
- **priority:** `40` (nestjs=45 바로 아래, 유일한 값)

### 콘텐츠 설계

기존 `typescript.yaml`(언어 레벨), `nestjs.yaml`(프레임워크 레벨)과 중복되지 않도록, Prisma ORM + PostgreSQL 고유 패턴에만 집중한다. Prisma v7 기준으로 작성.

#### constraints (AI가 자주 위반하는 안티패턴)

1. **`$queryRawUnsafe` 문자열 결합 금지** — AI가 동적 쿼리를 만들 때 `$queryRawUnsafe`에 문자열 보간/결합으로 SQL injection 취약점 생성. tagged template `$queryRaw`만 사용하거나, `$queryRawUnsafe` 사용 시 반드시 위치 파라미터(`$1`, `$2`) 사용.
2. **Prisma 모델을 API 응답으로 직접 노출 금지** — Entity에 민감한 필드(password, deletedAt 등) 포함. AI가 `findMany()` 결과를 그대로 반환하는 경향. `select`로 필요한 필드만 조회하거나 DTO로 변환.
3. **`@updatedAt` 없는 mutable 모델 금지** — 변경 가능한 모델에 `updatedAt DateTime @updatedAt` 누락 시 데이터 추적 불가. AI가 빠른 스키마 생성 시 자주 빠뜨림.
4. **`$use()` middleware 사용 금지 (v7)** — Prisma v7에서 제거됨. Client Extensions(`$extends`)로 대체.
5. **프로덕션에서 `db push` 사용 금지** — `db push`는 개발 전용. 프로덕션은 반드시 `prisma migrate deploy`로 버전 관리된 마이그레이션만 실행. AI가 빠른 가이드에서 환경 구분 없이 `db push`를 제안하는 경향.

#### guidelines (AI가 빠뜨리는 권장 패턴)

1. **`prisma-client` generator + 명시적 output** — v7에서 `prisma-client-js`는 deprecated. `provider: "prisma-client"` + `output` 필드 필수 지정.
2. **Driver adapter 명시적 설정** — v7에서 모든 DB에 driver adapter 필수. PostgreSQL은 `@prisma/adapter-pg` 사용, 커넥션 풀 설정(max, idleTimeout, connectionTimeout) 명시.
3. **where/orderBy/relation 필드에 `@@index` 추가** — 테이블 성장 시 full scan 방지. 복합 조건은 `@@index([fieldA, fieldB])`.
4. **Interactive transaction에 timeout/maxWait 설정** — 기본값(timeout: 5000, maxWait: 2000)이 부족할 수 있음. 비즈니스 요구에 맞게 명시적 설정.
5. **`prisma.config.ts`로 설정 중앙화** — v7에서 datasource URL, migration 경로, seed 스크립트를 `prisma.config.ts`에서 관리. schema.prisma의 `url`/`directUrl` deprecated.
6. **Soft delete는 middleware가 아닌 Client Extension으로 구현** — `$extends`의 `query` hook으로 `findMany`에 `where: { deletedAt: null }` 자동 주입.
7. **대용량 테이블은 커서 기반 페이징 우선** — `skip/take` 오프셋 방식은 깊은 페이지에서 성능 급감. `cursor` + `take`로 인덱스를 타는 커서 기반 페이징 사용.
8. **서버리스/컨테이너 환경에서 외부 커넥션 풀러 구성** — `@prisma/adapter-pg` 사용 시 DB Max Connection 고갈 방지를 위해 PgBouncer 등 외부 풀러 연동 또는 `connection_limit` 파라미터 명시 설정.

#### decision_table (진짜 헷갈리는 분기)

1. **`$queryRaw` vs Prisma Client API** — 복잡한 집계/윈도우 함수/CTE는 `$queryRaw` (tagged template), 일반 CRUD/필터링/페이지네이션은 Prisma Client API 사용.
2. **Interactive transaction vs Batch transaction (`$transaction([...])`)** — 이전 쿼리 결과에 따라 다음 쿼리가 달라지면 interactive, 독립적인 쿼리 묶음이면 batch (더 가볍고 빠름).

---

## 구현 순서

### Step 1: `prisma-postgresql.yaml` 생성

파일: `packages/compiler/data/rules/prisma-postgresql.yaml`

```yaml
id: prisma-postgresql
category: database
tags:
  - typescript
  - prisma
  - postgresql
priority: 40
content:
  constraints:
    - 'DO NOT use $queryRawUnsafe with string interpolation or concatenation. It creates SQL injection vulnerabilities. Use tagged template $queryRaw`...${variable}` which auto-escapes, or use positional parameters ($1, $2) with $queryRawUnsafe.'
    - 'DO NOT return Prisma model objects directly as API responses. Models may contain sensitive fields (password, tokens, deletedAt). Use select to pick specific fields or map to a response DTO.'
    - 'DO NOT define mutable models without an updatedAt field. Add `updatedAt DateTime @updatedAt` to every model that can be modified after creation.'
    - 'DO NOT use $use() middleware — it is removed in Prisma v7. Use Client Extensions ($extends) with query hooks instead.'
    - 'DO NOT use prisma db push in production. It can cause data loss and has no migration history. Use prisma migrate deploy with versioned migration files only.'
  guidelines:
    - 'Use the prisma-client generator with an explicit output path: generator client { provider = "prisma-client"; output = "./generated/prisma/client" }. The legacy prisma-client-js provider is deprecated in v7.'
    - 'Configure a driver adapter explicitly. For PostgreSQL, use @prisma/adapter-pg with pool settings (max connections, idleTimeoutMillis, connectionTimeoutMillis) tuned to your environment.'
    - 'Add @@index on fields used in where, orderBy, and relation foreign keys. Use composite indexes @@index([fieldA, fieldB]) for multi-column filter patterns.'
    - 'Set explicit timeout and maxWait on interactive transactions to match your business requirements — the defaults (timeout: 5000ms, maxWait: 2000ms) may be too short for complex operations.'
    - 'Centralize configuration in prisma.config.ts (datasource URL, migration path, seed script). The url and directUrl fields in the schema.prisma datasource block are deprecated in v7.'
    - 'Implement soft delete via Client Extension ($extends query hook) that injects where: { deletedAt: null } into find queries automatically — not via the removed $use() middleware.'
    - 'Prefer cursor-based pagination (cursor + take) over offset-based (skip + take) for large tables. Offset pagination degrades as page depth increases; cursor pagination leverages indexes consistently.'
    - 'In serverless or containerized environments, configure an external connection pooler (e.g., PgBouncer) or set an explicit connection_limit on @prisma/adapter-pg to prevent database max connection exhaustion.'
  decision_table:
    - when: 'Query requires window functions, CTEs, complex aggregations, or PostgreSQL-specific syntax not supported by Prisma Client API'
      then: 'Use $queryRaw with tagged template literals for automatic escaping and type safety'
      avoid: 'Overusing raw SQL for queries that Prisma Client API can express — lose type safety and query validation'
    - when: 'Transaction involves multiple writes where later queries depend on earlier results'
      then: 'Use interactive transaction ($transaction(async (tx) => { ... })) with explicit timeout/maxWait'
      avoid: 'Using batch transaction ($transaction([...])) when queries are interdependent — batch does not guarantee execution order access'
```

### Step 2: 테스트 파일 업데이트

파일: `packages/compiler/src/schemas/__tests__/rule-data.test.ts`

`ruleFiles` 배열에 `'prisma-postgresql.yaml'` 추가.

### Step 3: 검증

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

---

## 수정 대상 파일

| 파일                                                        | 작업                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| `packages/compiler/data/rules/prisma-postgresql.yaml`       | **새로 생성**                                          |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles에 `'prisma-postgresql.yaml'` 추가 |

## 참조 파일 (수정 없음)

- `packages/compiler/src/schemas/rule.schema.ts` — Zod 스키마 (strict 모드, decision_table optional)
- `packages/compiler/data/rules/nestjs.yaml` — 동일 레벨 참조 패턴
- `.claude/plans/20260224_implement_plan.md` — 전체 구현 계획

## Verification

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

- 모든 기존 테스트 + prisma-postgresql.yaml 스키마 검증 통과
- id 유일성, priority 유일성 테스트 통과

## 참고 자료

- [Prisma v7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Prisma v7 Release Blog](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0)
- [Prisma Best Practices (indexing)](https://github.com/prisma/docs/blob/main/apps/docs/content/docs/orm/more/best-practices.mdx)
- [Prisma Raw Query SQL Injection Prevention](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries)
