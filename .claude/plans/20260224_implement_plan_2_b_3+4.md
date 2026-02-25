# Phase 2-B-3/4: typescript.yaml 검토 + nextjs.yaml 구현

## Context

Phase 2-B-2에서 `typescript.yaml`과 `react-typescript.yaml`이 이미 생성 완료. 원본 `.claude/rules/typescript.md`의 모든 항목이 커버됨.
이번 Phase에서는 typescript.yaml의 완성도를 확인하고, `nextjs.yaml`을 새로 작성한다.

추가로, 규칙 배치 전략에 대한 설계 결정(라이브러리 선호 규칙, 횡단 아키텍처 규칙)을 확립한다.

---

## 설계 결정

### 1. typescript.yaml → 변경 없음

원본 md 100% 커버 완료. 추가 후보(exhaustive switch, generic constraints 등)는 실제 사용 시 필요하면 추가 — WET 원칙.

### 2. 라이브러리 선호 규칙 → `tech-stack.yaml` (category: `stack`, priority: 55)

| 선택지                     | 판단                                                |
| -------------------------- | --------------------------------------------------- |
| typescript.yaml에 추가     | ❌ "언어 문법"과 "기술 선택"은 다른 축              |
| framework별 yaml에 분산    | ❌ zod, date-fns 등 프레임워크 공통 라이브러리 중복 |
| **전용 `tech-stack.yaml`** | ✅ 프로젝트별 오버라이드 용이, 깔끔한 관심사 분리   |

### 3. 횡단 아키텍처 규칙 → `engineering-standards.yaml` (category: `standard`, priority: 70)

날짜 처리(ISO8601 UTC), API response envelope 등 언어/프레임워크 무관한 엔지니어링 표준.
`code-philosophy`(철학/원칙)와는 추상화 레벨이 다름 — 철학은 "how to think", 표준은 "what to do".

### 4. 업데이트된 Priority 맵

| Priority | ID                        | Category            |
| -------- | ------------------------- | ------------------- |
| 90       | role-persona              | persona             |
| 85       | communication             | communication       |
| 80       | code-philosophy           | philosophy          |
| 75       | naming-convention         | convention          |
| **70**   | **engineering-standards** | **standard** ← NEW  |
| 65       | typescript                | language            |
| 60       | react-typescript          | framework           |
| **55**   | **tech-stack**            | **stack** ← NEW     |
| **50**   | **nextjs**                | **framework** ← NEW |

---

## 구현 순서

### Step 1: `nextjs.yaml` 생성

파일: `packages/compiler/data/rules/nextjs.yaml`

```yaml
id: nextjs
category: framework
tags:
  - typescript
  - react
  - nextjs
  - app-router
priority: 50
content:
  constraints:
    - "DO NOT import server-only code (db clients, secrets, internal APIs) in Client Components. Use the 'server-only' package to enforce the boundary."
    - 'DO NOT store secrets in NEXT_PUBLIC_ environment variables. Only NEXT_PUBLIC_ vars are exposed to the browser.'
    - 'DO NOT use next/router. Use next/navigation (useRouter, usePathname, useSearchParams) in App Router.'
  guidelines:
    - 'Use the Next.js file conventions: page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx.'
    - "Co-locate Server Actions in a dedicated file (e.g., actions.ts) with 'use server' at the top."
    - 'Use next/image for all images with explicit width/height or fill+sizes.'
    - 'Use next/font in root layout, apply via CSS variable.'
    - 'Use middleware.ts only for cross-cutting concerns: auth redirects, locale detection, header injection.'
  decision_table:
    - when: 'Component needs event handlers, useState, useEffect, or browser APIs'
      then: "Add 'use client' to that component only"
      avoid: "Adding 'use client' to a parent — push it to the smallest leaf"
    - when: 'Data needs to be fetched for a page'
      then: 'Fetch in Server Component (page.tsx, layout.tsx) with async/await'
      avoid: 'useEffect + fetch in Client Component for initial page data'
    - when: 'Form submission or data mutation'
      then: 'Server Action via form action or startTransition'
      avoid: 'POST route.ts for simple mutations'
    - when: 'API endpoint for external consumers or webhooks'
      then: 'route.ts with explicit HTTP method exports (GET, POST)'
      avoid: 'Server Actions for external API endpoints'
```

