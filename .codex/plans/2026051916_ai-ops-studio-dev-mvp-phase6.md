# Phase 6 구현 계획: Runtime Read-Only Views

## Summary

Phase 6는 user/global runtime assets를 Project docs와 분리된 read-only 영역으로 보여준다. 새 mutation은 만들지 않고, 기존 `studio snapshot`의 `runtime` payload를 Studio-local view model로 정규화해 `Integrations`, `Skills`, `Subagents`, `Hooks` 화면을 구현한다.

핵심 원칙:

- Runtime assets는 project operating documents처럼 보이면 안 된다.
- install/update/uninstall/hook edit 버튼은 만들지 않는다.
- Zustand에는 selected runtime item id 정도만 저장하고 snapshot payload는 저장하지 않는다.

## Key Changes

- Runtime nav를 실제 영역으로 전환한다.
  - Project: `Overview`, `Context Graph`, `Documents`, `Audit`
  - Runtime: `Integrations`, `Skills`, `Subagents`, `Hooks`
  - Settings: `Appearance` placeholder 유지
- `apps/studio/src/studio-bridge/runtime-view-model.ts`를 추가한다.
  - `runtime.available`, `unavailableReason`, runtime manifest source states를 정규화
  - integrations, skills, subagents, hooks를 안전하게 narrow
  - installed/total counts, missing installed paths, parse/unavailable state 요약
- Runtime UI는 `apps/studio/src/app/runtime-view.tsx`처럼 별도 파일로 분리한다.
  - `app.tsx`에 더 쌓기보다 Project/Audit shell에서 view routing만 한다.
  - 기존 shadcn `Badge`, `Button`, `Separator`, `Skeleton` 정도만 사용한다.
- Store 확장:
  - `selectedRuntimeItemId`
  - `setSelectedRuntimeItemId`
  - snapshot/runtime payload는 저장하지 않는다.

## Runtime Views

- `Integrations`
  - catalog integration 전체를 보여준다.
  - installed/not installed, installedAt/updatedAt 표시
  - components: `skill`, `codex-hook`, `receipt-config`
  - component별 installed, owned/pre-existing, catalog id 표시
  - receipt config는 catalog `storage_path`와 installed `storagePath`를 함께 보여준다.
- `Skills`
  - `reference` / `task` 기준으로 그룹화한다.
  - supported tools, groups, installed tools, installed paths, sourceHash 표시
  - installed path는 exists 여부만 표시하고 파일 내용은 읽지 않는다.
- `Subagents`
  - id, description, supported tools, installed tools, installed paths, sourceHash 표시
  - installed/not installed 상태를 명확히 표시한다.
- `Hooks`
  - known Codex hooks를 보여준다.
  - installed/not installed, hooksPath, statusMessage, error 표시
  - 관련 integration은 integration component의 `codex-hook` id 매칭으로 표시한다.
- Runtime unavailable state
  - `AI_OPS_HOME`/`HOME` 또는 `CODEX_HOME` 부재는 fatal UI가 아니라 read-only warning으로 표시한다.
  - catalog는 계속 보이되 installed state는 unavailable/missing으로 표시한다.

## Test Plan

- `runtime-view-model` tests
  - integrations installed/not installed 정규화
  - component owned/pre-existing 표시
  - receipt config storage path 표시
  - skills가 `reference` / `task`로 그룹화
  - subagent installed paths exists 상태 정규화
  - hooks가 related integration id를 매칭
  - runtime unavailable 상태에서도 catalog arrays를 유지
- App tests
  - `Integrations` nav가 Runtime 영역으로 표시된다.
  - install/update/uninstall/edit 버튼이 없다.
  - installed integration component health가 렌더링된다.
  - skills/subagents가 Project documents와 다른 Runtime copy/label로 표시된다.
  - hook installed/error 상태가 표시된다.
  - Runtime page에서 project document path navigation이 생기지 않는다.
- Validation
  - `npm run test --workspace=apps/studio`
  - `npm run build --workspace=apps/studio`
  - `npm run test --workspace=apps/cli`
  - `npm run build --workspace=apps/cli`
  - 가능하면 `npm run studio:dev` smoke로 installed/uninstalled runtime 상태를 확인한다.

## Review And Commit Checkpoint

리뷰 포인트:

- Runtime assets가 Project docs/Context Graph에 섞이지 않는지 확인한다.
- Runtime pages에 mutation action이 없는지 확인한다.
- hook/integration 관계가 snapshot data에서 read-only로만 파생되는지 확인한다.
- Phase 7 Appearance 구현이 섞이지 않았는지 확인한다.

권장 커밋 메시지: `feat(studio): add runtime read-only views`

## Assumptions

- Phase 6는 CLI snapshot contract를 변경하지 않는다.
- Usage analytics, telemetry, recommendation은 만들지 않는다.
- Runtime status는 installed manifest와 known hook status까지만 보여준다.
- 파일 존재 여부는 snapshot이 제공한 installed path state만 사용하고, Studio frontend가 직접 filesystem을 읽지 않는다.
