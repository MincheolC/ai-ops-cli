# Changelog

All notable changes to `ai-ops-cli` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

- `docs(rules)`: `plan-mode` 규칙 개선 — 플랜 파일 저장 시 `YYYYMMDD_<topic>.md` 네이밍 컨벤션 추가(Decision Table); Constraints 섹션 제거 후 다이어그램 타입 규칙을 Guidelines 인라인으로 흡수; 중복 항목 3곳 → 1곳으로 정리

## [0.1.22] - 2026-03-08

- `fix`: gemini root 파일 위치를 `.gemini/GEMINI.md`에서 루트 `GEMINI.md`로 변경 — 단일레포·모노레포 모두 동일하게 적용. `tool-output.ts`의 `gemini.dir`을 `''`으로 수정하여 `buildInstallPlan`·`inferInstalledFiles` 자동 반영

## [0.1.21] - 2026-03-08

- `refactor`: 단일 프로젝트에서 codex/gemini 룰을 단일 파일로 통합 — `renderForTool`이 단일 프로젝트 분기 시 global+domain을 `partitionRules` 없이 `rootContent` 하나로 합치고 `domainFiles: []`를 반환. codex는 `AGENTS.md`, gemini는 `.gemini/GEMINI.md` 하나만 생성됨

## [0.1.20] - 2026-03-08

- `refactor`: `update` 커맨드의 모노레포 분기에서 codex/gemini별 우회 로직 제거 — 모든 toolId가 `renderForTool → buildInstallPlan → installFiles` 파이프라인을 사용하도록 통합. codex 모노레포 update 시 Plan Snapshot 섹션 누락 버그 수정

## [0.1.19] - 2026-03-08

- `refactor`: codex/gemini 모노레포 설치를 `buildInstallPlan` 파이프라인으로 통합 — `installHierarchicalMonorepo`, `installClaudeCodeMonorepo` 제거. `renderForTool`이 `workspaceMappings`를 받아 workspace별 `domainFiles[]`를 생성하고, `buildInstallPlan`이 이를 순회하여 파일을 생성함으로써 모든 도구가 동일한 파이프라인을 사용

## [0.1.18] - 2026-03-08

### Fixed

- `uninstall`: `.prettierignore` ai-ops 섹션이 `manifest.settings.prettierignore` 필드 없이도 항상 제거되도록 수정 (이전 버전 manifest 호환성 포함)
- `install-plan`: global 룰이 없어 `rootContent`가 비어 있어도 Codex 루트 `AGENTS.md`에 Plan Snapshot 섹션이 항상 포함되도록 수정

## [0.1.17] - 2026-03-08

- fix(core): sort rules by priority in `loadAllRules` so init and update produce consistent ordering
- fix(core): add `prettierignore` field to `buildManifest` settings type
- fix(core): update Codex plan section wording to scope plan-saving to Plan mode only

## [0.1.16] - 2026-03-08

### Added

- `.prettierignore` installer — prompts during `init` and regenerates on `update`
- Mermaid diagram quote rule added to `plan-mode` rule YAML

### Fixed

- Marker system unified to `<!-- ai-ops:start -->` / `<!-- ai-ops:end -->` sections across all tools
- Uninstall bugs resolved (section removal, file path mismatches)

## [0.1.15] - 2026-03-08

### Added

- CLI version change detection on `update` — triggers re-install when CLI is upgraded

## [0.1.14] - 2026-03-08

### Added

- Settings regeneration on `update` — Claude and Gemini settings are re-applied automatically
- Claude settings installer with multiselect prompt

## [0.1.13] - 2026-03-06

### Changed

- ESLint flat config refinement

## [0.1.12] - 2026-03-06

### Added

- GraphQL rules split by preset runtime (`frontend-web`, `frontend-app`, `backend-ts`)

## [0.1.11] - 2026-03-03

### Added

- npm repository metadata for correct registry linking

### Changed

- Root README added; managed rule artifacts documented

### Fixed

- Non-null assertion removed in update command

## [0.1.10] - 2026-03-03

### Changed

- Compiler core inlined into CLI package; only `ai-ops-cli` is published going forward

## [0.1.9] - 2026-03-03

### Removed

- Global scope support dropped in favour of project-scoped installs only

## [0.1.8] - 2026-03-03

### Added

- Append mode for non-managed files (section injected, existing content preserved)

## [0.1.7] - 2026-03-03

### Fixed

- Codex: install `AGENTS.md` at project root instead of `.codex/`

## [0.1.6] - 2026-02-28

### Added

- `uninstall` command
- `plan-mode` rule (Mermaid diagramming convention)
- Codex `AGENTS.md` auto-includes plan snapshot section
- Gemini `settings.json` optional installer during `init`

### Fixed

- Rules data quality — error schema unified, priority conflicts resolved

## [0.1.5] - 2026-02-28

### Fixed

- Workspace domain file paths no longer include `.codex`/`.gemini` directory prefix

## [0.1.4] - 2026-02-28

### Changed

- Claude Code monorepo strategy switched to workspace-level `CLAUDE.md` lazy loading

## [0.1.3] - 2026-02-28

### Fixed

- Correct install paths and workspace glob scoping for multi-tool monorepo

## [0.1.2] - 2026-02-28

### Changed

- Packages renamed to unscoped names; workspace detection improved

## [0.1.1] - 2026-02-28

### Added

- Initial publish script with version bump support