**중복 제거 근거:**

- "Server Component default" → decision_table의 첫 번째 항목이 커버. constraint/guideline에서 제거.
- "데이터 페칭" → decision_table 항목으로만 존재. AI가 혼동하는 Server vs Client fetch 분기만 명시.
- "Server Action vs Route Handler" → decision_table 2개 항목이 정확한 분기 기준 제공. constraint 제거.
- next/script, dynamic import, ISR, Suspense, route groups → AI가 잘 아는 내용. 규칙으로 강제할 필요 없음.

### Step 2: 테스트 파일 업데이트

파일: `packages/compiler/src/schemas/__tests__/rule-data.test.ts`

`ruleFiles` 배열에 `'nextjs.yaml'` 추가.

### Step 3: 검증

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

---

## Step 0 (선행): `20260224_implement_plan.md` 수정

### 0-1. Rule 콘텐츠 작성 원칙 추가

2-B 섹션 상단(항목 목록 위)에 아래 원칙을 추가:

```markdown
#### Rule 콘텐츠 작성 원칙

각 항목은 **하나의 레이어에만** 존재해야 한다. 레이어 간 내용이 중복되면 AI 모델에 불필요한 토큰을 소비하고, 모순이 생길 위험이 높아진다.

| 레이어           | 역할                        | 작성 기준                                                                                                                  |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `constraints`    | 절대 금지 (hard ban)        | AI가 자주 생성하는 **위험한 안티패턴**만. "DO NOT ..." 형식.                                                               |
| `guidelines`     | 권장 패턴 (best practice)   | AI가 자주 빠뜨리거나 잘못 적용하는 **긍정적 패턴**만. constraints와 대칭되지 않아야 함.                                    |
| `decision_table` | 분기 판단 (ambiguous cases) | AI가 **진짜 헷갈릴 수 있는 A vs B 선택**만. constraint/guideline으로 명확히 표현 가능한 것은 decision_table에 넣지 않는다. |

**체크리스트 (작성 후 자가 검증):**

1. 같은 주제가 2개 이상의 레이어에 등장하지 않는가?
2. AI 모델이 이미 잘 아는 내용(공식 문서에 명확히 나오는 기본 사용법)을 규칙으로 강제하고 있지 않은가?
3. 각 constraint는 실제로 AI가 위반할 가능성이 높은가?
```

### 0-2. 2-B 하위 작업 추가

기존 2-B-8 뒤에 추가:

```markdown
- **2-B-9.** `data/rules/tech-stack.yaml` — 프로젝트 표준 라이브러리 선택 (category: stack, priority: 55)
- **2-B-10.** `data/rules/engineering-standards.yaml` — 횡단 엔지니어링 표준: 날짜(ISO8601 UTC), API envelope 등 (category: standard, priority: 70)
```

---

## Scope 외 (이번 Phase에서 미구현)

`tech-stack.yaml`과 `engineering-standards.yaml`은 설계 결정만 확립.
→ `20260224_implement_plan.md`의 2-B 섹션에 하위 작업으로 등록.

---

## 수정 대상 파일

| 파일                                                        | 작업                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/compiler/data/rules/nextjs.yaml`                  | **새로 생성**                                                          |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles에 추가                                            |
| `.claude/plans/20260224_implement_plan.md`                  | **수정** — 2-B 섹션에 tech-stack, engineering-standards 하위 작업 추가 |

## 참조 파일 (수정 없음)

- `packages/compiler/src/schemas/rule.schema.ts`
- `packages/compiler/data/rules/typescript.yaml`
- `packages/compiler/data/rules/react-typescript.yaml`
