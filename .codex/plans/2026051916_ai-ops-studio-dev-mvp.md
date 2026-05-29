# ai-ops Studio Dev MVP 구현 계획

## 요약

PRD [2026051915_ai-ops-studio-prd.md](/Users/charles/ai-projects/ai-ops-cli/.codex/plans/2026051915_ai-ops-studio-prd.md)를 기준으로, v1은 **Dev MVP**로 구현한다. 목표는 packaged app이 아니라 `apps/studio` Tauri dev app과 read-only `studio snapshot` 계약을 완성하는 것이다.

확정 결정:

- 데이터 경계: CLI Snapshot
- 실행 범위: current cwd project only
- Theme: getdesign 기반 bundled presets
- Phase: 총 8개, 각 phase는 구현 → 리뷰 → 커밋 단위

외부 근거:

- [getdesign](https://www.getdesign.app/)는 사이트/slug에서 `design.md` 계열 디자인 명세를 만드는 도구로 설명된다.
- [getdesign Cohere page](https://getdesign.md/cohere/design-md)는 `npx getdesign@latest add cohere` 사용을 안내한다.
- [JSPM getdesign package page](https://jspm-packages.deno.dev/package/getdesign)는 `DESIGN.md`가 colors/type/spacing/components/motion 등을 담는 단일 Markdown 명세라고 설명한다.
- [Tauri + Vite](https://v2.tauri.app/start/frontend/vite/), [shadcn/ui Vite](https://ui.shadcn.com/docs/installation/vite), [shadcn/ui theming](https://ui.shadcn.com/docs/theming)를 기준으로 앱/테마 구조를 잡는다.

## 핵심 인터페이스

- 새 read-only CLI command: `ai-ops studio snapshot --json`
  - cwd를 project root로 읽는다.
  - project/context/audit/runtime 상태를 JSON으로 반환한다.
  - repo, project docs, user/global runtime manifest를 수정하지 않는다.
- 새 workspace: `apps/studio`
  - Tauri + Vite + React + TypeScript + Tailwind CSS + shadcn/ui.
  - Zustand는 selected view, selected document, layout, appearance preference만 관리한다.
  - TanStack Query는 snapshot/audit/runtime read state만 관리한다.
- Theme preset bundle:
  - source slugs: `cohere`, `x.ai`, `vercel`, `clickhouse`, `hashicorp`, `sentry`, `cal`, `linear.app`, `framer`, `stripe`, `spotify`
  - normalized ids: `cohere`, `x-ai`, `vercel`, `clickhouse`, `hashicorp`, `sentry`, `cal`, `linear-app`, `framer`, `stripe`, `spotify`
  - 각 preset은 generated `DESIGN.md` 원문 + Studio용 CSS variable token map + preview metadata를 포함한다.

## Phase 1 — Studio Snapshot Contract

- `ai-ops studio snapshot --json`을 추가한다.
- Snapshot에는 initialized/uninitialized state, manifest/context-layer/docs-status health, audit issues, context documents, provenance, runtime catalog/install state를 포함한다.
- 기존 TypeScript core를 재사용하고, Tauri/Rust 쪽에 operating-layer parsing을 중복하지 않는다.
- 테스트:
  - initialized project snapshot
  - uninitialized project snapshot
  - malformed context-layer/frontmatter reporting
  - runtime installed/not-installed state
  - snapshot command가 repo/user-global state를 쓰지 않는지 확인
- 리뷰 후 커밋: snapshot contract only.

## Phase 2 — getdesign Theme Intake

- 임시 디렉터리에서 각 getdesign command를 실행해 실제 생성 파일을 확인한다.
- 생성물이 `DESIGN.md` 단일 파일이면 slug별로 보존하고, 추가 파일이 생기면 manifest에 기록한 뒤 theme asset으로 필요한 파일만 선별한다.
- 지원할 11개 preset을 모두 `apps/studio` bundle asset으로 가져온다.
- `x.ai`, `linear.app`처럼 dot이 있는 slug는 source slug와 app id를 분리한다.
- command 실패 시 대체 slug를 임의 선택하지 않고 phase를 중단한다.
- 테스트:
  - 11개 preset id가 모두 registry에 존재
  - 각 preset이 source slug, label, designMd reference, token map을 가진다
  - preset registry에 중복 id 없음
- 리뷰 후 커밋: theme source bundle only.

## Phase 3 — Tauri/Vite App Scaffold

- `apps/studio` workspace를 만든다.
- Tauri + Vite React TS + Tailwind + shadcn/ui + Zustand + TanStack Query를 설정한다.
- Tauri command는 `ai-ops studio snapshot --json`을 호출하는 read-only bridge만 둔다.
- root script에 `studio:dev`, `studio:build`, `studio:test`를 추가한다.
- 테스트:
  - Studio TypeScript build
  - Tauri bridge mock/unit test
  - dev app shell smoke
- 리뷰 후 커밋: app scaffold and bridge.

## Phase 4 — Project Views

- Project nav: `Overview`, `Context Graph`, `Documents`.
- Context Graph는 `.ai-ops/context-layer.json` 문서만 보여준다.
- Documents는 preview-first이며 edit/raw tab은 v1에서 제외한다.
- Inspector는 `status`, `layer`, `owner`, `read_when`, `update_when`, `contentHash`, managed/project-owned provenance를 보여준다.
- `Reserved`, `Draft`, `Archived`는 신뢰도 경고를 강하게 표시한다.
- 테스트:
  - context-layer 문서만 표시
  - Reserved warning
  - selected document inspector
  - uninitialized empty state
- 리뷰 후 커밋: Project read views.

## Phase 5 — Audit View

- `Audit` page와 bottom diagnostics panel을 구현한다.
- Issue는 severity, code, affected path 기준으로 묶는다.
- Issue 선택 시 관련 문서로 이동한다.
- Suggested action은 label만 보여주고 실행하지 않는다.
- 테스트:
  - clean audit
  - docs-status mismatch
  - missing file
  - context/frontmatter mismatch
- 리뷰 후 커밋: audit UI.

## Phase 6 — Runtime Read-Only Views

- Runtime nav: `Integrations`, `Skills`, `Subagents`, `Hooks`.
- Integrations는 catalog, installed state, owned/pre-existing components, hook status, receipt-config path를 보여준다.
- Skills는 `reference` / `task`로 그룹화한다.
- Subagents는 supported tools, installed tools, installed paths를 보여준다.
- Hooks는 Codex hook installed/not-installed와 관련 integration을 보여준다.
- Install/update/uninstall 버튼은 만들지 않는다.
- 테스트:
  - integration installed/not-installed rendering
  - skill/subagent grouping
  - hook status rendering
  - Runtime 영역이 Project docs처럼 보이지 않는지 확인
- 리뷰 후 커밋: Runtime read-only views.

## Phase 7 — Appearance And Theme Switcher

- 11개 bundled getdesign preset을 Appearance에서 전환할 수 있게 한다.
- light/dark/system, preset, density, Markdown typography size, code block style을 local preference로 저장한다.
- shadcn CSS variable token을 사용하고 generated shadcn component는 직접 수정하지 않는다.
- 테스트:
  - preset switching
  - preference persistence
  - compact density rendering
  - theme 변경이 project/user-global 파일을 쓰지 않음
- 리뷰 후 커밋: appearance/theme system.

## Phase 8 — Hardening, Docs, Final Review

- Dev MVP 실행 문서와 non-goal을 README 또는 PRD companion doc에 정리한다.
- initialized project와 uninitialized temp project에서 smoke test한다.
- Project, Audit, Runtime, Appearance 화면의 text overflow, layout overlap, Project/Runtime separation을 시각 검수한다.
- 최종 검증:
  - `npm run test --workspace=apps/cli`
  - `npm run build --workspace=apps/cli`
  - `npm run test --workspace=apps/studio`
  - `npm run build --workspace=apps/studio`
  - 가능하면 Tauri dev smoke
- 리뷰 후 커밋: Dev MVP stabilization.

## 명시적 가정

- v1은 packaged app을 만들지 않는다.
- v1은 `ai-ops studio` launcher를 만들지 않는다.
- v1은 `npm run studio:dev` 중심 Dev MVP다.
- getdesign output은 먼저 임시 디렉터리에서 확인한 뒤 repo에 curated bundle로 가져온다.
- getdesign slug가 실패하면 임의 대체하지 않는다.
- Theme preset은 build-time bundle이며 local theme import는 후속 기능이다.
- 기존 untracked `.codex/plans/2026051912_ops-workflow-refactoring.md`는 Studio 커밋에 포함하지 않는다.
