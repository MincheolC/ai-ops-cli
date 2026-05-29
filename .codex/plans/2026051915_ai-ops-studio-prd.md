# ai-ops Studio PRD

## Summary

`ai-ops studio`는 프로젝트 repo 전체를 편집하는 IDE가 아니라, `.ai-ops/context-layer.json`이 허용한 AI operating-layer graph를 읽고 검증하는 project-bound desktop control plane이다. user/global runtime integrations는 project docs와 분리된 상태 정보로만 표시한다.

장기적으로 Studio는 AI operating layer의 읽기, 수정, 검증을 돕는 앱이지만, v1 MVP는 preview/audit-first read-only 경험으로 고정한다. 문서 편집, integration install/uninstall, usage analytics, arbitrary file pinning은 v1에서 제외한다.

## Product Positioning

### What It Is

- Desktop-only app.
- Project root 단위로 실행되는 control plane.
- `.ai-ops/context-layer.json`, `.ai-ops/manifest.json`, `docs/docs-status.md`, operating-layer document frontmatter를 기준으로 context graph를 보여준다.
- Project operating docs와 user/global runtime capabilities를 명확히 분리해 보여준다.
- Markdown preview와 audit 결과를 빠르게 확인하는 가독성 중심 도구다.

### What It Is Not

- Repo 전체 file explorer가 아니다.
- VS Code, Cursor, Claude Code, Gemini CLI를 대체하는 IDE가 아니다.
- Context-layer graph 밖의 임의 파일을 AI context 후보로 보여주는 앱이 아니다.
- v1에서는 project docs editor가 아니다.
- v1에서는 integration installer/uninstaller가 아니다.
- v1에서는 skill/subagent usage analytics나 telemetry recommendation 도구가 아니다.

## Problem

현재 `ai-ops` operating layer는 CLI로 설치, 갱신, audit할 수 있지만, 사람이 일상적으로 상태를 읽고 판단하기에는 불편하다.

- 어떤 파일이 AI operating context인지 한눈에 보이지 않는다.
- 각 문서의 `status`, `layer`, `owner`, `read_when`, `update_when` 의미를 매번 Markdown/frontmatter로 확인해야 한다.
- `Reserved` 문서가 현재 판단 근거가 아니라는 사실이 UI에서 강하게 드러나지 않는다.
- `docs/docs-status.md`, frontmatter, `.ai-ops/context-layer.json`, `.ai-ops/manifest.json`의 drift를 CLI output만으로 해석해야 한다.
- Integration, skill, subagent, Codex hook이 project docs와 다른 scope인데도, 전체 상태를 한곳에서 읽기 어렵다.
- Markdown preview/readability가 기본 작업 도구 수준으로 충분히 좋지 않다.

## Goals

- Project operating layer graph를 안전하고 빠르게 탐색하게 한다.
- Markdown preview와 inspector를 통해 문서의 목적, 상태, 소유권, 갱신 조건을 즉시 이해하게 한다.
- Audit/diff 결과를 사람이 읽기 좋은 상태 패널로 보여준다.
- Runtime integrations와 components를 project docs와 분리된 read-only status로 보여준다.
- Theme preset과 reading settings를 통해 사용자가 자기에게 맞는 가독성 환경을 찾게 한다.
- Desktop-only, local-first 앱으로 유지한다.

## Non-Goals

- Repo-wide explorer.
- General code editing.
- Arbitrary file pinning.
- Project context graph 밖 파일 열기.
- v1 document editing.
- v1 integration install/update/uninstall.
- v1 skill/subagent/hook mutation.
- Skill/subagent usage analytics.
- Telemetry-based recommendations.
- PRD/spec lifecycle automation UI.
- Always-on local web server model.

## Users And Jobs

### Primary User

AI-assisted project operator who already uses `ai-ops init`, `audit`, `diff`, `integration`, `skill`, and `subagent` commands across local projects.

### Jobs To Be Done

