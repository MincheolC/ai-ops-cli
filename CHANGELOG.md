# Changelog

All notable changes to `ai-ops-cli` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `feat(pc)`: add `ai-ops pc next` and `$pc:next` skill guidance so Codex can record an active workstream's next-priority snapshot without creating a `$pc:done` handoff.

## [1.7.3] - 2026-06-01

## [1.7.2] - 2026-06-01

### Fixed

- `fix(code-review-gate)`: `code-review-gate` now applies `AGENTS.md`, `docs/agent/rules/00-agent-baseline.md`, `docs/agent/workflow.md`, and related `Active` operating-layer documents as review judgment criteria while keeping those documents out of findings unless they are in scope. Maintainer docs now describe the single read-only reviewer model, target selection, context management, and review lenses in English and Korean.

## [1.7.1] - 2026-05-31

### Added

- `feat(pc)`: add `ai-ops pc done fill --apply` so `$pc:done` handoff fields can be supplied through the CLI instead of direct draft JSON patch edits.

### Fixed

- `fix(codex-permissions)`: `safe-local` no longer installs the removed `:project_roots` filesystem token and rewrites managed profiles to the documented `:workspace_roots` syntax.

## [1.7.0] - 2026-05-31

### Breaking

- `refactor(context-promotion)`: `context-promotion` integration, `ai-ops context-promotion ...` commands, low-level `ai-ops codex-hook ... context-promotion` commands, packaged context-promotion receipt config, and `context-promotion-review` skill are removed. Existing user-local artifacts should be uninstalled or cleaned before upgrading.
- `refactor(skill)`: `doc-impact-reviewer` is removed from the bundled skill catalog. Use `ai-ops-project-owned-docs` for project-owned operating-document updates.

### Added

- `feat(skill)`: `ai-ops-project-owned-docs` task skill now serves as the single explicit project-owned docs workflow for user notes, diff impact review, and conversation/troubleshooting learnings.
- `feat(cli)`: `ai-ops integration list`, `skill list`, `subagent list`, and `pack list` now show install-state icons (`✓ installed`, `○ not installed`) so installed and missing assets are easier to scan.

### Changed

- `refactor(pc)`: shared Codex `PostToolUse` hook infrastructure remains, but `pc` is now the only supported integration hook workflow. Successful `git commit` parsing moved into a shared Codex hook parser used by `pc` and the integration dispatcher.
- `docs`: README, CLI README, implementation playbook, and plan docs now describe the current product surface: `code-review-gate`, `pc`, and `ai-ops-project-owned-docs`.

### Fixed

- `fix(integration)`: stale `context-promotion` entries in existing user integration manifests no longer block `integration list` or `integration install pc`; they are ignored and cleaned on the next integration manifest write.
- `fix(codex-permissions)`: `safe-local` no longer grants write access to the removed context-promotion receipt store.

## [1.6.2] - 2026-05-30

## [1.6.1] - 2026-05-30

## [1.6.0] - 2026-05-30

### Added

- `feat(code-review-gate)`: Codex-only explicit review gate integration 추가. 소비자 프로젝트에서는 `ai-ops integration install code-review-gate`로 user/global runtime에 설치한 뒤, Codex에서 `code-review-gate`를 명시 호출해 current diff, HEAD commit, plan-vs-implementation, project-wide, feature, module 리뷰를 수행할 수 있다.
- `feat(code-review-gate)`: `code-review-gate` subagent와 7개 focused review task skill을 추가해 scope mapping, correctness, security, state/concurrency, test quality, architecture/ops, final findings 렌즈를 제공한다. 이 integration은 read-only이며 Codex hook이나 receipt config를 설치하지 않는다.

### Changed

- `feat(integration)`: integration lifecycle이 subagent component, hookless integration, `integration diff`, `integration update`, pre-existing component ownership preservation을 지원하도록 확장.

## [1.5.7] - 2026-05-29

### Fixed

- `fix(project-layer)`: `update --force` now preserves valid non-template project-owned documents already registered in the manifest so `docs-status` and `context-layer` rows are not dropped.

## [1.5.6] - 2026-05-28

### Added

- `feat(pc)`: add `ai-ops pc status` and `$pc:done` draft/apply commands so Codex can fill a structured handoff draft while `ai-ops` deterministically updates and commits only the personal context repo.

### Fixed

- `fix(codex-permissions)`: `safe-local` status no longer reports an installed managed profile as missing when the only config difference is trailing EOF blank lines.

## [1.5.5] - 2026-05-22

### Added

- `feat(studio)`: `ai-ops studio [project]` now launches the macOS arm64 desktop Studio app through an optional `ai-ops-studio-darwin-arm64` platform package while preserving `ai-ops studio snapshot --json`.

