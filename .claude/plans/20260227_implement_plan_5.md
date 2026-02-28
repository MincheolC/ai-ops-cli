# Phase 5: CLI 구현 (Rule TUI MVP)

## Context

Phase 1-4에서 compiler 패키지가 완성됨: YAML 로딩 → 렌더링 → install plan → diff/manifest.
Phase 5는 `apps/cli/`에 Commander + @clack/prompts 기반 CLI를 구현하여 `ai-ops init/update/diff` 커맨드를 제공한다.
현재 `apps/cli/`는 package.json, tsconfig, tsup 설정만 있고 소스 코드는 비어 있음.

### 설계 결정 (확정)

- **5-D1**: Global rule → 잠금 (fine-tune에서 제외 불가, `p.note()`로 표시)
- **5-D2**: claude-code는 모든 workspace rules 합산 → `.claude/rules/`에 1회 설치. codex/gemini는 global 루트 + domain 워크스페이스별 분리
- **5-D3**: 빈 domainContent → FileAction 생략 (기존 `buildInstallPlan`에서 처리됨)
- **5-D4**: Manifest 스키마 확장 — `workspaces` 필드 추가로 모노레포 워크스페이스별 preset/rules 추적

---

## 변경 대상 파일

### compiler 스키마 변경 (5-D4)

| 파일                                                              | 변경                                         |
| ----------------------------------------------------------------- | -------------------------------------------- |
| `packages/compiler/src/schemas/manifest.schema.ts`                | `workspaces` optional 필드 추가              |
| `packages/compiler/src/source-hash.ts`                            | `buildManifest` 파라미터에 `workspaces` 추가 |
| `packages/compiler/src/schemas/__tests__/manifest.schema.test.ts` | workspaces 관련 테스트 추가                  |
| `packages/compiler/src/__tests__/source-hash.test.ts`             | buildManifest workspaces 테스트 추가         |

### CLI 신규 파일

| 파일                                     | 역할                                      |
| ---------------------------------------- | ----------------------------------------- |
| `apps/cli/src/bin/index.ts`              | Commander 엔트리포인트 (init/update/diff) |
| `apps/cli/src/commands/init.ts`          | TUI 플로우 오케스트레이션                 |
| `apps/cli/src/commands/update.ts`        | manifest 기반 재설치                      |
| `apps/cli/src/commands/diff.ts`          | 변경 사항 표시                            |
| `apps/cli/src/lib/paths.ts`              | scope 라우팅 + compiler data/ 경로 해석   |
| `apps/cli/src/lib/workspace.ts`          | 모노레포 워크스페이스 후보 탐색           |
| `apps/cli/src/lib/install.ts`            | FileAction[] → fs write + 충돌 감지       |
| `apps/cli/src/__tests__/paths.test.ts`   | 경로 해석 테스트                          |
| `apps/cli/src/__tests__/install.test.ts` | 파일 쓰기 + 충돌 테스트                   |
| `apps/cli/tsup.config.ts`                | external 설정 추가                        |

---

## Step 0. Manifest 스키마 확장

`packages/compiler/src/schemas/manifest.schema.ts`:

```ts
const WorkspaceEntrySchema = z.object({
  preset: z.string().min(1),
  rules: z.array(z.string().min(1)),
}).strict();

// ManifestSchema에 추가:
workspaces: z.record(z.string(), WorkspaceEntrySchema).optional(),
// 기존 preset 필드: 비모노레포용 유지
```

`packages/compiler/src/source-hash.ts` — `buildManifest` 파라미터에 `workspaces` 추가:

```ts
workspaces?: Record<string, { preset: string; rules: string[] }>;
```

`installed_rules`는 전체 deduplicated 목록으로 유지 (diff 호환).

---

## Step 1. tsup.config.ts 수정

```ts
external: ['@ai-ops/compiler', '@clack/prompts', 'commander'],
```

이유: `@ai-ops/compiler`를 번들에 포함시키면 `createRequire`로 `data/` 경로 resolve가 깨짐.

---

## Step 2. `lib/paths.ts`

```ts
// createRequire로 @ai-ops/compiler 패키지 루트의 data/ 해석
resolveCompilerDataDir(): string
resolveRulesDir(): string
resolvePresetsPath(): string

// scope → basePath
resolveBasePath(scope: Scope): string  // 'project' → cwd, 'global' → ~/.ai-ops/
```

---

## Step 3. `lib/workspace.ts`

```ts
// basePath 하위 2-depth 디렉토리 탐색 (node_modules, .git 등 제외)
// apps/web, services/api 같은 워크스페이스 후보 반환
listWorkspaceCandidates(basePath: string): string[]
```

---

## Step 4. `lib/install.ts`

```ts
type InstallResult = { written: string[]; skipped: string[] };

// FileAction[] → 실제 파일 쓰기
// 기존 파일이 managed가 아닌 경우 skip (사용자 파일 보호)
installFiles(basePath: string, actions: readonly FileAction[]): InstallResult
```

---

## Step 5. `commands/init.ts`

### TUI 플로우

```
1. intro()
2. AI 도구 다중 선택 (claude-code, codex, gemini)
3. 모노레포 여부 confirm
4-a. [No] 루트(.) preset 선택
4-b. [Yes] 워크스페이스 다중 선택 → 워크스페이스별 preset 선택
5. 규칙 세부조정 (워크스페이스별):
   - global rules → p.note()로 잠금 표시
   - domain rules → multiselect (initialValues=전체, 해제로 제외)
6. spinner → 도구별 설치
7. manifest 저장 (workspaces 필드 포함)
8. 결과 요약 + outro()
```