- "이 프로젝트에서 AI가 읽어야 하는 operating docs가 무엇인지 보고 싶다."
- "이 문서가 현재 판단 근거로 쓸 수 있는지 확인하고 싶다."
- "Reserved/Draft 문서를 실수로 사실처럼 취급하지 않게 하고 싶다."
- "context-layer, docs-status, frontmatter, manifest drift를 빠르게 이해하고 싶다."
- "현재 user/global runtime에 어떤 integrations, skills, subagents, hooks가 설치되어 있는지 project docs와 구분해서 보고 싶다."
- "Markdown 문서를 보기 좋은 테마로 읽고 싶다."

## V1 Scope

### Project Area

Navigation group: `Project`

- `Overview`
  - project root
  - installed tools
  - context-layer health
  - manifest generated time
  - audit summary
- `Context Graph`
  - source: `.ai-ops/context-layer.json`
  - group by `status`, `layer`, `owner`
  - show `Active`, `Draft`, `Reserved`, `Archived` separately
  - visually warn that `Reserved` is not current decision evidence
- `Documents`
  - preview-first Markdown viewer
  - document list comes only from context-layer graph
  - no repo-wide file picker
  - inspector shows metadata and warnings
- `Audit`
  - source: existing `ai-ops audit` / core audit report
  - show errors and warnings grouped by code
  - make mismatch source clear: context-layer, docs-status, frontmatter, manifest, missing file

### Runtime Area

Navigation group: `Runtime`

- `Integrations`
  - read-only list of known integrations from integration catalog
  - installed/not installed status from user/global integration manifest
  - show owned components and component health
  - v1 does not install or uninstall integrations
- `Skills`
  - read-only catalog and installed state
  - group by `reference` / `task`
  - show supported tools and groups
  - clarify that skills are user/global runtime components, not project docs
- `Subagents`
  - read-only catalog and installed state
  - show supported tools
  - clarify global runtime scope
- `Hooks`
  - read-only Codex hook status
  - show which integration owns or expects the hook when known
  - no hook editing in v1

## Information Architecture

```text
Top Bar
- project root
- context health
- audit status
- selected theme

Left Nav
- Project
  - Overview
  - Context Graph
  - Documents
  - Audit
- Runtime
  - Integrations
  - Skills
  - Subagents
  - Hooks
- Settings
  - Appearance

Center
- selected graph/document/status view

Right Inspector
- document metadata
- trust/status explanation
- owner and update rules
- audit issues for selected item
- related runtime component status when relevant

Bottom Panel
- audit output
- command output
- read-only diagnostics
```

## Core UX Principles

- What Studio shows as project context must be determined by `.ai-ops/context-layer.json`.
- Runtime components must never look like project-owned operating documents.
- `Reserved` must be visually clear as "not usable as current evidence."
- Readability is a first-class feature, not decoration.
- Audit output should be explainable without requiring users to mentally diff JSON, Markdown table rows, and frontmatter.
- Mutation requires a later explicit design pass. v1 avoids writes except local app preferences.

## Data Sources

Project-local:

- `.ai-ops/context-layer.json`
- `.ai-ops/manifest.json`
- `docs/docs-status.md`
- document frontmatter and Markdown content for paths listed in context-layer/manifest

User/global runtime:

- integration catalog from `apps/cli/data/integrations/integration-registry.json`
- integration manifest under user/global runtime home
- skill catalog and installed skill manifest
- subagent catalog and installed subagent manifest
- Codex hook config/status

V1 must distinguish source provenance in UI:

- `Project operating layer`
- `Project-owned docs`
- `ai-ops managed docs`
- `User/global runtime`
- `Catalog source`
- `Installed state`

## Tech Stack Recommendation

Recommended stack:

- Tauri
- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand
- TanStack Query

Rationale:

- Tauri fits desktop-only, local-first, no-always-on-server requirements.
- Vite + React + TypeScript keeps UI iteration fast and type-safe.
- Tailwind + shadcn/ui is a good fit for dense control-plane UI: sidebar, tabs, table, command palette, dialog, sheet, toast, badge, resizable panels.
- Zustand should own local UI state: selected project, selected document, layout panels, appearance settings.
- TanStack Query should own async read models: context snapshot, audit report, integration status, skill/subagent status, hook status.
- Tauri commands should be the boundary for filesystem and CLI/core reads.

