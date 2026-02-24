# Phase 2-A: Zod 스키마 정의 & 테스트

## Context

Phase 1(ESM 마이그레이션 & 모노레포 구조화) 완료 후, 컴파일러의 입출력 계약을 확정하는 단계.
`packages/compiler/src/schemas/` 디렉토리가 비어있는 상태에서 Rule/Profile/Manifest Zod 스키마를 정의하고 테스트한다.
이 스키마들은 Phase 3(컴파일러 로직)의 모든 함수 시그니처의 기반이 된다.

---

## 파일 구조

```
packages/compiler/
├── vitest.config.ts                          # vitest 설정
├── src/
│   ├── index.ts                              # 패키지 엔트리포인트
│   └── schemas/
│       ├── rule.schema.ts                    # Rule YAML 스키마
│       ├── profile.schema.ts                 # Profile YAML 스키마
│       ├── manifest.schema.ts                # Manifest JSON 스키마
│       ├── index.ts                          # barrel export
│       └── __tests__/
│           ├── rule.schema.test.ts
│           ├── profile.schema.test.ts
│           └── manifest.schema.test.ts
```

---

## 구현 순서

### Step 1: vitest.config.ts

`packages/compiler/vitest.config.ts` 생성. `@/*` alias 설정 포함.

```ts
// globals: false — explicit import 사용
// include: src/**/__tests__/**/*.test.ts
// resolve.alias: '@' → './src'
```

### Step 2: rule.schema.ts + 테스트

**`packages/compiler/src/schemas/rule.schema.ts`**

| 필드                     | Zod 타입                                 | 비고                         |
| ------------------------ | ---------------------------------------- | ---------------------------- |
| `id`                     | `z.string().regex(kebabCase)`            | `/^[a-z0-9]+(-[a-z0-9]+)*$/` |
| `category`               | `z.string().min(1)`                      | enum 제한 없음 (자유 정의)   |
| `tags`                   | `z.array(z.string().min(1))`             |                              |
| `priority`               | `z.number().int().min(0).max(100)`       |                              |
| `content.constraints`    | `z.array(z.string().min(1))`             | 빈 배열 허용                 |
| `content.guidelines`     | `z.array(z.string().min(1))`             | 빈 배열 허용                 |
| `content.decision_table` | optional array of `{when, then, avoid?}` |                              |

- 모든 object는 `.object({...}).strict()` — 미지원 필드 유입 방지
- Export: `RuleSchema`, `RuleContentSchema`, `DecisionTableEntrySchema` + 각 inferred type

**테스트 케이스:**

- Valid: 전체 필드, decision_table 생략, avoid 생략, priority 경계값(0, 100)
- Invalid: non-kebab id, priority 범위 초과/소수점/string, 필수 필드 누락, 빈 문자열, unknown 필드

### Step 3: profile.schema.ts + 테스트

**`packages/compiler/src/schemas/profile.schema.ts`**

| 필드                      | Zod 타입                                           | 비고           |
| ------------------------- | -------------------------------------------------- | -------------- |
| `id`                      | `z.string().min(1)`                                |                |
| `output.format`           | `z.enum(['markdown'])`                             | 추후 확장 가능 |
| `output.files`            | `z.array(OutputFileSchema).min(1)`                 | 최소 1개       |
| `output.files[].path`     | `z.string().min(1)`                                |                |
| `output.files[].sections` | optional `z.array(z.string().min(1))`              |                |
| `output.files[].split_by` | optional `z.string().min(1)`                       |                |
| `include_rules`           | `z.array(z.string().min(1)).min(1)`                | 최소 1개 필수  |
| `quality_gate`            | optional `{enabled: boolean, checklist: string[]}` |                |

- Export: `ProfileSchema`, `OutputFileSchema`, `QualityGateSchema` + types

**테스트 케이스:**

- Valid: 전체 필드, quality_gate 생략, sections/split_by 혼합
- Invalid: 미지원 format, files 빈 배열, include_rules 빈 배열, 필수 필드 누락

