# Phase 2-B-1: general.md → Rule YAML 변환

## Context

Phase 2-A에서 Zod 스키마(RuleSchema)가 확정되었고, `packages/compiler/data/rules/` 디렉토리가 비어있는 상태.
기존 `.claude/rules/general.md`의 규칙들을 RuleSchema에 맞는 YAML로 구조화하면서, 원본의 개선점도 함께 반영한다.

---

## 설계 결정

| 결정        | 선택          | 이유                                                                                                |
| ----------- | ------------- | --------------------------------------------------------------------------------------------------- |
| Granularity | 3개 파일 분리 | RuleSchema는 rule당 category 1개. 3개 도메인을 1개로 합치면 정보 손실                               |
| 개선 범위   | 모두 반영     | Riverpod→범용, Jest→일반화, \*.logic.ts→언어별 rule로 이동, Diff Only→태그 불필요 (대화형 CLI 공통) |

---

## 원본 평가 & 개선 사항

| 원본                                              | 문제                                                                   | 개선                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| "DO NOT explain basic concepts" + "Riverpod" 예시 | 시니어도 특정 도메인에선 비기너. AI 위임 시 WHY 설명이 의사결정에 필수 | constraint: 패트로나이징 튜토리얼만 금지. guideline: 패턴/개념 선택 이유(WHY) 설명 추가                   |
| "failing test case (Jest)"                        | 프로젝트는 vitest 사용                                                 | "failing test case" (프레임워크 비특정)                                                                   |
| `*.logic.ts` / `*.util.ts` / `domain/` 파일 패턴  | 구체적 파일 패턴은 언어별 컨벤션 영역                                  | philosophy에는 원칙만 남김. 파일 패턴은 해당 언어 rule에서 정의 (e.g., `typescript.yaml`, `flutter.yaml`) |
| "Diff Only" 규칙                                  | 대화형 CLI(claude/gemini/codex) 모두 해당                              | 태그 제한 불필요. Profile `include_rules`가 도구별 적용 제어                                              |

---

## 파일 구조

```
packages/compiler/data/rules/
├── role-persona.yaml          # category: persona,      priority: 90
├── communication.yaml         # category: communication, priority: 85
└── code-philosophy.yaml       # category: philosophy,    priority: 80
```

테스트:

```
packages/compiler/src/schemas/__tests__/
└── rule-data.test.ts          # YAML 데이터 → RuleSchema 검증
```

---

## 구현 순서

### Step 1: `role-persona.yaml` 작성

```yaml
id: role-persona
category: persona
tags:
  - general
  - persona
priority: 90
content:
  constraints:
    - "DO NOT write patronizing tutorials (e.g., 'First, let me explain what React is...')."
  guidelines:
    - 'You are an expert Senior Full-Stack Developer.'
    - 'Assume the user is a senior developer, but may be unfamiliar with specific domains or patterns.'
    - 'When choosing a pattern, library, or architectural approach, briefly explain WHY it was chosen over alternatives.'
    - 'Focus on high-level architecture, edge cases, performance optimization, and maintainability.'
```

### Step 2: `communication.yaml` 작성

```yaml
id: communication
category: communication
tags:
  - general
  - communication
priority: 85
content:
  constraints:
    - "DO NOT use filler phrases like 'Certainly,' 'Of course,' 'Here is the code,' 'I understand,' 'Great question.' Just output the solution."
  guidelines:
    - 'Think and explain in Korean. Write code and comments in English.'
```

> Diff Only 관련 규칙(constraint, guideline, decision_table)은 도구 내장 동작과 중복되어 제거.
> 실사용 시 문제가 발생하면 추후 추가.

### Step 3: `code-philosophy.yaml` 작성

```yaml
id: code-philosophy
category: philosophy
tags:
  - general
  - philosophy
  - tdd
  - functional
  - immutability
priority: 80
content:
  constraints:
    - "DO NOT over-engineer or write 'clever' one-liners. Code must be explicit; magic is forbidden."
    - 'DO NOT extract code into shared functions/utils unless it is repeated at least 3 times (Rule of Three).'
    - 'DO NOT mutate state. Use const, readonly, and spread operators for immutability.'
    - 'DO NOT create side effects in business logic functions. Keep them pure.'
  guidelines:
    - 'Favor readability over complexity (Simple Made Easy).'
    - 'Prefer duplication over the wrong abstraction (WET > DRY).'
    - 'For complex business logic, write the failing test case FIRST (TDD).'
    - 'Apply Functional Core / Imperative Shell: keep business logic as pure functions, keep services as thin orchestrators.'
    - 'Use const/final and spread operators (...) for all data transformations.'
  decision_table:
    - when: 'Business logic needs to be implemented'
      then: 'Write a failing test first, then implement as a pure function'
      avoid: 'Writing implementation before tests, or mixing I/O with business logic'
    - when: 'Similar code appears in 2 places'
      then: 'Keep both copies as-is (WET)'
      avoid: 'Premature extraction into a shared utility'
    - when: 'Similar code appears in 3+ places'
      then: 'Extract into a shared function with a clear, descriptive name'
```

### Step 4: 데이터 검증 테스트 작성

`packages/compiler/src/schemas/__tests__/rule-data.test.ts` — 3개 YAML 파일이 RuleSchema를 통과하는지 검증.

- 기존 테스트 패턴 참조: `rule.schema.test.ts`
- `yaml` 패키지로 파싱 → `RuleSchema.parse()` 검증
- 모든 rule id 유일성 검증
- `yaml` 패키지는 이미 `dependencies`에 있음 (`"yaml": "^2.7.0"`)

### Step 5: 검증 실행

```bash
cd packages/compiler && npx vitest run   # 테스트 통과
npx tsc --noEmit                         # 타입 검사
```

---

## Priority 전략 (향후 2-B 시리즈 기준점)

| Rule                 | Priority | 이유              |
| -------------------- | -------- | ----------------- |
| role-persona         | 90       | AI 정체성. 최상단 |
| communication        | 85       | 출력 형식/언어    |
| code-philosophy      | 80       | 코드 판단 기준    |
| (향후) typescript 등 | 60-70    | 기술 특화         |

## Category 컨벤션 (향후 2-B 시리즈 기준점)

`persona` / `communication` / `philosophy` / `convention` / `language` / `framework`

---

## 수정 대상 파일

| 파일                                                        | 작업          |
| ----------------------------------------------------------- | ------------- |
| `packages/compiler/data/rules/role-persona.yaml`            | **새로 생성** |
| `packages/compiler/data/rules/communication.yaml`           | **새로 생성** |
| `packages/compiler/data/rules/code-philosophy.yaml`         | **새로 생성** |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **새로 생성** |

## 참조 파일 (수정 없음)

- `packages/compiler/src/schemas/rule.schema.ts` — Zod 스키마 정의
- `packages/compiler/src/schemas/__tests__/rule.schema.test.ts` — 테스트 패턴 참조
- `.claude/rules/general.md` — 변환 원본