Non-goal for v1 tech:

- Do not run a persistent local web server.
- Do not make the browser the primary product shell.
- Do not couple the PRD to a specific generated design source.

## Theme And Appearance

Theme switching is included in v1 because Studio is primarily a reading and inspection tool.

### V1 Theme Scope

- light / dark / system mode
- multiple theme presets
- density: comfortable / compact
- Markdown preview typography
- editor-like monospace preview settings for code blocks
- accent color preset
- local preference persistence

### Theme Source Strategy

- Use `getdesign@latest` or similar generators as a source of candidate visual systems.
- Keep several imported theme presets available for comparison.
- Treat generated themes as replaceable assets, not product contracts.
- Theme changes must not write to project operating-layer files.

## Functional Requirements

### Context Graph

- Load project context graph only when `.ai-ops/context-layer.json` exists.
- Show clear empty/error state when project is not initialized.
- Group documents by `status`, `layer`, and `owner`.
- Selecting a document opens preview and inspector.
- Paths not listed in context-layer are not shown in project document navigation.

### Document Preview

- Render Markdown with strong typography.
- Show frontmatter metadata in Inspector, not as noisy content by default.
- Show `status`, `layer`, `owner`, `read_when`, `update_when`, `contentHash`.
- Mark managed/project-owned provenance.
- Show warning copy for `Reserved`, `Draft`, and `Archived`.

### Audit

- Run/read audit as a read-only operation.
- Preserve issue code and severity.
- Group issues by affected document and source.
- Selecting an issue should navigate to the related document when possible.
- v1 may show suggested CLI action labels, but must not execute mutation automatically.

### Runtime Status

- List known integrations from catalog.
- Show installed status from user/global manifest.
- Show integration components: skill, codex-hook, receipt-config.
- Show skills and subagents as runtime catalog/install state, separate from project documents.
- Show Codex hook status where available.
- v1 must not install, update, or uninstall runtime components.

### Appearance

- Switch theme without reload where possible.
- Store theme preference locally.
- Provide enough presets to compare readability.
- Make compact mode useful for dense status lists.

## Acceptance Criteria

- A user can open a project and see only context-layer documents in the Project area.
- A user can identify `Active`, `Draft`, `Reserved`, and `Archived` documents without opening raw Markdown.
- A user can preview any context-layer Markdown document with readable typography.
- A user can inspect frontmatter fields and content hash for the selected document.
- A user can run/read audit results and understand whether drift is from context-layer, docs-status, manifest, frontmatter, or missing files.
- A user can open Runtime pages and see integration, skill, subagent, and hook status without confusing them with project-owned docs.
- No v1 Runtime page mutates user/global assets.
- Theme switching changes the reading experience and persists locally.
- No repo-wide file explorer appears in v1.

## Open Questions

- Should v1 launch only from `ai-ops studio` in current cwd, or also support `ai-ops studio /path/to/project`?
- Should audit be executed by calling the existing CLI command or by sharing a core read model directly with the Tauri backend?
- Should `Documents` show a raw Markdown tab in v1, or keep preview-only until edit mode is designed?
- Should theme presets be bundled at build time only, or imported from a local theme directory?
- Should Runtime status read only installed manifests, or also verify actual files exist for every installed path in v1?

## Recommended Implementation Sequence

1. Finalize PRD.
2. Write technical spec for desktop shell and read-model boundaries.
3. Add read-only Studio snapshot core:
   - project context snapshot
   - audit snapshot
   - runtime integration/component snapshot
4. Scaffold Tauri app with Vite + React + TypeScript.
5. Implement Project Overview, Context Graph, Document Preview, Inspector.
6. Implement Audit view.
7. Implement Runtime read-only pages.
8. Add theme presets and Appearance settings.
9. Run local desktop smoke on initialized and non-initialized projects.
