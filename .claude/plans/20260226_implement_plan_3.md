# Phase 3: Core Generator & Scaffolder (Rule-only MVP)

## Context

Phase 2까지 Zod 스키마 3종(Rule, Preset, Manifest)과 Rule YAML 23개, presets.yaml이 완성되었다.
Phase 3에서는 이 데이터를 실제로 로드·렌더링·해싱하는 핵심 로직을 구현한다.
CLI(Phase 5)가 소비할 순수 함수 라이브러리를 만드는 것이 목표이며, 파일 I/O는 최소한의 thin wrapper로 분리한다.

---

## 파일 구조

Flat 구조 채택 (모듈당 1파일, "Simple Made Easy" 원칙).

```
packages/compiler/src/
  schemas/              (기존 유지)
  loader.ts             ← 3-1
  renderer.ts           ← 3-2
  source-hash.ts        ← 3-3
  tool-output.ts        ← 3-2 (설정 객체)
  __tests__/
    loader.test.ts
    renderer.test.ts
    source-hash.test.ts
  index.ts              ← 3-4 (barrel 확장)
```

---

## Step 3-1. `loader.ts` — Rule/Preset 로더 & 정렬

**의존**: `yaml`, `node:fs`, `node:path`, `./schemas/index.js`

### Pure Functions

```ts
// priority 내림차순 정렬 (높을수록 상단 → U-shaped attention)
sortRulesByPriority(rules: readonly Rule[]): Rule[]

// presets.yaml의 Record<id, {description, rules}> → Preset[] 변환
parseRawPresets(raw: Record<string, { description: string; rules: string[] }>): Preset[]

// preset.rules ID 목록으로 allRules에서 필터링 + priority 정렬, 누락 시 throw
resolvePresetRules(preset: Preset, allRules: readonly Rule[]): Rule[]
```

### I/O Wrappers

```ts
loadRuleFile(filePath: string): Rule
loadAllRules(rulesDir: string): Rule[]       // readdirSync + .yaml 필터 + sort
loadPresets(presetsPath: string): Preset[]
```

### 테스트 (`__tests__/loader.test.ts`)

| 케이스                                        | 분류 |
| --------------------------------------------- | ---- |
| sortRulesByPriority: 90,50,70 → 90,70,50      | Pure |
| sortRulesByPriority: 빈 배열 → []             | Pure |
| sortRulesByPriority: 원본 불변 확인           | Pure |
| parseRawPresets: key→id inject + Zod 통과     | Pure |
| parseRawPresets: description 누락 시 ZodError | Pure |
| resolvePresetRules: 정상 매칭 + priority 정렬 | Pure |
| resolvePresetRules: missing rule → Error      | Pure |
| loadAllRules: 실제 data/rules/ 23개 로드      | I/O  |
| loadPresets: 실제 data/presets.yaml 4개 로드  | I/O  |

---

## Step 3-2a. `tool-output.ts` — AI 도구별 출력 설정

참조 문서 기반 경로 (`data/references/`):

- **claude-code**: `.claude/rules/{id}.md` (multi-file, 규칙당 1파일)
- **codex**: `AGENTS.md` (single-file, 프로젝트 루트)
- **gemini**: `GEMINI.md` (single-file, 프로젝트 루트)

```ts
export const TOOL_OUTPUT_MAP = {
  'claude-code': {
    mode: 'multi-file' as const,
    rulesDir: '.claude/rules',
    fileExtension: '.md',
  },
  codex: {
    mode: 'single-file' as const,
    fileName: 'AGENTS.md',
  },
  gemini: {
    mode: 'single-file' as const,
    fileName: 'GEMINI.md',
  },
} as const;

export type ToolId = keyof typeof TOOL_OUTPUT_MAP;
```

> Cursor는 Phase 2-C 참조 문서 미작성, TUI 플로우 대상 외이므로 MVP에서 제외.
> scope별(project/global) 경로 resolve는 CLI(Phase 5)에서 처리.

테스트 불필요 (정적 상수).

---

## Step 3-2b. `renderer.ts` — Rule → Markdown 렌더러

**모든 함수 Pure**. 의존: `./schemas/index.js` (Rule, DecisionTableEntry 타입)

### Functions

