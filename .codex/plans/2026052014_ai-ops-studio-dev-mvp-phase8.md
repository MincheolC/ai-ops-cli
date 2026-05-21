# Phase 8 구현 계획: Hardening, Docs, Final Review

## Summary

Phase 8은 새 기능 추가가 아니라 Dev MVP 안정화 단계다. 목표는 Studio v1 범위가 PRD와 맞는지 확인하고, 실행 문서와 검증 증거를 남긴 뒤, Phase 1-7 구현을 하나의 desktop Dev MVP로 마감하는 것이다.

중요 전제:

- untracked `.codex/plans/2026052014_ai-ops-studio-dev-mvp-phase7.md`는 Phase 8 커밋에 섞지 않는다.
- `dist`, `node_modules`, `src-tauri/target` 같은 생성물은 커밋하지 않는다.
- v1은 packaged app이나 `ai-ops studio` launcher를 만들지 않는다.

## Key Changes

- Docs
  - root `README.md` / `README.ko.md`에 Studio Dev MVP entrypoint를 짧게 보강한다.
  - `apps/studio/README.md` / `apps/studio/README.ko.md`를 추가한다.
  - Studio docs에는 실행법, v1 scope, non-goals, read-only boundary, smoke scenarios를 명시한다.
- Script hardening
  - `studio:dev`가 기존 `AI_OPS_STUDIO_PROJECT_ROOT`를 존중하게 한다.
  - env가 없을 때만 current root를 project root로 사용한다.
  - 이를 통해 initialized repo와 uninitialized temp dir smoke를 모두 가능하게 한다.
- Test hardening
  - v1 전체 nav smoke test를 추가/정리한다.
  - Project/Runtime separation, no repo explorer, no mutation controls, appearance persistence를 regression coverage로 묶는다.
  - theme provenance test는 실제 `DESIGN.md` checksum과 manifest checksum 비교를 유지한다.
- Visual/manual smoke checklist
  - desktop width
  - narrow/mobile-ish width
  - initialized project
  - uninitialized temp project
  - Project, Audit, Runtime, Appearance 각 화면의 overflow/overlap 확인

## Documentation Content

- `apps/studio/README.md` / `.ko.md`
  - Dev MVP identity: project-bound desktop control plane
  - Launch:
    - `npm run studio:dev`
    - `AI_OPS_STUDIO_PROJECT_ROOT=/path/to/project npm run studio:dev`
  - Build/test:
    - `npm run studio:test`
    - `npm run studio:build`
  - Data boundary:
    - Project docs come only from `.ai-ops/context-layer.json`
    - Runtime assets are user/global status only
    - Appearance preferences use app-local `localStorage`
  - v1 non-goals:
    - repo-wide explorer
    - document editing
    - runtime install/update/uninstall
    - packaged app
    - always-on local web server

## Validation Plan

- Automated checks
  - `npm run test --workspace=apps/cli`
  - `npm run build --workspace=apps/cli`
  - `npm run test --workspace=apps/studio`
  - `npm run build --workspace=apps/studio`
  - `npm run studio:build`
  - `node apps/cli/dist/bin/index.js studio snapshot --json`
- Initialized smoke
  - run Studio against `/Users/charles/ai-projects/ai-ops-cli`
  - verify Project Overview, Context Graph, Documents, Audit, Runtime pages, Appearance
  - verify no repo-wide file explorer appears
- Uninitialized smoke
  - run Studio with `AI_OPS_STUDIO_PROJECT_ROOT` pointing to an empty temp dir
  - verify clear uninitialized state
  - verify Runtime and Appearance still render
- Visual checklist
  - text does not overflow buttons/cards/panels
  - sidebar collapse does not break nav labels/icons
  - Markdown preview remains readable across theme/density settings
  - Runtime pages do not look like project document pages

## Review And Commit Checkpoint

리뷰 포인트:

- PRD acceptance criteria를 실제 UI 기준으로 모두 훑는다.
- v1 excluded scope가 들어오지 않았는지 확인한다.
- docs가 구현된 Dev MVP와 어긋나지 않는지 확인한다.
- dirty worktree에 Phase 8 범위 밖 파일이 섞이지 않았는지 확인한다.

권장 커밋 메시지: `chore(studio): harden dev mvp`

## Assumptions

- Phase 8은 기능 phase가 아니라 stabilization phase다.
- Phase 8은 project operating-layer docs나 `.ai-ops/*`를 갱신하지 않는다.
- README pair는 English/Korean sibling으로 유지한다.
- Tauri dev smoke는 가능하면 수행하고, 환경 문제로 불가하면 자동 검증 결과와 미수행 사유를 남긴다.
