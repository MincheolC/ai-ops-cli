# Codex Hook/Runtime 개선 계획

## Summary

- 이번 개선은 이전 리뷰의 네 가지 항목을 모두 반영한다: post-commit hook 충돌 제거, hook trust 상태 안내, Windows hook command override 지원, Codex subagent name 호환성 완화.
- `safe-local` permission profile 본체는 유지한다. 최신 문서와 이미 맞는 구조이므로 이번 범위에서는 회귀 방지 테스트만 간접적으로 통과시키면 된다.
- `context-promotion`과 `pc`가 동시에 필요한 커밋에서는 하나의 통합 prompt로 합치고, 순서는 `context-promotion` 먼저, 그다음 `$pc:done`으로 고정한다.

## Key Changes

- PostToolUse hook을 통합 dispatcher로 전환한다.
  - 새 hidden entrypoint: `ai-ops integration hook post-tool-use --workflows context-promotion,pc`.
  - installer는 기존 개별 hook command들을 제거하고, 하나의 `PostToolUse`/`^Bash$` handler만 유지한다.
  - `integration install pc`, `integration install context-promotion`, `codex-hook install context-promotion`은 shared hook의 workflow 목록을 merge한다.
  - uninstall은 해당 workflow만 제거하고, 남은 workflow가 없을 때만 shared hook handler를 삭제한다.
  - dispatcher는 성공한 `git commit`을 한 번만 파싱하고, workflow 목록에 있는 evaluator만 실행한다. 둘 다 출력이 있으면 하나의 `decision: "block"` 응답으로 병합한다.

- Hook trust UX를 명확히 한다.
  - install/status 출력에 “configured, but non-managed hooks still require `/hooks` trust review before they run” 계열 안내를 추가한다.
  - Studio runtime snapshot의 hook 상태에도 `trustReviewHint` 같은 nullable string 필드를 추가한다.
  - Codex 내부 trust 저장소는 읽지 않는다. 현재 구현은 “configured 여부”만 확정하고 “trusted 여부”는 Codex `/hooks`가 authoritative 하다는 전제로 둔다.

- Windows hook command override를 지원한다.
  - CLI 옵션 추가: `--command-windows <command>` for `codex-hook install` and `integration install`.
  - hook JSON handler에 값이 있을 때만 `commandWindows`를 쓴다.
  - `command`와 `commandWindows` 모두 해당 ai-ops hook marker를 포함해야 한다. 누락 시 install을 실패시킨다.
  - 기존 macOS/Linux 사용자는 옵션을 쓰지 않으면 현재와 동일한 JSON을 얻는다.

- Codex subagent name schema를 완화한다.
  - catalog id, install path, manifest id, `skill_names`는 계속 kebab-case로 유지한다.
  - Codex frontmatter의 `name`만 별도 schema로 분리해 ASCII letter/digit/hyphen/underscore를 허용한다.
  - `.codex/agents/<catalog-id>.toml` 파일명은 그대로 catalog id를 쓰고, 내부 `name`은 Codex가 spawn할 agent name의 source of truth로 렌더링한다.

## Public Interfaces / Types

- `CodexHookDefinition`/install option 계열에 shared workflow 목록과 optional `commandWindows`를 표현할 수 있게 확장한다.
- `CodexHookStatusResult` 또는 Studio hook snapshot schema에 trust 안내용 nullable field를 추가한다.
- `integration hook post-tool-use [legacyIntegrationId]`는 기존 `pc` 호출을 호환 처리하되, 새 installer가 쓰는 기본 command는 `--workflows ...` dispatcher 형태로 바꾼다.
- `CodexSubagentFrontmatterSchema.name`은 `SubagentIdSchema` 대신 새 `CodexAgentNameSchema`를 사용한다.

## Test Plan

- Unit tests:
  - shared hook install이 기존 `context-promotion hook post-tool-use`와 `integration hook post-tool-use pc`를 제거하고 하나의 dispatcher handler로 합치는지 검증.
  - workflow merge/reinstall idempotency, workflow별 uninstall, 마지막 workflow 제거 시 handler 삭제를 검증.
  - dispatcher가 두 evaluator 출력이 모두 있을 때 context-promotion section을 먼저 두고 하나의 `decision: "block"`만 출력하는지 검증.
  - `--command-windows`가 `commandWindows`를 쓰고 marker 누락을 거부하는지 검증.
  - Codex subagent `name = "pr_explorer"`는 허용하고 catalog id `pr_explorer`는 계속 거부하는지 검증.

- E2E/smoke tests:
  - temp `AI_OPS_HOME`/`CODEX_HOME`에서 `integration install context-promotion` 후 `integration install pc`를 실행하고 `hooks.json`에 shared dispatcher handler가 하나만 있는지 확인.
  - `integration status`와 `codex-hook status` 출력에 hook trust 안내가 포함되는지 확인.
  - `integration uninstall pc` 후 context-promotion workflow는 남고, 마지막 workflow uninstall 후 hook handler가 사라지는지 확인.
  - 기존 validation surface: `npm run build --workspace=apps/cli`, targeted tests for hook/integration/subagent, `npm test --workspace=apps/cli -- src/__tests__/e2e.test.ts`, `node apps/cli/dist/bin/index.js audit`, `git diff --check`.

## Assumptions

- 이번 변경은 기능 구현까지 포함하는 후속 작업의 계획이며, 현재 Plan Mode에서는 파일을 수정하지 않는다.
- 두 workflow가 동시에 필요하면 `context-promotion`을 먼저 처리하고, receipt 정리 뒤 `$pc:done` handoff를 진행한다.
- Codex hook trust 여부는 ai-ops가 직접 판정하지 않고, 사용자가 Codex `/hooks`에서 확인해야 하는 상태로 안내한다.
- Windows 지원은 optional override 제공까지로 제한하며, Windows용 기본 command를 자동 생성하지 않는다.
