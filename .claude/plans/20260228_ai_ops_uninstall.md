# Plan: `ai-ops uninstall` 명령어 추가

## Context

현재 `init`, `update`, `diff` 명령어만 존재하고, 설치된 규칙 파일을 제거하는 방법이 없다. 사용자가 AI 도구 설정을 깔끔하게 롤백할 수 있도록 `uninstall` 명령어를 추가한다.

**핵심 문제**: 현재 manifest에는 `installed_rules` (rule ID 배열)만 있고, 실제 디스크에 쓰여진 파일 경로가 기록되지 않는다.

**해결 전략**: manifest에 `installed_files` optional 필드를 추가하고, install 시 실제 경로를 저장한다. 기존 manifest(필드 없음)에는 도구/규칙 정보로 경로를 역산하는 fallback을 제공한다.

## 변경 사항

### 1. Manifest 스키마에 `installed_files` 추가

**`packages/compiler/src/schemas/manifest.schema.ts`**

- `ManifestSchema`에 `installed_files: z.array(z.string().min(1)).optional()` 추가
- optional이므로 기존 manifest 파싱에 영향 없음 (`.strict()`은 선언된 optional 허용)

### 2. `buildManifest()`에 `installedFiles` 파라미터 추가

**`packages/compiler/src/source-hash.ts`**

- params에 `installedFiles?: readonly string[]` 추가
- manifest 객체에 `installed_files: params.installedFiles ? [...params.installedFiles] : undefined` 포함

### 3. `installed_files` 경로 역산 함수 (fallback)

**`packages/compiler/src/uninstall-plan.ts`** (신규)

```
inferInstalledFiles(manifest): string[]
```

manifest의 `tools`, `installed_rules`, `workspaces` 정보와 `TOOL_OUTPUT_MAP`을 기반으로 설치된 파일 경로를 역산하는 순수 함수:

- claude-code: `.claude/rules/{ruleId}.md`
- codex 비모노: `.codex/AGENTS.md`, `.codex/AGENTS.override.md`
- codex 모노: `.codex/AGENTS.md` + `{workspace}/AGENTS.override.md`
- gemini 비모노: `.gemini/GEMINI.md`
- gemini 모노: `.gemini/GEMINI.md` + `{workspace}/GEMINI.md`

compiler index.ts에서 export 추가.

### 4. `init.ts` — installed_files 수집

**`apps/cli/src/commands/init.ts`**

- `installClaudeCodeMonorepo`, `installHierarchicalMonorepo` 반환 타입을 `void` → `string[]` (written paths)로 변경
- 비모노레포 경로의 `result.written`도 수집
- gemini settings.json 설치 시 경로 추가 (`.gemini/settings.json`)
- `buildManifest()` 호출에 `installedFiles` 전달

### 5. `update.ts` — installed_files 수집

**`apps/cli/src/commands/update.ts`**

- 동일하게 `installFiles()` 반환값 수집 → `buildManifest()`에 `installedFiles` 전달

### 6. 파일 삭제 유틸

**`apps/cli/src/lib/uninstall.ts`** (신규)

```typescript
type UninstallResult = {
  deleted: string[];   // 삭제 성공
  skipped: string[];   // non-managed 파일 (보호)
  notFound: string[];  // 이미 삭제됨
};

removeFiles(basePath, relativePaths): UninstallResult
cleanEmptyDirs(basePath, dirs): string[]
```

- `isManagedFile()` 체크 후 managed 파일만 삭제
- non-managed 파일은 skip (사용자 파일 보호)
- 빈 디렉토리 정리: `.claude/rules/`, `.codex/`, `.gemini/` 등

### 7. uninstall 명령어

**`apps/cli/src/commands/uninstall.ts`** (신규)

```
ai-ops uninstall [--scope <project|global>]
```

흐름:

1. manifest 읽기 → 없으면 에러
2. 삭제 대상 결정: `manifest.installed_files ?? inferInstalledFiles(manifest)`
3. 삭제 대상 목록 출력
4. gemini settings.json 존재 시 별도 confirm (managed header 없으므로)
5. confirm → 파일 삭제 (managed 검증)
6. 빈 디렉토리 정리
7. manifest 파일 삭제
8. 결과 요약

### 8. CLI 등록

**`apps/cli/src/bin/index.ts`**

- `uninstall` 명령어 등록 (`--scope` 옵션)

### 9. 테스트

**`packages/compiler/src/__tests__/uninstall-plan.test.ts`** (신규)

- `inferInstalledFiles()`: claude-code/codex/gemini × 비모노/모노 조합

**`apps/cli/src/__tests__/uninstall.test.ts`** (신규)

- `removeFiles()`: managed 삭제, non-managed skip, 미존재 notFound
- `cleanEmptyDirs()`: 빈 디렉토리 삭제, 비어있지 않은 디렉토리 유지

**`apps/cli/src/__tests__/e2e.test.ts`** 확장

- init → uninstall → 파일/manifest 모두 제거 확인

**기존 테스트 업데이트**

- `manifest.schema.test.ts`: installed_files 유무 모두 파싱 성공 확인
- `loader.test.ts` / `source-hash.test.ts`: buildManifest에 installedFiles 전달 케이스

### 10. 스냅샷 갱신

스냅샷에 manifest 관련이 없으므로 영향 없을 것으로 예상. `npx vitest run -u`로 확인.

## 검증

1. `npx vitest run` — 전체 테스트 통과
2. `npm run build` — 빌드 성공
3. 수동 검증: `ai-ops init` → manifest에 `installed_files` 포함 확인 → `ai-ops uninstall` → 파일 삭제 확인