```ts
// "react-typescript" → "React Typescript"
ruleIdToTitle(id: string): string

// DecisionTableEntry[] → Markdown 테이블 (pipe 문자 &#124; escape)
renderDecisionTable(entries: readonly DecisionTableEntry[]): string

// 단일 Rule → Markdown (빈 섹션 생략)
renderRuleToMarkdown(rule: Rule): string

// Rule[] → 단일 Markdown (--- separator, single-file 모드용)
renderRulesToMarkdown(rules: readonly Rule[]): string
```

### 렌더링 포맷

```markdown
# React Typescript

## Constraints

- DO NOT use React.FC/FC...

## Guidelines

- Props 직접 타이핑 + destructure...

## Decision Table

| When | Then | Avoid |
| ---- | ---- | ----- |
| ...  | ...  | ...   |
```

- constraints/guidelines 빈 배열이면 해당 섹션 생략 (토큰 절약)
- decision_table 없으면 Decision Table 섹션 생략
- pipe 문자(`|`) → `&#124;`로 escape

### 테스트 (`__tests__/renderer.test.ts`)

| 케이스                                                                     |
| -------------------------------------------------------------------------- |
| ruleIdToTitle: kebab-case 변환                                             |
| ruleIdToTitle: 단일 단어                                                   |
| renderDecisionTable: 기본 3열 테이블                                       |
| renderDecisionTable: avoid 생략 엔트리                                     |
| renderDecisionTable: pipe 문자 escape                                      |
| renderRuleToMarkdown: 전체 필드(constraints + guidelines + decision_table) |
| renderRuleToMarkdown: decision_table 없음 → 해당 섹션 미출력               |
| renderRulesToMarkdown: 복수 규칙 → `---` separator                         |
| renderRulesToMarkdown: 단일 규칙 → separator 없음                          |
| Snapshot: 실제 typescript.yaml 로드 후 렌더링 결과 snapshot                |

---

## Step 3-3. `source-hash.ts` — sourceHash 계산 & Manifest 빌더

**의존**: `node:crypto`, `node:fs`, `node:path`, `./schemas/index.js`

### Pure Function

```ts
// 문자열 배열 → SHA-256 → 6-hex (caller가 정렬 책임)
computeHash(contents: readonly string[]): string
```

### I/O Wrapper

```ts
// rulesDir 내 YAML 파일들을 alphabetical 정렬 후 해싱
computeSourceHash(rulesDir: string): string
```

### Manifest Builder (Pure, 단 generatedAt에 현재 시각 사용)

```ts
buildManifest(params: {
  tools: readonly string[];
  scope: 'project' | 'global';
  preset?: string;
  installedRules: readonly string[];
  sourceHash: string;
}): Manifest
```

- `new Date().toISOString()` → ManifestSchema의 `datetime({ offset: true })` 통과
- 테스트 시 `vi.useFakeTimers()`로 시간 고정

### 테스트 (`__tests__/source-hash.test.ts`)

| 케이스                                                      |
| ----------------------------------------------------------- |
| computeHash: 동일 입력 → 동일 출력 (determinism)            |
| computeHash: 6자리 hex 정규식 매칭                          |
| computeHash: 순서 다르면 다른 해시                          |
| computeHash: 빈 배열 → 유효 해시                            |
| computeSourceHash: 실제 data/rules/ 대상 2회 호출 동일 결과 |
| buildManifest: 정상 생성, ManifestSchema 통과               |
| buildManifest: preset 생략 시 optional 처리                 |

---

## Step 3-4. `index.ts` — Barrel Export 확장

```ts
export * from './schemas/index.js';
export * from './loader.js';
export * from './renderer.js';
export * from './source-hash.js';
export * from './tool-output.js';
```

---

## 구현 순서

1. `tool-output.ts` — 의존 없음, 정적 설정
2. `loader.ts` + `__tests__/loader.test.ts` — schemas만 의존, TDD
3. `renderer.ts` + `__tests__/renderer.test.ts` — schemas 타입 의존, TDD + snapshot
4. `source-hash.ts` + `__tests__/source-hash.test.ts` — crypto + schemas, TDD
5. `index.ts` barrel 업데이트
6. `npm run build && npm run test` 전체 통과 확인

---

## Verification

```bash
cd packages/compiler
npx vitest run src/__tests__    # Phase 3 테스트
npx vitest run src/schemas      # 기존 스키마 테스트 (regression)
npx vitest run                  # 전체
npm run build                   # tsup ESM 빌드 성공
```
