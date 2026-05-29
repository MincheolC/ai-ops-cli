# 코드 철학 기준 리팩토링 계획

## Summary

- 전체 finding을 3개 구현 페이즈로 나누고, 각 페이즈마다 별도 커밋을 만든다.
- 목표는 동작 변경 없이 책임 경계를 드러내는 refactor다: public API, CLI command, JSON/schema 계약, UI 동작은 보존한다.
- 기존 dirty 상태인 operating-layer 문서/인덱스 변경과 untracked plan 파일은 건드리거나 stage하지 않는다.

## Key Changes

- Phase 1 commit: `refactor: split pc done handoff flow`
  - `pc/done.ts`는 public facade/orchestrator로 축소하고 `createPcDoneDraft`, `readPcDoneDraft`, `applyPcDoneDraft`, `PcDoneDraft` export 계약을 유지한다.
  - draft schema/normalization, markdown transform logic, apply preflight/path validation, git shell helper를 feature-local 모듈로 분리한다.
  - pure markdown update 함수는 side effect 없이 `FileUpdate[]`를 만들고, 파일 쓰기와 git add/commit은 imperative shell에만 둔다.

- Phase 2 commit: `refactor: split studio project surface`
  - `app.tsx`는 `App`, `StudioShell`, top-level query/store wiring, view routing만 남긴다.
  - project overview, audit, documents/markdown preview/inspector, project surface header를 별도 app-local components로 분리한다.
  - markdown HTML stripping/sanitize plugin은 preview 전용 helper로 이동하고 현재 `ReactMarkdown` sanitization 동작은 그대로 유지한다.

- Phase 3 commit: `refactor: split studio runtime views`
  - `runtime-view.tsx`는 runtime view routing과 `RuntimeView` export만 남긴다.
  - integrations, skills, subagents, hooks detail views를 분리하고 공통 presentational parts는 `runtime-view-parts` 성격의 app-local module로 모은다.
  - `RuntimeView` props와 `selectRuntimeItem` 사용 방식은 유지해서 `app.tsx` 쪽 호출부 동작을 바꾸지 않는다.

## Public Interfaces

- 유지: `apps/cli/src/features/pc/commands.ts`에서 import하는 `applyPcDoneDraft`, `createPcDoneDraft`.
- 유지: tests에서 import하는 `readPcDoneDraft`, `PcDoneDraft` shape, `PC_DONE_DRAFT_SCHEMA_VERSION`.
- 유지: Studio public component exports `App`, `StudioShell`, `RuntimeView`.
- 추가되는 모듈은 feature-local internal module로 취급하고 외부 package API로 노출하지 않는다.

## Test Plan

- Phase 1 후 실행:
  - `npm run lint`
  - `npm run test --workspace=apps/cli -- src/core/__tests__/pc-done.test.ts src/core/__tests__/pc-integration.test.ts`
  - `npm run build`
- Phase 2 후 실행:
  - `npm run lint`
  - `npm run test --workspace=apps/studio -- src/app/app.test.tsx`
  - `npm run build --workspace=apps/studio`
- Phase 3 후 실행:
  - `npm run lint`
  - `npm run test --workspace=apps/studio -- src/app/app.test.tsx src/studio-bridge/runtime-view-model.test.ts`
  - `npm run build --workspace=apps/studio`
- 최종 실행:
  - `npm test`
  - `npm run build`

## Acceptance Criteria

- production source에서 `pc/done.ts`, `app.tsx`, `runtime-view.tsx`가 각각 600줄 아래로 내려간다.
- 새로 생긴 production 파일은 특별한 사유 없이 400줄을 넘기지 않는다.
- TypeScript 원칙 유지: `interface`, `enum`, `any`, non-null assertion, raw string throw를 추가하지 않는다.
- React 원칙 유지: `React.FC`를 쓰지 않고 props는 readonly type alias로 둔다.
- 모든 페이즈 커밋은 해당 페이즈에서 수정한 source/test 파일만 stage한다.
