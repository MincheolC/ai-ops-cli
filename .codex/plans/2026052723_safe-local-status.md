# safe-local status false negative 수정 계획

## Summary

- `ai-ops codex-permissions status safe-local`이 EOF blank line 차이만으로 `config: not installed`를 출력하는 false negative를 고친다.
- `safe-local` permission profile, syntax selection, conflict handling, legacy rules/hook cleanup 동작은 유지한다.
- 사용자에게 보이는 변화는 semantically installed config가 `config: installed`로 표시되는 것이다.

## Key Changes

- `apps/cli/src/features/codex-permissions/config.ts`에 config 비교용 private helper를 추가한다.
  - 예: `normalizeConfigForManagedComparison(content)`는 EOF trailing whitespace/blank line만 정규화한다.
  - 내부 managed block 내용이나 다른 config 값 차이는 무시하지 않는다.
- `editConfigForInstall()`의 `changed` 판정을 raw `nextContent !== content` 대신 정규화 비교로 바꾼다.
  - EOF blank line만 다른 경우 `installed: true`, `changed: false`.
  - 실제 profile 내용, path, permission rule, default profile 차이는 계속 `changed: true`.
- `inspectConfig()`는 동일한 비교 기준을 사용해 `installed`를 계산한다.
  - conflict/warning 계산은 기존 그대로 유지한다.
  - fallback syntax가 선택된 경우 `warning: Codex runtime rejected...`는 계속 표시한다.
- `CHANGELOG.md`의 `[Unreleased]`에 `fix(codex-permissions)` 항목을 추가한다.

## Test Plan

- `apps/cli/src/core/__tests__/codex-permissions.test.ts`에 EOF blank line 회귀 테스트를 추가한다.
  - 설치된 config 끝에 빈 줄을 하나 더 추가한 뒤 `inspectCodexSafePermissions()`가 `config.installed === true`를 반환해야 한다.
  - 같은 상태에서 `installCodexSafePermissions()`를 다시 실행해도 `config.changed === false`이고 파일을 rewrite하지 않아야 한다.
- 과도한 정규화를 막는 guard 테스트를 추가한다.
  - managed block 내부 rule을 바꾸면, 예를 들어 `".git" = "read"`를 다른 값으로 바꾸면 `status.config.installed === false`여야 한다.
- 검증 명령:
  - `npm test --workspace=apps/cli -- codex-permissions`
  - `npm run build --workspace=apps/cli`
  - build 후 `node apps/cli/dist/bin/index.js codex-permissions status safe-local`로 실제 사용자 config가 `config: installed`로 보이는지 확인한다.

## Assumptions

- 이번 변경 범위는 `config: not installed` false negative 수정이다.
- `rules: installed` / `hook: installed` 문구의 의미 재설계는 별도 UX 정리로 남긴다.
- 현재 작업 트리에 있는 unrelated operating-layer dirty files는 건드리거나 되돌리지 않는다.
