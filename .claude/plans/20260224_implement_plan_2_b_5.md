# Phase 2-B-5: nestjs.yaml 구현 계획

## Context

Phase 2-B-4까지 7개 Rule YAML이 완성됨 (priority: 90, 85, 80, 75, 65, 60, 50).
이번 Phase에서 NestJS 모듈/서비스/컨트롤러 컨벤션 규칙을 `nestjs.yaml`로 작성한다.

Rule 콘텐츠 작성 원칙(constraints=hard ban, guidelines=positive pattern, decision_table=ambiguous A vs B)을 준수하며, AI가 이미 잘 아는 NestJS 기본 사용법은 제외한다.

---

## 설계 결정

### Priority & Category

- **id:** `nestjs`
- **category:** `framework`
- **tags:** `typescript`, `nestjs`
- **priority:** `45` (nextjs=50 바로 아래, 유일한 값)

### 콘텐츠 설계

기존 `typescript.yaml`(언어 레벨)과 중복되지 않도록, NestJS 프레임워크 고유 패턴에만 집중한다.

#### constraints (AI가 자주 위반하는 안티패턴)

1. **`@Res()` 직접 사용 금지** — `@Res()`로 응답을 직접 보내면 Interceptor, Exception Filter, Serialization 파이프라인이 전부 무시됨. AI가 Express 습관으로 자주 생성.
2. **Controller에 비즈니스 로직 금지** — Controller는 thin orchestrator. 로직은 Service에. AI가 간단한 예제에서 Controller에 직접 로직을 넣는 경향 강함.
3. **순환 의존 금지** — Module 간 순환 import는 `forwardRef()`로 우회하지 말고 설계를 수정. AI가 forwardRef를 쉽게 제안함.

#### guidelines (AI가 빠뜨리는 권장 패턴)

1. **Feature Module 단위 구성** — 도메인별 하나의 module (e.g., `users/users.module.ts`). Controller, Service, DTOs 같은 디렉토리에 co-locate.
2. **DTO로 요청/응답 계약 명시** — class-validator + class-transformer 기반 DTO. Entity를 직접 응답으로 노출하지 않음.
3. **Global pipe/filter/guard는 main.ts에서 등록** — `app.useGlobalPipes(new ValidationPipe({ whitelist: true }))` 패턴.
4. **Custom Exception은 HttpException 상속** — 비즈니스 예외도 HttpException 계층 활용.

#### decision_table (진짜 헷갈리는 분기)

1. **Guard vs Middleware** — 인증/인가 체크는 Guard (ExecutionContext 접근 가능), 요청 변환/로깅은 Middleware.
2. **Pipe vs Interceptor** — 입력 변환/검증은 Pipe, 응답 변환/캐싱/로깅은 Interceptor.

---

## 구현 순서

### Step 1: `nestjs.yaml` 생성

파일: `packages/compiler/data/rules/nestjs.yaml`

```yaml
id: nestjs
category: framework
tags:
  - typescript
  - nestjs
priority: 45
content:
  constraints:
    - 'DO NOT use @Res() or @Response() decorator to send responses directly. It bypasses Interceptors, Exception Filters, and built-in serialization. Return values from the handler instead.'
    - 'DO NOT put business logic in Controllers. Controllers are thin orchestrators — delegate all logic to Services.'
    - 'DO NOT use forwardRef() to work around circular dependencies. Redesign the module boundary or extract a shared module instead.'
  guidelines:
    - 'Organize by feature module: one module per domain (e.g., users/users.module.ts) co-locating its controller, service, and DTOs.'
    - 'Define request/response DTOs with class-validator decorators. Never expose entities directly as API responses.'
    - 'Register global pipes, filters, and guards in main.ts bootstrap (e.g., app.useGlobalPipes(new ValidationPipe({ whitelist: true }))).'
    - 'Extend HttpException for custom business exceptions to integrate with the built-in exception filter layer.'
  decision_table:
    - when: 'Cross-cutting concern needs access to ExecutionContext (e.g., role check, auth)'
      then: 'Use a Guard (@CanActivate) — it runs after middleware, before interceptors, and has access to the handler metadata'
      avoid: 'Using middleware for auth — middleware lacks ExecutionContext and @SetMetadata access'
    - when: 'Need to transform, wrap, or cache the response, or measure execution time'
      then: 'Use an Interceptor — it wraps the handler execution with RxJS Observable'
      avoid: 'Using middleware for response transformation — middleware runs before the route handler'
```

### Step 2: 테스트 파일 업데이트

파일: `packages/compiler/src/schemas/__tests__/rule-data.test.ts`

`ruleFiles` 배열에 `'nestjs.yaml'` 추가.

### Step 3: 검증

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

---

## 수정 대상 파일

| 파일                                                        | 작업                                        |
| ----------------------------------------------------------- | ------------------------------------------- |
| `packages/compiler/data/rules/nestjs.yaml`                  | **새로 생성**                               |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles에 `'nestjs.yaml'` 추가 |

## 참조 파일 (수정 없음)

- `packages/compiler/src/schemas/rule.schema.ts` — Zod 스키마 (strict 모드, decision_table optional)
- `packages/compiler/data/rules/nextjs.yaml` — 동일 category(framework) 참조 패턴
- `.claude/plans/20260224_implement_plan.md` — 전체 구현 계획

## Step 4: `20260224_implement_plan.md` 업데이트

2-B 섹션에 GraphQL 관련 하위 작업 2개 추가:

```markdown
- **2-B-11.** `data/rules/graphql.yaml` — GraphQL 스키마 설계, 쿼리/뮤테이션 패턴 (category: api, priority: TBD)
- **2-B-12.** `data/rules/nestjs-graphql.yaml` — NestJS GraphQL code-first, resolver 패턴 (category: framework, priority: TBD)
```

**분리 근거:**

- `graphql.yaml` — 프레임워크 무관한 GraphQL 자체 규칙 (스키마 설계 원칙, naming, pagination, error handling)
- `nestjs-graphql.yaml` — NestJS code-first 특화 (resolver 구조, @Query/@Mutation 데코레이터, DataLoader, guard 적용 등)

---

## 추가 피드백 반영 (Post-Implementation)

3개 항목 추가 결정:

### 추가 constraints

4. **`process.env` 직접 사용 금지** — Service/Controller에서 `process.env.FOO` 직접 참조는 타입 안전성 없음. `ConfigService` + 시작 시점 스키마 검증 강제. AI가 빠른 구현으로 자주 직접 참조함.
5. **`console.log` 사용 금지** — NestJS의 DI 기반 Logger 또는 커스텀 Logger(pino, Winston)로 대체. AI가 디버그 예시에서 console.log를 그대로 남겨두는 경향.

### 추가 guidelines

5. **API 문서화** — REST API는 `@nestjs/swagger` (@ApiOperation, @ApiProperty) 필수. GraphQL은 SDL 스키마가 계약이므로 Swagger 생략. REST/GraphQL 조건부이므로 constraint보다 guideline이 적합.

---

## 수정 대상 파일 (최종)

| 파일                                                        | 작업                                        |
| ----------------------------------------------------------- | ------------------------------------------- |
| `packages/compiler/data/rules/nestjs.yaml`                  | **새로 생성**                               |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles에 `'nestjs.yaml'` 추가 |
| `.claude/plans/20260224_implement_plan.md`                  | **수정** — 2-B 섹션에 2-B-11, 2-B-12 추가   |

## Verification

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

- 모든 기존 테스트 + nestjs.yaml 스키마 검증 통과
- id 유일성, priority 유일성 테스트 통과
