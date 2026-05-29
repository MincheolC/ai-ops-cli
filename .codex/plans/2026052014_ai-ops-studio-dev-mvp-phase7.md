# Phase 7 구현 계획: Appearance And Theme Switcher

## Summary

Phase 7는 Studio의 읽기 경험을 사용자가 조정할 수 있게 한다. 범위는 `apps/studio` 내부의 appearance preference, theme preset 적용, Markdown preview 조정, Appearance 화면 구현까지다. CLI snapshot, Tauri command, project/runtime files는 변경하지 않는다.

결정 사항:

- **Preset 우선**: 각 getdesign preset의 원래 light/dark 성격을 유지한다.
- `light/dark/system`은 synthetic palette를 만들지 않고, UI mode metadata와 preset 추천/표시에 사용한다.
- Theme preference는 app-local `localStorage`에만 저장한다.

## Key Changes

- Appearance preference store를 추가한다.
  - `presetId`
  - `colorMode: "system" | "light" | "dark"`
  - `density: "comfortable" | "compact"`
  - `markdownSize: "small" | "medium" | "large"`
  - `codeBlockStyle: "filled" | "outline"`
- Zustand `persist` middleware를 사용한다.
  - storage key: `ai-ops-studio.appearance.v1`
  - invalid persisted values는 default로 복구
  - snapshot/project/runtime payload는 저장하지 않는다.
- Theme application hook/provider를 추가한다.
  - selected preset `tokenMap`을 `document.documentElement` CSS variables로 적용
  - `data-theme-preset`, `data-color-mode`, `data-density`, `data-markdown-size`, `data-code-block-style` attribute 설정
  - system mode는 `matchMedia("(prefers-color-scheme: dark)")`로 effective mode만 계산
- `Appearance` nav를 placeholder에서 실제 view로 전환한다.
  - 11개 bundled preset selector
  - swatch preview
  - preset-native appearance badge
  - color mode segmented control
  - density / Markdown size / code block style controls
- Top bar에 selected theme badge를 추가한다.
  - 현재 preset label
  - preset-native light/dark/mixed 표시

## CSS Behavior

- 기존 shadcn CSS variable names를 유지한다.
  - `--background`, `--foreground`, `--card`, `--primary`, `--accent`, `--border`, etc.
- compact density는 주요 shell/list/card spacing을 줄인다.
  - layout width/height가 갑자기 흔들리지 않도록 stable min sizes 유지
- Markdown size는 `.markdown-preview`에만 적용한다.
  - body UI font-size는 viewport 기반으로 바꾸지 않는다.
- code block style:
  - `filled`: 현재처럼 dark filled block
  - `outline`: card/background 기반 outline block
- generated shadcn components는 직접 수정하지 않는다.

## Test Plan

- Store/unit tests
  - default preference가 `cohere`, `system`, `comfortable`, `medium`, `filled`로 시작한다.
  - preset switching이 11개 bundled preset id를 모두 허용한다.
  - invalid persisted preset/mode/density 값은 default로 복구한다.
  - preference store에 snapshot/project/runtime payload가 없다.
- Theme application tests
  - selected preset token이 root CSS variable로 적용된다.
  - `x-ai` 선택 시 `data-theme-preset="x-ai"`와 해당 token이 적용된다.
  - compact density가 `data-density="compact"`로 반영된다.
  - Markdown size/code block style data attribute가 반영된다.
- App tests
  - Appearance nav가 실제 화면을 연다.
  - 11개 preset이 selector에 보인다.
  - preset 변경 후 Top bar badge가 갱신된다.
  - localStorage persistence 후 rerender에도 preference가 유지된다.
  - theme 변경 중 install/update/uninstall 같은 runtime mutation control이 생기지 않는다.
- Validation
  - `npm run test --workspace=apps/studio`
  - `npm run build --workspace=apps/studio`
  - `npm run test --workspace=apps/cli`
  - `npm run build --workspace=apps/cli`
  - 가능하면 `npm run studio:dev`에서 compact/comfortable, light/dark/system, Markdown preview를 시각 smoke한다.

## Review And Commit Checkpoint

리뷰 포인트:

- Theme 변경이 project files, `.ai-ops/*`, user/global runtime manifests를 쓰지 않는지 확인한다.
- `Preset 우선` 원칙대로 synthetic color derivation이 들어가지 않았는지 확인한다.
- Markdown readability가 Project Documents view에 실제 반영되는지 확인한다.
- Phase 8 hardening/docs 작업이 섞이지 않았는지 확인한다.

권장 커밋 메시지: `feat(studio): add appearance preferences`

## Assumptions

- Phase 7는 local theme import를 만들지 않는다.
- Phase 7는 getdesign asset을 다시 생성하지 않는다.
- Phase 7는 packaged desktop app 설정을 바꾸지 않는다.
- Theme preference는 app-local browser storage만 사용한다.