### Step 4: manifest.schema.ts + 테스트

**`packages/compiler/src/schemas/manifest.schema.ts`**

| 필드            | Zod 타입                            | 비고             |
| --------------- | ----------------------------------- | ---------------- |
| `profile`       | `z.string().min(1)`                 |                  |
| `scope`         | `z.enum(['project', 'global'])`     |                  |
| `include_rules` | `z.array(z.string().min(1))`        |                  |
| `sourceHash`    | `z.string().regex(/^[a-f0-9]{6}$/)` | 소문자 hex 6자리 |
| `generatedAt`   | `z.string().datetime()`             | ISO 8601         |

- `SCOPES` as const 객체도 export (다른 코드에서 참조용)
- Export: `ManifestSchema`, `SCOPES` + `Manifest` type

**테스트 케이스:**

- Valid: project/global scope, UTC/offset datetime
- Invalid: 미지원 scope, hash 길이/대문자, 비ISO datetime, 필수 필드 누락

### Step 5: barrel export

- `src/schemas/index.ts` — 모든 스키마/타입 re-export
- `src/index.ts` — `export * from './schemas/index.js'`
- ESM import 경로에 `.js` 확장자 사용 (`module: NodeNext` 요구사항)

### Step 6: 검증

```bash
cd packages/compiler
npx vitest run          # 테스트 통과
npx tsc --noEmit        # 타입 검사
npm run build           # tsup 빌드 → dist/index.js, dist/index.d.ts
```

---

## 주석 가이드라인

각 스키마 파일에 JSDoc 스타일 주석을 포함한다:

1. **파일 상단**: 스키마가 표현하는 도메인 개념 설명
   - `rule.schema.ts`: "Rule = SSOT의 최소 지식 단위. 하나의 코딩 컨벤션/아키텍처 규칙을 YAML로 구조화한 것."
   - `profile.schema.ts`: "Profile = AI 에이전트별 출력 설정. 어떤 규칙을 어떤 포맷/파일로 생성할지 정의."
   - `manifest.schema.ts`: "Manifest = 설치 추적 메타데이터. CLI가 이전 설치 상태를 기억하기 위한 JSON."

2. **각 필드 인라인 주석**: 의미가 자명하지 않은 필드에 `/** ... */` 주석
   - `priority`: "0-100. 높을수록 생성 파일 상단 배치 (U-shaped attention 최적화)"
   - `constraints`: "Anti-pattern 규칙 ('하지 마라'). guidelines보다 항상 상단 렌더링"
   - `guidelines`: "Positive 규칙 ('해라')"
   - `decision_table`: "조건부 규칙. when→then→avoid 구조"
   - `split_by`: "이 필드 기준으로 규칙을 별도 파일로 분할 (e.g., category별 .md 파일)"
   - `sections`: "단일 파일 내 포함할 섹션 목록"
   - `sourceHash`: "SSOT 데이터 파일들의 deterministic SHA-256 해시 (6자리 hex). diff/update 판단 기준"
   - `quality_gate`: "생성 파일 하단에 삽입되는 self-check 체크리스트"

3. **주석 원칙**: 코드만으로 명확한 필드(`id`, `tags`, `path` 등)에는 주석 생략

---

## 설계 결정 요약

| 결정             | 선택                      | 이유                                 |
| ---------------- | ------------------------- | ------------------------------------ |
| strict object    | `.object().strict()`      | YAML 오타 즉시 감지                  |
| transform/brand  | 미사용                    | 스키마는 검증만. 변환은 Phase 3      |
| test globals     | `false` (explicit import) | Simple Made Easy                     |
| import 경로      | `.js` 확장자              | NodeNext ESM 호환                    |
| category enum    | 미제한 (string)           | 사용자가 자유 정의                   |
| cross-validation | Phase 3으로 위임          | include_rules↔rule.id 참조 무결성 등 |
| 테스트 위치      | `__tests__/` co-located   | barrel export에 test 파일 혼입 방지  |