### 도구별 설치 전략

**단일 프로젝트** (비모노레포):

```
renderForTool(toolId, finalRules) → buildInstallPlan → installFiles
```

**모노레포 — claude-code** (path-scoped):

```
모든 workspace의 rules 합산 + deduplicate
→ renderForTool('claude-code', allRules) → buildInstallPlan → installFiles
```

Claude Code는 paths frontmatter로 스코핑하므로 프로젝트 루트 `.claude/rules/`에 한 벌만 설치.

**모노레포 — codex/gemini** (hierarchical):

```
partitionRules(allRules) → global만 추출 (deduplicate)
→ renderRulesToMarkdown(global) → wrapWithHeader → 루트 AGENTS.md/GEMINI.md

워크스페이스별:
  partitionRules(workspaceRules) → domain만 추출
  → renderRulesToMarkdown(domain) → wrapWithHeader
  → {workspace}/AGENTS.override.md 또는 {workspace}/GEMINI.md
```

### 주요 헬퍼 함수

```ts
// preset 선택 + fine-tune (워크스페이스 1개 단위)
selectPresetAndFineTune(workspaceName, presets, allRules): WorkspacePresetMapping | null

// Rule[] 중복 제거 (id 기준)
deduplicateRules(rules: readonly Rule[]): Rule[]

// codex/gemini 모노레포 설치
installHierarchicalMonorepo(toolId, mappings, basePath, meta): void

// claude-code 모노레포 설치
installClaudeCodeMonorepo(mappings, basePath, meta): void
```

---

## Step 6. `commands/update.ts`

```
1. manifest 읽기 (없으면 에러)
2. 현재 sourceHash 계산
3. computeDiff → up-to-date이면 종료 (--force 시 무시)
4. manifest.installed_rules 기반 Rule[] 필터링
5. 모노레포(manifest.workspaces 존재)이면:
   - 워크스페이스별 rules 재구성
   - 도구별 설치 (init과 동일 로직)
6. 비모노레포:
   - renderForTool → buildInstallPlan → installFiles
7. manifest 갱신
```

---

## Step 7. `commands/diff.ts`

```
1. manifest 읽기
2. 현재 sourceHash 계산
3. computeDiff 호출
4. 결과 출력 (up-to-date / sourceChanged / added / removed)
```

---

## Step 8. `bin/index.ts`

Commander 설정:

```
ai-ops init [--scope project|global]
ai-ops update [--scope project|global] [--force]
ai-ops diff [--scope project|global]
```

---

## Step 9. 테스트

### paths.test.ts

- `resolveCompilerDataDir()` → 실제 `data/rules/` 포함 경로
- `resolveBasePath('project')` → `process.cwd()`
- `resolveBasePath('global')` → `~/.ai-ops/`

### install.test.ts

- tmp dir에 FileAction 쓰기 → 파일 생성 확인
- managed 파일 → 덮어쓰기 확인
- non-managed 파일 → `skipped`에 포함

### 수동 E2E

- `npm run build` → `npx ai-ops init` temp dir에서 실행
- 파일 생성 + manifest 확인

---

## 구현 순서

| Step | 파일                                                  | 의존     |
| ---- | ----------------------------------------------------- | -------- |
| 0    | `manifest.schema.ts` + `source-hash.ts` 수정 + 테스트 | -        |
| 1    | `tsup.config.ts` external 추가                        | -        |
| 2    | `lib/paths.ts` + 테스트                               | -        |
| 3    | `lib/workspace.ts`                                    | -        |
| 4    | `lib/install.ts` + 테스트                             | compiler |
| 5    | `commands/init.ts`                                    | 2, 3, 4  |
| 6    | `commands/update.ts`                                  | 2, 4     |
| 7    | `commands/diff.ts`                                    | 2        |
| 8    | `bin/index.ts`                                        | 5, 6, 7  |
| 9    | 빌드 + 수동 E2E                                       | 전체     |

---

## Verification

```bash
# compiler 스키마 변경 검증
cd packages/compiler && npx vitest run

# CLI 빌드
cd apps/cli && npm run build

# CLI 단위 테스트
cd apps/cli && npx vitest run

# 수동 E2E (temp dir)
cd /tmp && mkdir test-project && cd test-project && npx ai-ops init

# 전체 빌드
cd <root> && npm run build
```

---

## 사용할 기존 함수 (compiler)

| 함수                                                     | 파일                | 용도                                          |
| -------------------------------------------------------- | ------------------- | --------------------------------------------- |
| `loadAllRules` / `loadPresets`                           | `loader.ts`         | YAML 데이터 로딩                              |
| `resolvePresetRules` / `excludeRules`                    | `loader.ts`         | preset 해석 + fine-tune 제외                  |
| `isGlobalRule` / `partitionRules`                        | `renderer.ts`       | global/domain 분리 (잠금 표시, 모노레포 설치) |
| `renderForTool` / `renderRulesToMarkdown`                | `renderer.ts`       | 단일/모노레포 렌더링                          |
| `buildInstallPlan`                                       | `install-plan.ts`   | 단일 프로젝트 설치                            |
| `wrapWithHeader` / `isManagedFile`                       | `managed-header.ts` | 모노레포 수동 FileAction + 충돌 감지          |
| `computeSourceHash` / `buildManifest`                    | `source-hash.ts`    | 해시 + manifest 빌더                          |
| `readManifest` / `writeManifest` / `resolveManifestPath` | `manifest-io.ts`    | manifest I/O                                  |
| `computeDiff`                                            | `diff.ts`           | update/diff 커맨드                            |
