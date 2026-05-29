# Phase 3 구현 계획: Tauri/Vite App Scaffold

## Summary

Phase 3는 기존 `apps/studio` theme package 위에 **Dev MVP desktop shell**을 얹는다. 범위는 실제 Project/Audit/Runtime 화면 구현 전, `studio snapshot`을 읽어오는 Tauri bridge와 React shell까지다.

참고 기준: [Tauri Vite config](https://v2.tauri.app/start/frontend/vite/), [shadcn/ui Vite + Tailwind v4](https://v3.shadcn.com/docs/installation/vite), [shadcn CLI v4 dry-run/diff](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4), [TanStack Query Provider](https://tanstack.com/query/v5/docs/framework/react/reference/QueryClientProvider)

## Key Changes

- `apps/studio`에 Vite React TS app을 추가한다.
  - `src/main.tsx`, `src/app/app.tsx`, `src/app/providers.tsx`, `src/styles.css`, `index.html`, `vite.config.ts`
  - Tailwind v4 + shadcn/ui CSS-variable 기반 설정
  - shadcn components는 최소 `button`, `badge`, `separator`, `skeleton`만 추가
- `apps/studio/src-tauri`를 추가한다.
  - Tauri v2 dev config: fixed port `5173`, `frontendDist: "../dist"`
  - Rust command: `load_studio_snapshot`
  - Rust는 operating-layer parsing을 하지 않고 CLI stdout JSON 문자열만 반환한다.
- snapshot bridge를 추가한다.
  - project root는 `AI_OPS_STUDIO_PROJECT_ROOT` 우선, 없으면 current cwd
  - CLI 경로는 `AI_OPS_CLI_BIN` 우선, 없으면 `apps/cli/dist/bin/index.js`
  - 실행 명령은 `node <cli-bin> studio snapshot --json`
  - frontend는 top-level envelope만 검증한다: `kind`, `schemaVersion`, `project`, `runtime`
- React state boundary를 만든다.
  - TanStack Query: snapshot async read state
  - Zustand: selected nav, layout, local shell state only
  - snapshot response를 Zustand에 복제 저장하지 않는다.
- root scripts를 추가한다.
  - `studio:dev`: CLI build 후 `apps/studio` Tauri dev 실행
  - `studio:build`: CLI build + Studio TS/Vite build + Tauri Rust check
  - `studio:test`: Studio tests 실행

## UI Shell

- 첫 화면은 landing page가 아니라 Studio control plane shell이다.
- Top bar: project root, snapshot health, audit summary placeholder
- Left nav: `Project`, `Runtime`, `Settings` 그룹과 Phase 4-7용 placeholder nav
- Main panel: snapshot load 상태, project state, document count, runtime counts
- Error/empty state:
  - CLI build 누락
  - uninitialized project
  - invalid JSON
  - Tauri command failure
- Phase 3에서는 document preview, audit drilldown, runtime detail, theme switcher는 만들지 않는다.

## Test Plan

- `npm run test --workspace=apps/studio`
  - bridge parser가 valid snapshot envelope를 통과시킨다.
  - invalid JSON / wrong kind / wrong schemaVersion을 거부한다.
  - Zustand store가 selected nav만 관리하고 snapshot payload를 저장하지 않는다.
  - App shell이 mocked snapshot으로 project/runtime summary를 렌더링한다.
- `npm run build --workspace=apps/cli`
- `npm run build --workspace=apps/studio`
- `npm run studio:build`
- 가능하면 `npm run studio:dev` smoke:
  - Tauri window가 뜬다.
  - CLI snapshot 결과가 Top/Main shell에 표시된다.
  - project/user-global 파일이 수정되지 않는다.

## Review And Commit Checkpoint

리뷰 포인트:

- Phase 3가 scaffold/bridge 범위를 넘어서 Project/Audit/Runtime 상세 UI를 구현하지 않았는지 확인한다.
- Tauri/Rust가 `.ai-ops/*`를 직접 parsing하지 않는지 확인한다.
- `studio snapshot` 실행이 read-only 경계와 current project root 계약을 지키는지 확인한다.
- shadcn generated component는 직접 수정하지 않았는지 확인한다.

권장 커밋 메시지: `feat(studio): scaffold tauri desktop shell`

## Assumptions

- Phase 3는 packaged app 배포를 만들지 않는다.
- Phase 3는 `ai-ops studio` launcher를 만들지 않는다.
- Dev 실행은 root에서 `npm run studio:dev`를 쓰고, 이 스크립트가 launch cwd를 `AI_OPS_STUDIO_PROJECT_ROOT`로 전달한다.
- Full snapshot schema 공유 패키지는 만들지 않는다. 상세 타입/렌더링은 Phase 4에서 확장한다.