## [1.5.4] - 2026-05-22

### Fixed

- `fix(codex-permissions)`: `safe-local` now avoids the legacy `**/*.env = "none"` fallback unless no portable exact env-file candidate validates, and its runtime smoke uses permission-feature config resolution instead of the shallower model catalog command.

## [1.5.3] - 2026-05-22

## [1.5.2] - 2026-05-22

### Fixed

- `fix(codex-permissions)`: `safe-local` now validates its generated permission profile with the installed Codex runtime, selects the first compatible env-file deny syntax, falls back with a warning only when runtime validation is unavailable, and fails closed instead of writing invalid `config.toml`.

## [1.5.1] - 2026-05-22

### Added

- `docs(agent-layer)`: `Reference-Backed Implementation` workflow rule을 추가해 reference 문서의 핵심 제약을 acceptance condition, test fixture, smoke command로 고정하도록 안내

### Fixed

- `fix(codex-permissions)`: `safe-local` now writes `default_permissions` before the first TOML table so existing Codex config tables do not scope the selector under another table.

## [1.5.0] - 2026-05-22

### Added

- `feat(project-layer)`: `docs/agent/project-rules/*.md` project-owned agent rule discovery를 추가하고, `update`/`diff`/`audit`/Studio snapshot이 manifest, context-layer, docs-status와 함께 추적하도록 지원

### Fixed

- `fix(codex-permissions)`: `safe-local` generated Codex 0.130.0-compatible permission profile TOML using the `:project_roots` table shape.

## [1.4.1] - 2026-05-21

### Added

- `feat(codex-permissions)`: `safe-local`을 permission profile 기반으로 전환해 `pc` context repo와 workspace `.codex/plans` write를 허용하고, ai-coding worker용 run-scoped `codex exec` 가이드를 문서화
- `docs(agent-layer)`: baseline과 impact checklist에 파일 크기, Rule of Three, 책임 경계 기반 리팩토링 검토 신호를 soft trigger로 추가

### Changed

- `refactor(cli)`: `apps/cli/src`를 `commands/core/lib` 중심에서 `features/*`, `shared`, `cli/program.ts` 중심 구조로 재배치하고 CLI command/options/JSON contract는 유지
- `refactor(project-layer)`: project-layer lifecycle, audit, docs-status, pack source/loading, command shell을 feature-local 모듈로 분리
- `refactor(studio)`: Studio snapshot 생성을 project snapshot, runtime snapshot, issue normalization/source state 단위로 분리
- `refactor(runtime-assets)`: skills, subagents, integrations, Codex hooks, permissions, context-promotion, pc 로직을 각 feature 내부로 이동하고 `core`는 schema/facade 중심으로 축소

## [1.4.0] - 2026-05-21

### Fixed

- `fix(context-promotion)`: `context-promotion-review`가 `HEAD` 커밋만 보고 `no-promotion`으로 수렴하지 않도록 post-commit worktree 상태, 리뷰 루프 학습, 사용자 교정, changeset hygiene 후보를 함께 검토하도록 보강

## [1.3.1] - 2026-05-19

### Added

- `feat(terminology)`: project operating layer에 `docs/agent/terminology.md`와 project-owned `docs/business/terminology.md`를 추가해 agent 운영 용어와 프로젝트/domain 용어 SSOT를 분리
- `feat(skill)`: `project-terminology-sync` task skill을 추가해 `docs/business/terminology.md` 생성/갱신, `Reserved` → `Active` 승격, docs-status/context-layer 동기화 규칙을 명시

### Changed

- `refactor(spec-lifecycle)`: spec lifecycle 용어 기준을 `docs/specs/baseline/01_glossary.md`에서 `docs/business/terminology.md`로 통합

### Removed

- `refactor(skill)`: `spec-shared-glossary-sync` task skill id와 별도 spec glossary SSOT 계약 제거

## [1.3.0] - 2026-05-19

### Removed

- `refactor(legacy)`: root `.ai-ops-manifest.json`, root `specs/`, preset-first rules scaffolder internals, and unused workspace/settings utilities removed.

## [1.2.0] - 2026-05-19

### Added

- `feat(integration)`: `ai-ops integration list|install|status|uninstall` 상위 명령 추가
- `feat(integration)`: `context-promotion`과 `pc` integration catalog 및 user/global integration manifest 추가
- `feat(pc)`: 성공적인 `git commit` 이후 `$pc:done` handoff 누락을 방지하는 `pc` Codex skill과 `PostToolUse` hook runner 추가

### Changed

- `refactor(codex-hook)`: Codex hook 설치/상태/제거 로직을 공통 hook definition 기반으로 정리하고 integration installer에서 재사용
- `docs(integration)`: 제품 정의를 project operating layer와 user/global runtime integration 구조로 갱신

