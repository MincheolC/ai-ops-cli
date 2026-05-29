# Phase 2 구현 계획: getdesign Theme Intake

## Summary

Phase 2는 `apps/studio`의 **최소 theme asset package**만 먼저 만든다. Tauri/Vite/React 앱 shell은 Phase 3로 유지하고, 이번 단계에서는 getdesign 산출물을 안전하게 수집해 Studio가 나중에 소비할 bundled preset registry를 만든다.

- 대상 preset: `cohere`, `x.ai`, `vercel`, `clickhouse`, `hashicorp`, `sentry`, `cal`, `linear.app`, `framer`, `stripe`, `spotify`
- normalized id: `x.ai -> x-ai`, `linear.app -> linear-app`
- getdesign 산출물은 임시 디렉터리에서 먼저 확인한 뒤 repo에는 curated bundle만 반영한다.
- 참고 출처: [getdesign](https://www.getdesign.app/), [Cohere design-md 예시](https://getdesign.md/cohere/design-md), [getdesign package note](https://jspm-packages.deno.dev/package/getdesign)

## Key Changes

- `apps/studio`를 최소 workspace로 추가한다.
  - `package.json`, `tsconfig.json`, `vitest.config.ts`
  - React/Tauri/Vite/Tailwind/shadcn 의존성은 아직 추가하지 않는다.
- theme bundle 구조를 추가한다.
  - `src/theme/theme-preset-registry.ts`
  - `src/theme/theme-preset.types.ts`
  - `src/theme/generated/<preset-id>/DESIGN.md`
  - `src/theme/generated/<preset-id>/source-manifest.json`
- `source-manifest.json`에는 원본 slug, 실행 command, 생성 파일 목록, 포함 여부, checksum을 기록한다.
- registry는 각 preset에 대해 `id`, `sourceSlug`, `label`, `designMdPath`, `tokenMap`, `preview` metadata를 제공한다.
- token map은 shadcn CSS variable에 맞출 수 있는 형태로 두되, Phase 7 전까지 UI 적용은 하지 않는다.

## Implementation Flow

1. `/private/tmp` 아래 임시 작업 디렉터리를 만들고 각 command를 실행한다.
   - `npx getdesign@latest add cohere`
   - `npx getdesign@latest add x.ai`
   - 나머지 9개도 동일하게 실행
2. 각 slug별 생성 파일을 검사한다.
   - `DESIGN.md` 또는 이에 준하는 design-md 파일은 필수로 간주한다.
   - 예기치 않은 실행 파일, config, package 파일이 생기면 manifest에는 기록하되 bundle import 대상에서는 제외한다.
   - 특정 slug가 실패하면 임의 대체 없이 Phase 2를 중단하고 실패 slug를 보고한다.
3. repo에는 정규화된 preset id별로 raw design doc과 manifest를 저장한다.
4. pure TypeScript registry와 tests를 작성한다.
5. root `vitest.config.ts`에 `apps/studio` project를 포함해 `npm test`가 Studio theme tests도 보게 한다.

## Test Plan

- `npm run test --workspace=apps/studio`
  - 11개 preset id가 모두 존재한다.
  - preset id 중복이 없다.
  - `sourceSlug`와 normalized `id`가 정확하다.
  - 각 preset의 `DESIGN.md` path와 `source-manifest.json`이 존재한다.
  - 각 preset이 필수 token key를 모두 가진다.
- `npm test`
  - 기존 CLI tests와 새 Studio theme tests가 함께 통과한다.
- `npm run build --workspace=apps/cli`
  - Phase 2가 CLI snapshot contract를 깨지 않았는지 확인한다.

## Review And Commit Checkpoint

리뷰 포인트는 세 가지다.

- getdesign 산출물이 project operating layer나 CLI runtime data와 섞이지 않았는지 확인한다.
- `apps/studio`가 앱 shell이 아니라 theme asset package 범위에 머물렀는지 확인한다.
- 11개 preset 중 실패/누락/임의 대체가 없는지 확인한다.

권장 커밋 메시지: `feat(studio): add bundled getdesign theme presets`

## Assumptions

- Phase 2는 actual UI, theme switcher, Tauri shell을 만들지 않는다.
- Phase 2는 project docs, `.ai-ops/*`, user/global runtime manifest를 수정하지 않는다.
- `npx getdesign@latest ...` 실행은 네트워크가 필요하므로, 실제 구현 시 sandbox 제한이 걸리면 승인 요청 후 진행한다.
- 기존 untracked plan 파일들은 Studio Phase 2 커밋에 섞지 않는다.
