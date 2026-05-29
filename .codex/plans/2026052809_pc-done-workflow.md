# `$pc:done` Draft/Apply 워크플로 구현 계획

## Background

- 최근 handoff 로그에서 권한 prompt는 줄었지만, Codex가 `$pc:done` 전용 실행 표면을 찾지 못해 `ai-ops context-promotion --help` 계열을 탐색한 뒤 거대한 `node --input-type=module -e ...` 스크립트로 context 파일을 직접 수정했다.
- 이 방식은 AI 판단 자체는 유용했지만, quoting/newline 오류, 큰 문단 `replaceOnce`, 비표준 diff 검증, context repo commit 후 hook 재발화 같은 운영 위험을 남긴다.
- 목표는 AI가 handoff 내용을 판단하는 장점은 유지하고, 파일 반영/검증/커밋은 `ai-ops`가 안정적으로 수행하게 만드는 것이다.

## Key Changes

- 새 CLI group을 추가한다.
  - `ai-ops pc --help`: pc workflow와 subcommands를 보여준다.
  - `ai-ops pc status`: 현재 cwd 기준 pc workspace/workstream/current entry readiness를 보여준다.
  - `ai-ops pc done --help`: draft/apply 사용법을 보여준다.
  - `ai-ops pc done draft [--from-hook] [--cwd <path>]`
  - `ai-ops pc done apply --draft <draft-path>`
- help UX는 Codex가 바로 사용할 수 있게 구체적으로 쓴다.
  - `pc --help`에는 `$pc:todo`, `$pc:done` skill 관계를 설명하되, handoff 반영은 `draft -> AI fills draft -> apply` 순서라고 명시한다.
  - unknown `pc` subcommand는 context-promotion으로 유도하지 않고 `ai-ops pc --help`를 보게 한다.
- `draft`는 active pc workspace/workstream/current entry를 찾고, `~/.personal-project-contexts/workspaces/<workspace-id>/.ai-ops/drafts/pc-done-<timestamp>.json` skeleton을 생성한다.
- draft schema는 JSON + Zod로 고정한다.
  - metadata: `schemaVersion`, `workspaceId`, `workstreamId`, `currentEntryId`, `contextRoot`, `workspaceDir`, `productGitRoot`, `productHead`, `lastConfirmedCommitHash`, `generatedAt`.
  - AI 작성 필드: `completed`, `verification`, `remaining`, `nextAction`, `nextActionEvidence`, `blockers`, `durableContextDelta`.
  - `durableContextDelta`는 optional이며, 장기 맥락이 실제로 바뀔 때만 `workspace-state.md`의 `장기 결정`에 반영한다.
- `apply`는 deterministic하게 context repo만 갱신한다.
  - draft path가 `~/.personal-project-contexts` 밖이면 거부한다.
  - 현재 pc status, workspace/workstream/current entry, product HEAD가 draft metadata와 다르면 재생성을 요구하고 실패한다.
  - 허용 변경 파일은 `workspace-state.md`, `backlog.md`, active workstream file, `daily/YYYY-MM-DD.md`, draft status marker로 제한한다.
  - context repo에서만 stage/commit하고 product repo는 건드리지 않는다.
- hook/skill guidance를 바꾼다.
  - pc PostToolUse hook prompt는 “임시 JS 생성 금지, `ai-ops pc done draft`, draft 작성, `ai-ops pc done apply` 순서”를 명시한다.
  - hook은 commit이 `~/.personal-project-contexts` 안에서 발생한 경우 skip한다.
  - `$pc:done` skill 문서도 inline script 대신 draft/apply 프로토콜을 사용하도록 갱신한다.

## Test Plan

- unit tests
  - `ai-ops pc --help`와 `ai-ops pc done --help`가 subcommands와 draft/apply protocol을 노출한다.
  - ready pc context에서 `draft`가 올바른 경로와 metadata를 생성한다.
  - `apply`가 schema invalid, draft path escape, HEAD mismatch, workspace/workstream mismatch를 거부한다.
  - `apply`가 허용된 context 파일만 변경하고 product repo를 건드리지 않는다.
  - 같은 product HEAD draft를 다시 apply하면 중복 daily/workstream handoff를 만들지 않는다.
  - pc PostToolUse hook은 product repo commit에는 prompt를 만들고, context repo commit에는 skip한다.
- e2e/command tests
  - temp product repo + temp `~/.personal-project-contexts`에서 `ai-ops pc done draft` -> draft 채움 -> `apply` -> context repo commit까지 검증한다.
  - `ai-ops pc status`와 기존 `ai-ops integration status pc`의 readiness 출력이 서로 모순되지 않는지 확인한다.
- validation commands
  - `npm test --workspace=apps/cli -- pc`
  - `npm test --workspace=apps/cli -- integration`
  - `npm run build --workspace=apps/cli`
  - 가능하면 최종 `npm run check`

## Assumptions

- `ai-ops` CLI는 LLM을 호출하지 않는다. AI 판단은 Codex skill이 draft JSON을 채우는 방식으로 유지한다.
- v1은 post-commit hook의 실제 사용 흐름에 맞춰 current entry의 product HEAD handoff를 우선 지원한다.
- 기존 personal context 파일을 일괄 migration하지 않는다. 새 managed/idempotency marker는 새 handoff entry부터만 사용한다.
- context repo commit은 `$pc:done apply`의 일부로 유지하되, product repo commit과 절대 섞지 않는다.