### Fixed

- `fix(integration)`: integration install이 기존 skill의 `sourceHash`를 비교해 오래된 user/global skill source를 최신 bundled source로 보정
- `fix(pc)`: active workstream이 현재 `HEAD`를 이미 마지막 확인 commit으로 기록한 경우 `$pc:done` continuation prompt를 중복 요청하지 않도록 처리

## [1.1.1] - 2026-05-18

### Fixed

- `fix(cli)`: `ai-ops --version`이 하드코딩된 `0.1.0` 대신 package version을 출력하도록 수정

## [1.1.0] - 2026-05-18

### Added

- `feat(context-promotion)`: 작업 커밋 직후 Codex `PostToolUse` hook으로 `context-promotion-review` 후속 검토를 요청하는 흐름 추가
- `feat(codex-hook)`: `ai-ops codex-hook install|status|uninstall context-promotion` 명령 추가 및 설치 시 `context-promotion-review` Codex skill 보장 설치
- `feat(context-promotion)`: user-local receipt store, `status`, `resolve`, `prune`, `hook post-tool-use` 명령 추가

### Changed

- `refactor(context-promotion)`: commit 차단형 `PreToolUse` gate 대신 작업 커밋과 승격 수정을 분리하는 post-commit review 방식으로 전환
- `chore(codex-hook)`: 기본 hook command를 repo-local 절대경로 대신 portable `ai-ops context-promotion hook post-tool-use` 형태로 변경

### Fixed

- `fix(context-promotion)`: 실패한 commit output과 성공한 commit subject를 구분해 잘못된 review suppression을 방지
- `fix(context-promotion)`: hook continuation prompt와 skill 계약을 Project root 안으로 제한하고 웹 검색/다른 repo 탐색을 금지

## [1.0.3] - 2026-05-18

### Fixed

- `fix(project-layer)`: `docs/docs-status.md` 테이블 헤더가 formatter에 의해 column-aligned 되어도 `update`/`audit`이 문서 상태 테이블을 파싱하고 갱신할 수 있도록 처리

## [1.0.2] - 2026-05-18

### Added

- `feat(agent-layer)`: 기존 `role-persona`, `communication`, `code-philosophy`, `naming-convention`, `plan-mode` baseline rule을 `docs/agent/rules/00-agent-baseline.md` Active operating-layer 문서로 이관

### Removed

- `chore(agent-layer)`: `00-agent-baseline.md`를 canonical source로 삼기 위해 legacy `apps/cli/data/rules/*.yaml`, `apps/cli/data/presets.yaml`, rule authoring/review docs를 제거

## [1.0.1] - 2026-05-18

### Fixed

- `release`: npm registry에 이미 존재하는 `1.0.0` 재배포 대신 patch 버전으로 후속 배포할 수 있도록 release note를 보강

## [1.0.0] - 2026-05-18

### Breaking

- `ai-ops`의 제품 모델을 기존 rules/skills scaffolder에서 프로젝트 AI agent operating layer 관리자로 전환. 기존 사용자는 자동 migration을 기대하지 말고 새 setup 경로로 재설치하는 breaking release로 다뤄야 함.
- project-owned docs/state와 user/global agent assets의 ownership boundary를 분리. 프로젝트 운영 문서와 `.ai-ops/*` 상태는 repo-local로 관리하고, skills/subagents는 사용자 환경의 global manifest로 관리함.

### Added

