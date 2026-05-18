# ai-ops Integration Framework + pc Integration 구현 계획

## Summary

- `ai-ops integration` 상위 명령을 추가하고, v1 지원 integration은 `context-promotion`, `pc` 두 개로 둔다.
- `context-promotion`은 기존 skill+Codex hook 흐름을 상위 UX로 감싼다.
- `pc`는 `spec-to-packet/skills/pc`를 ai-ops task skill로 이전하고, 성공한 `git commit` 직후 `$pc:done`을 이어서 수행하게 하는 Codex `PostToolUse` hook을 제공한다.
- 기존 untracked `.codex/plans/2026051823_ai-ops-integration.md`는 이번 구현 커밋에 포함하지 않는다.

## Public Interface

- 새 CLI:
  - `ai-ops integration list`
  - `ai-ops integration install <context-promotion|pc> [--command <command>]`
  - `ai-ops integration status <context-promotion|pc>`
  - `ai-ops integration uninstall <context-promotion|pc>`
  - internal hook runner: `ai-ops integration hook post-tool-use pc`
- 새 user-local state:
  - `AI_OPS_HOME/.ai-ops/integrations-manifest.json`
  - 설치한 integration id, cliVersion, generatedAt, owned components를 기록한다.
- `--command`는 Codex hook command override다. `context-promotion`은 기존 marker를, `pc`는 `integration hook post-tool-use pc` marker를 포함해야 한다.
- 기존 low-level 명령 `skill`, `subagent`, `codex-hook`, `context-promotion`은 그대로 유지한다.

## Implementation Changes

- Integration catalog/schema를 추가한다.
  - `apps/cli/data/integrations/integration-registry.json`에 `context-promotion`, `pc`를 등록한다.
  - schema는 `skill`, `codex-hook`, `receipt/config` component를 표현하되 v1 구현은 skill+hook 중심으로 둔다.
- Integration manifest IO를 추가한다.
  - install 시 component가 이미 있었으면 `owned: false`, 이번 install이 생성/변경했으면 `owned: true`로 기록한다.
  - uninstall은 manifest에서 `owned: true`인 component만 제거한다.
  - receipt history와 `~/.personal-project-contexts`는 uninstall 대상이 아니다.
- Codex hook core를 generic하게 확장한다.
  - 현재 context-promotion 전용 marker/install/remove 로직을 hook definition 기반으로 바꾸고 기존 API는 compatibility wrapper로 유지한다.
  - 여러 PostToolUse hook이 공존하도록 기존 그룹을 보존하고 해당 marker만 upsert/remove한다.
- `pc` skill을 이전한다.
  - `apps/cli/data/skills/task-skills/pc/**`에 `SKILL.md`, `agents/openai.yaml`, `references/templates.md`를 복사한다.
  - `skill-registry.json`에 `pc`를 `kind: "task"`, `supported_tools: ["codex"]`, `groups: ["agent-operating-layer"]`로 등록한다.
- `pc` hook evaluator를 추가한다.
  - Bash `git commit` 성공만 감지한다. 기존 git commit parser/failure detector를 재사용하거나 공통 helper로 분리한다.
  - 가벼운 preflight만 수행한다: `~/.personal-project-contexts` 존재, current cwd/git root와 matching workspace, active workstream ID 존재.
  - preflight 실패 시 아무 output 없이 skip한다.
  - preflight 통과 시 Codex `decision:"block"` JSON으로 `$pc:done` continuation prompt를 출력한다.
  - prompt는 `$pc:init`, `$pc:add`, `$pc:do` 자동 생성 금지, 준비 안 된 repo/current repo out of scope/already recorded HEAD면 skip, product repo 수정 금지를 명시한다.
  - 같은 HEAD 중복 여부는 hook receipt가 아니라 `$pc:done` skill의 last confirmed commit 기준으로 판단한다.
- Docs를 갱신한다.
  - README/package README에 실제 `integration` 명령을 current surface로 승격한다.
  - `docs/plan.md`와 `docs/implementation-playbook.md`에 v1 command/manifest/ownership/uninstall 계약을 반영한다.
  - `apps/cli/package.json` description은 유지 또는 새 wording과 일치시킨다.

## Test Plan

- Unit/schema:
  - integration catalog/manifest parse/serialize/path tests.
  - owned component uninstall safety tests.
  - Codex hook generic upsert/remove가 context-promotion 기존 behavior를 깨지 않는지 테스트.
  - pc hook evaluator: non-Bash, failed commit, no context store, no active workstream, matching active workstream, successful commit prompt.
- E2E:
  - `integration list`에 `context-promotion`, `pc` 표시.
  - `integration install pc`가 `AI_OPS_HOME/.agents/skills/pc/**`, `CODEX_HOME/hooks.json`, integrations manifest만 만들고 cwd를 건드리지 않음.
  - `integration status pc`가 skill/hook/manifest 상태를 보여줌.
  - `integration uninstall pc`가 owned skill/hook만 제거하고 `~/.personal-project-contexts`는 보존.
  - `integration install context-promotion`이 기존 codex-hook install과 동일하게 skill+hook을 설치하고 기존 e2e 기대를 유지.
- Final verification:
  - `npm run check`
  - `npm run build`
  - temp `AI_OPS_HOME` + `CODEX_HOME` smoke for both integrations
  - `ai-ops diff` / `ai-ops audit` if operating-layer docs are updated

## Assumptions

- v1 integration은 Codex 중심이다. `--tool`은 추가하지 않는다.
- `pc` context store root는 기존 skill 계약대로 `~/.personal-project-contexts/`다.
- Integration manifest는 ownership 추적용이며 component source of truth는 기존 skill/subagent/hook state를 계속 존중한다.
- 기존 manually installed component는 integration uninstall이 제거하지 않는다.
