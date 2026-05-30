# Phase 1 구현 계획: `code-review-gate` 통합 생명주기 기반

## Summary

`ai-ops integration install code-review-gate`가 hook 없이 Codex subagent와 여러 task skill을 설치할 수 있도록 integration 시스템의 기반을 확장한다. 이 Phase는 실제 리뷰 skill/subagent 콘텐츠를 깊게 작성하지 않고, “hookless + subagent component + multiple skills + diff/update/status/uninstall”이 동작하는 생명주기 골격을 완성하는 범위다.

## Key Changes

- Integration schema에 `code-review-gate` id와 `subagent` component type을 추가한다.
- Integration catalog entry가 hook/receipt-config 없이도 유효하도록 완화한다.
- Integration definition을 단일 skill/hook 중심에서 다음 형태로 일반화한다:
  - skills: 0개 이상
  - subagents: 0개 이상
  - hooks: 0개 이상
  - receipt configs: 0개 이상
- `code-review-gate`는 Codex-only, hookless integration으로 등록한다.
- Hookless integration install/status/uninstall 경로에서는 `CODEX_HOME` hook/trust/receipt 전제에 접근하지 않는다.
- `integration diff`와 `integration update` 명령을 추가한다.
  - `diff`: 설치된 component와 catalog source hash/설치 상태를 비교해 변경, 누락, 최신 여부를 보여준다.
  - `update`: 이미 설치된 integration의 owned component를 현재 catalog 기준으로 재설치한다.
- 기존 `context-promotion`, `pc` integration 동작은 유지한다.

## Public CLI Behavior

- 추가/유지될 명령:
  - `ai-ops integration install code-review-gate`
  - `ai-ops integration status code-review-gate`
  - `ai-ops integration diff code-review-gate`
  - `ai-ops integration update code-review-gate`
  - `ai-ops integration uninstall code-review-gate`
- `code-review-gate` install 결과:
  - Codex skill component들이 `$CODEX_HOME/skills` 쪽에 설치된다.
  - Codex subagent component가 `$CODEX_HOME/agents` 쪽에 설치된다.
  - Codex hook은 설치하지 않는다.
  - hook trust prompt나 hook command merge는 발생하지 않는다.
- `status`는 hook 상태가 없음을 오류가 아니라 정상 상태로 표시한다.
- `uninstall`은 ai-ops가 owned로 설치한 skill/subagent만 제거하고, 사용자가 직접 만든 파일은 보존한다.

## Test Plan

- Schema/unit tests:
  - `subagent` component가 integration catalog에서 유효한지 검증한다.
  - hook 없는 integration entry가 유효한지 검증한다.
  - 기존 hook-based integration entry가 계속 유효한지 검증한다.
- Loader tests:
  - integration registry에 `code-review-gate`, `context-promotion`, `pc`가 모두 로드되는지 확인한다.
  - 기존 subagent loader 규칙과 Codex frontmatter name mismatch 허용이 깨지지 않는지 확인한다.
- E2E/temp home tests:
  - 임시 `AI_OPS_HOME`/`CODEX_HOME`에서 `integration install code-review-gate` 실행.
  - 설치 후 skills/subagent manifest와 설치 파일 존재 확인.
  - hook 파일이나 receipt config가 생기지 않는지 확인.
  - `status`, `diff`, `update`, `uninstall` 순서 검증.
- Regression tests:
  - `context-promotion`/`pc` install/status/uninstall 기존 테스트 유지.
  - hookless integration 때문에 기존 shared dispatcher/hook path가 깨지지 않는지 확인.
- Validation commands:
  - `npm test --workspace=apps/cli`
  - `npm run build --workspace=apps/cli`
  - `git diff --check`

## Assumptions

- Phase 1은 생명주기 인프라 구현 범위다. 실제 7개 review skill의 긴 리뷰 프롬프트와 최종 리뷰 품질 튜닝은 Phase 2에서 작성한다.
- `code-review-gate`는 v1에서 Codex-only로 간다.
- hook/auto-review는 v1 범위에서 제외한다.
- 사용자가 명시적으로 `code-review-gate` 리뷰를 요청할 때만 실행되는 explicit-only 설계를 유지한다.
