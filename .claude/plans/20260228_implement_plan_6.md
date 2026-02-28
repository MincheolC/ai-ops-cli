# Phase 6: E2E 테스트 + 빌드/배포 파이프라인

## Context

Phase 5에서 CLI(init/update/diff) 구현이 완료되었으나 E2E 테스트가 빠졌고, 빌드/배포 인프라가 정비되지 않음.
Phase 6에서는 CLI E2E 테스트 + 루트 scripts 정비 + vitest workspace + GitHub Actions CI + npm publish 준비를 수행한다.

---

## 변경 대상 파일

| 파일                                 | 변경                                   |
| ------------------------------------ | -------------------------------------- |
| `apps/cli/src/__tests__/e2e.test.ts` | **신규** — CLI E2E 테스트 (subprocess) |
| `apps/cli/vitest.config.ts`          | **신규** — CLI vitest 설정             |
| `vitest.workspace.ts`                | **신규** — 루트 vitest workspace 설정  |
| `package.json`                       | 루트 scripts 정비 (lint 추가)          |
| `apps/cli/package.json`              | private 제거, publishConfig 추가       |
| `packages/compiler/package.json`     | publishConfig 확인/추가                |
| `.github/workflows/ci.yml`           | **신규** — GitHub Actions CI           |

---

## Step 0. CLI E2E 테스트

`apps/cli/src/__tests__/e2e.test.ts`:

subprocess 방식으로 실제 빌드된 CLI 바이너리를 temp dir에서 실행하여 검증.

### 전략

- `execFileSync`로 `node dist/bin/index.js` 실행 (빌드 필수 → beforeAll에서 확인)
- `@clack/prompts`는 interactive이므로 init은 직접 테스트 불가 → **compiler API를 직접 호출하는 통합 테스트**로 대체
- update/diff는 manifest 기반이므로 프로그래밍 방식으로 검증 가능

### E2E 테스트 케이스

```
1. 단일 프로젝트 설치 플로우:
   - loadAllRules → resolvePresetRules → renderForTool → buildInstallPlan → installFiles
   - 결과: .claude/rules/*.md, AGENTS.md, GEMINI.md 파일 생성 확인
   - manifest 저장 → readManifest → 내용 검증

2. 멱등성 검증:
   - 동일 인자로 2회 설치 → 파일 내용 동일, manifest 일치

3. update 플로우:
   - manifest 존재 → computeDiff → 재설치 → manifest 갱신
   - sourceHash 불일치 시 update 동작 확인

4. diff 플로우:
   - manifest 기반 computeDiff 호출 → DiffResult 검증

5. managed 파일 보호:
   - 사용자가 직접 작성한 파일 → installFiles가 skip
```

### 구현 방식

TUI(init)를 subprocess로 테스트하려면 stdin pipe가 필요하지만 `@clack/prompts`는 raw mode를 사용하여 자동화가 까다로움.
→ **통합 테스트**: init의 핵심 로직(compiler API 조합)을 직접 호출하여 E2E 범위를 커버.
→ bin entrypoint는 `--version`/`--help` 출력만 subprocess로 검증.

---

## Step 1. CLI vitest.config.ts

`apps/cli/vitest.config.ts` (현재 없음 — compiler 패턴 참조):

```ts
export default defineConfig({
  test: {
    globals: false,
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
```

---

## Step 2. vitest workspace

`vitest.workspace.ts` (루트):

```ts
export default ['packages/compiler', 'apps/cli'];
```

루트에서 `npx vitest run`으로 전체 테스트 실행 가능.

---

## Step 3. 루트 scripts 정비

`package.json`:

```diff
  "scripts": {
    "build": "npm run build --workspace=packages/compiler && npm run build --workspace=apps/cli",
-   "test": "npm run test --workspaces --if-present",
+   "test": "vitest run",
    "compile": "node packages/compiler/dist/index.js",
    "dev": "npm run dev --workspaces --if-present",
-   "format": "prettier --write \"**/*.{ts,json,yaml,md}\" --ignore-path .gitignore"
+   "format": "prettier --write \"**/*.{ts,json,yaml,md}\" --ignore-path .gitignore",
+   "lint": "eslint .",
+   "check": "npm run lint && npm run test"
  }
```

- `test`: vitest workspace 기반으로 전환 (단일 프로세스, 통합 리포트)
- `lint`: eslint 실행 (eslint.config.mjs 이미 존재)
- `check`: lint + test 한번에

---

## Step 4. npm publish 준비

### `apps/cli/package.json`

```diff
- "private": true,
+ "publishConfig": {
+   "access": "public"
+ },
+ "files": ["dist", "README.md"],
```

### `packages/compiler/package.json`

```diff
+ "publishConfig": {
+   "access": "public"
+ },
+ "files": ["dist", "data", "README.md"],
```

compiler는 `data/` 디렉토리(rules YAML + presets)를 반드시 포함해야 함.

---

## Step 5. GitHub Actions CI

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test
```

단일 job으로 lint → build → test 순차 실행 (build가 선행되어야 E2E 테스트 가능).

---

## 구현 순서

| Step | 파일                                       | 의존           |
| ---- | ------------------------------------------ | -------------- |
| 0    | `apps/cli/src/__tests__/e2e.test.ts`       | compiler build |
| 1    | `apps/cli/vitest.config.ts`                | -              |
| 2    | `vitest.workspace.ts`                      | Step 1         |
| 3    | `package.json` scripts 정비                | Step 2         |
| 4    | publish 준비 (cli + compiler package.json) | -              |
| 5    | `.github/workflows/ci.yml`                 | Step 3         |

---

## Verification

```bash
# Step 0-1: CLI 테스트
cd apps/cli && npx vitest run

# Step 2-3: 루트에서 전체 테스트
npx vitest run

# lint
npm run lint

# 빌드 + 전체 check
npm run build && npm run check

# publish dry run
cd apps/cli && npm pack --dry-run
cd packages/compiler && npm pack --dry-run
```

---

## 재사용 함수 (compiler)

| 함수                                                     | 파일                | E2E 용도        |
| -------------------------------------------------------- | ------------------- | --------------- |
| `loadAllRules` / `loadPresets`                           | `loader.ts`         | 데이터 로딩     |
| `resolvePresetRules` / `excludeRules`                    | `loader.ts`         | preset 해석     |
| `renderForTool`                                          | `renderer.ts`       | 도구별 렌더링   |
| `buildInstallPlan`                                       | `install-plan.ts`   | FileAction 생성 |
| `buildManifest` / `computeSourceHash`                    | `source-hash.ts`    | manifest 생성   |
| `readManifest` / `writeManifest` / `resolveManifestPath` | `manifest-io.ts`    | manifest I/O    |
| `computeDiff`                                            | `diff.ts`           | diff 검증       |
| `isManagedFile` / `wrapWithHeader`                       | `managed-header.ts` | 헤더 검증       |
| `COMPILER_DATA_DIR`                                      | `paths.ts`          | 데이터 경로     |

CLI 함수:
| 함수 | 파일 | E2E 용도 |
|------|------|----------|
| `installFiles` | `lib/install.ts` | 파일 설치 |
| `resolveRulesDir` / `resolvePresetsPath` | `lib/paths.ts` | 경로 해석 |
