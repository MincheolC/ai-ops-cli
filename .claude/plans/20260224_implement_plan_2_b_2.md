# Phase 2-B-2: coding-convention.md & typescript.md → Rule YAML 변환

## Context

Phase 2-B-1에서 `general.md`를 3개 Rule YAML로 변환 완료. 남은 원본 2개(`coding-convention.md`, `typescript.md`)를 변환한다.
`typescript.md`에 React 규칙이 섞여있으므로 framework별 분리 원칙을 확립하여 별도 파일로 분리한다.

---

## 설계 결정

| 결정                          | 선택                               | 이유                                                             |
| ----------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| React 규칙                    | `react-typescript.yaml`로 분리     | framework별 분리 원칙 확립. 비-React TS 프로젝트에서 노이즈 제거 |
| `coding-convention.md`        | `naming-convention.yaml` 단독 파일 | language-agnostic 컨벤션. 향후 추가 네이밍 규칙 수용 가능        |
| `*.logic.ts`/`*.util.ts` 패턴 | `typescript.yaml`에 포함           | 2-B-1에서 "언어별 rule로 이동" 결정됨                            |

---

## 원본 평가 & 개선

| 원본                                | 개선                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `as` 최소화 (모호)                  | constraint: `as` 금지 + decision_table: 허용 케이스 명시 (Zod `.parse()` 결과 등) |
| `.then()` 지양 (모호)               | constraint로 격상: `.then()` 금지, `async/await` 사용                             |
| `readonly` array props (React 특화) | `react-typescript.yaml`로 이동                                                    |

---

## 파일 구조

```
packages/compiler/data/rules/
├── (기존 3개)
├── naming-convention.yaml       # category: convention,  priority: 75
├── typescript.yaml              # category: language,    priority: 65
└── react-typescript.yaml        # category: framework,   priority: 60
```

---

## 구현 순서

### Step 1: `naming-convention.yaml`

```yaml
id: naming-convention
category: convention
tags:
  - general
  - naming
priority: 75
content:
  constraints: []
  guidelines:
    - 'Use kebab-case for directory names.'
```

### Step 2: `typescript.yaml`

```yaml
id: typescript
category: language
tags:
  - typescript
priority: 65
content:
  constraints:
    - 'DO NOT use interface. Use type only.'
    - 'DO NOT use enum. Use as const objects instead.'
    - 'DO NOT use any. Use unknown with type narrowing (Zod / type guards).'
    - 'DO NOT use non-null assertion (!). Use optional chaining (?.) and nullish coalescing (??) instead.'
    - 'DO NOT use .then() chains. Use async/await.'
    - 'DO NOT throw raw strings. Use throw new Error(...) only. Type catch errors as unknown and narrow.'
  guidelines:
    - 'Use arrow functions only. Explicitly annotate return types for exported functions.'
    - 'Use import type { ... } for type-only imports. Use absolute paths (@/...) only.'
    - 'Use as const for static configuration objects.'
    - 'Separate business logic into *.logic.ts files (pure functions). Keep stateless helpers in *.util.ts files (parsers, formatters).'
  decision_table:
    - when: 'Type assertion (as) seems necessary'
      then: 'Prefer Zod .parse() or type guards to narrow the type safely'
      avoid: 'Using as to bypass the type system without runtime validation'
```

### Step 3: `react-typescript.yaml`

```yaml
id: react-typescript
category: framework
tags:
  - typescript
  - react
priority: 60
content:
  constraints:
    - 'DO NOT use React.FC or FC. Type props directly and destructure them.'
  guidelines:
    - 'Use readonly for array and object props.'
```

### Step 4: 테스트 업데이트

`packages/compiler/src/schemas/__tests__/rule-data.test.ts` 수정:

- `ruleFiles` 배열에 3개 YAML 추가
- priority 순서 테스트를 전체 내림차순 검증으로 일반화

### Step 5: 검증

```bash
cd packages/compiler && npx vitest run && npx tsc --noEmit
```

---

## 수정 대상 파일

| 파일                                                        | 작업                    |
| ----------------------------------------------------------- | ----------------------- |
| `packages/compiler/data/rules/naming-convention.yaml`       | **새로 생성**           |
| `packages/compiler/data/rules/typescript.yaml`              | **새로 생성**           |
| `packages/compiler/data/rules/react-typescript.yaml`        | **새로 생성**           |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts` | **수정** — 새 YAML 추가 |

## 참조 파일 (수정 없음)

- `packages/compiler/src/schemas/rule.schema.ts`
- `.claude/rules/coding-convention.md` — 변환 원본
- `.claude/rules/typescript.md` — 변환 원본