- `feat(cli)`: project operating layer lifecycle 추가 — `.ai-ops/manifest.json`과 `.ai-ops/context-layer.json`을 기준으로 `init`, `update`, `diff`, `audit`, `uninstall` 동작을 관리
- `feat(skill)`: global skill lifecycle 단순화 — skills manifest를 user/global scope로 이동하고 project directory를 설치 상태 저장소로 사용하지 않도록 변경
- `feat(subagent)`: `subagent install|uninstall` lifecycle 추가 — `security-gate`, `security-reviewer` subagent를 Codex, Claude Code, Gemini용 renderer로 설치
- `feat(pack)`: 선택형 `spec-lifecycle` pack 추가 — `docs/specs/README.md`, `README.ko.md`, `baseline/`, `initial-build/` 구조를 project-local pack으로 설치
- `feat(skill)`: `doc-impact-reviewer` task skill 추가 — working tree와 staged diff를 모두 확인하도록 계약화
- `docs`: `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `docs/agent/*`, `docs/docs-status.md` 기반의 canonical agent operating layer 문서 세트 추가

### Changed

- `refactor(cli)`: `init`, `update`, `diff`, `audit`, `uninstall`이 공통 project-layer 엔진과 manifest 기준을 공유하도록 재구성
- `refactor(cli)`: 기존 `spec init` 흐름을 optional pack lifecycle로 이동하고 `docs/specs/`를 기준 경로로 정리
- `docs`: README, CLI README, implementation playbook, plan 문서를 현재 agent operating layer contract 기준으로 갱신
- `chore`: package/workspace naming과 repository metadata를 `ai-ops-cli` 기준으로 정리

### Fixed

- `fix(cli)`: invalid manifest와 project-layer apply error를 명확히 분리해 실패 메시지와 exit behavior를 안정화
- `fix(cli)`: project-owned status가 re-init 시 stale 상태로 남지 않도록 refresh
- `fix(cli)`: `pack update`가 project operating layer 미설치 상태에서 조용히 성공하지 않고 복구 가능한 메시지와 함께 실패하도록 수정

## [0.2.6] - 2026-05-05

## [0.2.5] - 2026-05-05

### Added

- `docs(skills)`: frontend 상태/cache 관리 reference 규칙 추가 — Flutter Riverpod, React TanStack Query/SWR, Zustand persist, GraphQL client cache의 server state/client state 경계를 명시

### Changed

- `feat(spec)`: `ai-ops spec init` 생성 디렉토리를 `specs/delta/`에서 `specs/initial-build/`로 변경하고 README 템플릿과 테스트 기대값 갱신

## [0.2.4] - 2026-03-25

### Changed

- `docs(rules)`: `code-philosophy` 규칙에 파일 내부 구조화 규칙 추가 — 선언 순서 컨벤션(types → constants → validators/guards → helper functions → main logic/exports)과 의미 단위 경계에 섹션 구분 주석(`// ----- types -----`) 사용 원칙을 guidelines 및 decision_table에 추가

## [0.2.3] - 2026-03-23

### Changed

- `data(skills)`: `backend-ts-nestjs-runtime`, `frontend-web-react-next-runtime` reference에 `date-fns` 사용 규칙 추가 — `moment/dayjs` 금지에 대응하는 positive rule (`date-fns` 개별 import), `new Date(string)` timezone silent failure 방지를 위한 `parseISO()` 사용 constraint 및 decision rule 추가

## [0.2.2] - 2026-03-22

### Added

- `feat(cli)`: `ai-ops spec init` 명령 추가 — `specs/README.md`, `specs/baseline/`, `specs/delta/` 디렉토리 구조를 생성하는 spec 파이프라인 초기화 커맨드. `--force` 옵션으로 기존 디렉토리 덮어쓰기 가능

## [0.2.1] - 2026-03-15

### Added

- `test(settings)`: Claude/Gemini settings install/uninstall 동작을 직접 검증하는 단위 테스트 추가

### Changed

- `refactor(settings)`: Claude/Gemini settings 처리 로직을 `tool-settings` 공통 엔진으로 통합해 install/uninstall/prompt 흐름 중복 제거
- `chore(format)`: `npm run format`이 Prettier 기본 ignore 동작을 사용하도록 `--ignore-path .gitignore` 제거

### Docs

- generated agent instruction 파일과 manifest를 최신 communication 규칙 및 source hash에 맞게 재생성
- Claude plan 문서 파일명을 `YYYYMMDD_<topic>.md` 규칙에 맞게 정리하고 유지보수 리팩토링 계획 문서 추가

## [0.2.0] - 2026-03-13

### Changed

- `refactor(cli)`: skill catalog 메타데이터를 `apps/cli/data/skills/skill-registry.json`으로 통합하고, 소스 디렉토리를 `reference-skills/`와 `task-skills/`로 분리. `SKILL.md`는 agent-facing frontmatter만 유지하도록 정리
- `refactor(init)`: `ai-ops init`이 preset에 연결된 `reference` skill만 표시하고, 이미 전역 설치된 skill과 현재 설치 가능한 skill을 분리해 보여주도록 변경

### Fixed

- `fix(init)`: `ai-ops init` 전 과정에서 `ESC` 또는 `Ctrl+C`로 일관되게 설치를 중단할 수 있도록 취소 흐름을 정리. 설정 프롬프트 취소도 전체 init 취소로 전파

### Docs

- skill authoring guide, CLI README, root README, generated agent instructions를 최신 skill catalog 구조에 맞게 갱신

## [0.1.24] - 2026-03-10

- `docs(rules)`: `plan-mode` YAML 소스 수정 — `constraints` 항목 제거 후 다이어그램 타입 규칙을 `guidelines` 인라인으로 흡수; `YYYYMMDD_<topic>.md` 파일 네이밍 규칙을 `decision_table`에 추가

## [0.1.23] - 2026-03-10

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
