# Phase 2-B-7: shadcn-ui.yaml 구현 + nextjs.yaml SEO/GEO 보강

## Context

Phase 2-B-6까지 9개 Rule YAML 완성 (priority: 90~40).
이번 Phase에서:

1. **Shadcn/UI + Tailwind CSS** 컨벤션 규칙을 `shadcn-ui.yaml`로 신규 작성
2. **nextjs.yaml**에 SEO/GEO 가이드라인 추가

핵심 의도: AI가 커스텀 컴포넌트를 처음부터 만들지 않고 **Shadcn 컴포넌트를 우선 활용**하도록 강제.

---

## 설계 결정

### 1. shadcn-ui.yaml

- **id:** `shadcn-ui`
- **category:** `ui`
- **tags:** `typescript`, `react`, `shadcn-ui`, `tailwind`
- **priority:** `35` (prisma-postgresql=40 아래, 유일 값)

#### constraints

1. **Shadcn 제공 컴포넌트 재구현 금지** — Dialog, Sheet, Select, Toast 등 Shadcn에 이미 있는 UI를 직접 구현하지 말 것. `npx shadcn@latest add <component>` 사용.
2. **Shadcn 소스 파일 직접 수정 금지** — `components/ui/*.tsx` 파일을 직접 편집하지 말 것. 래퍼 컴포넌트로 확장하거나 className으로 커스터마이징.
3. **Tailwind 임의 값(arbitrary values) 남용 금지** — `w-[327px]` 같은 매직 넘버 지양. design token(spacing, color)을 `tailwind.config.ts`에 정의하고 사용.
4. **인라인 스타일(`style={}`) 금지** — 동적 값(런타임 계산)만 예외. 정적 스타일은 반드시 Tailwind 클래스 사용.

#### guidelines

1. **UI 구현 시 Shadcn 컴포넌트 카탈로그를 먼저 확인** — 새 UI 요소가 필요하면 https://ui.shadcn.com/docs/components 에서 해당 컴포넌트 존재 여부 먼저 확인 후 작업.
2. **`cn()` 유틸리티로 조건부 클래스 병합** — `clsx` + `tailwind-merge` 조합인 `cn()` 사용. 문자열 템플릿이나 수동 조건 결합 대신 `cn(base, condition && variant)`.
3. **Shadcn 컴포지션 패턴 준수** — 복합 컴포넌트는 서브 컴포넌트를 조합 (예: `Dialog` = `DialogTrigger` + `DialogContent` + `DialogHeader` + `DialogTitle` + `DialogDescription`).
4. **컴포넌트 변형은 `cva` (class-variance-authority) 사용** — 다중 variant가 필요한 컴포넌트는 `cva`로 variant map을 정의. props 조건문으로 클래스를 분기하지 말 것.
5. **CSS 변수 기반 테마 시스템 유지** — 색상은 `hsl(var(--primary))` 형태의 CSS 변수 사용. `tailwind.config.ts`에서 CSS 변수를 Tailwind 토큰에 매핑.
6. **반응형은 mobile-first** — Tailwind 기본이 mobile-first. `sm:`, `md:`, `lg:` 순서로 breakpoint 적용. desktop-first(`max-*:`) 지양.
7. **접근성(a11y) 보장** — Shadcn(Radix UI)이 제공하는 내장 접근성 기능을 훼손하지 말 것. 아이콘 전용 버튼이나 시각적 요소만 있는 경우 반드시 `aria-label` 또는 `<span className="sr-only">`로 스크린 리더 텍스트 제공.
8. **아이콘은 개별 import로 번들 최적화** — Lucide React 등 아이콘 라이브러리 사용 시 네임스페이스 전체를 import하지 말고, 개별 아이콘을 named import하여 번들 사이즈 최적화.

#### decision_table

1. **Shadcn 컴포넌트 vs 커스텀 컴포넌트** — Shadcn 카탈로그에 있거나 Radix primitive 조합으로 만들 수 있으면 Shadcn 사용. Shadcn에 없고 도메인 특화된 복잡한 인터랙션이면 커스텀 컴포넌트 작성.
2. **Tailwind 클래스 vs CSS Modules** — Tailwind 클래스가 기본. 매우 복잡한 애니메이션/키프레임이나 서드파티 라이브러리 스타일 오버라이드는 CSS Modules 사용.

---

### 2. nextjs.yaml SEO/GEO 가이드라인 추가

기존 guidelines에 2개 항목 추가:

1. **퍼블릭 페이지에 `generateMetadata` 또는 정적 `metadata` export 필수** — 모든 public-facing page.tsx에 title, description, Open Graph 메타데이터 정의. SEO 크롤러와 소셜 미디어 공유 대응.
2. **GEO(Generative Engine Optimization) 대응: 구조화된 데이터 마크업 적용** — 퍼블릭 페이지에 JSON-LD `<script type="application/ld+json">` 삽입. schema.org 기반 구조화 데이터로 AI 검색엔진(SGE, Perplexity 등)과 기존 검색엔진 모두 최적화.

---

## 구현 순서

### Step 1: `shadcn-ui.yaml` 생성

파일: `packages/compiler/data/rules/shadcn-ui.yaml`

### Step 2: `nextjs.yaml` 수정

파일: `packages/compiler/data/rules/nextjs.yaml`

- guidelines 배열에 SEO/GEO 항목 2개 추가

### Step 3: 테스트 파일 업데이트

파일: `packages/compiler/src/schemas/__tests__/rule-data.test.ts`

- ruleFiles 배열에 `'shadcn-ui.yaml'` 추가

### Step 4: 검증

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

---

## 수정 대상 파일

| 파일                                                        | 작업                                           |
| ----------------------------------------------------------- | ---------------------------------------------- |
| `packages/compiler/data/rules/shadcn-ui.yaml`               | **새로 생성**                                  |
| `packages/compiler/data/rules/nextjs.yaml`                  | **수정** — SEO/GEO guidelines 2개 추가         |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — ruleFiles에 `'shadcn-ui.yaml'` 추가 |

## Verification

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

- 모든 기존 테스트 + shadcn-ui.yaml 스키마 검증 통과
- id/priority 유일성 테스트 통과
