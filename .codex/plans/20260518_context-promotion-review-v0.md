# Context Promotion Review v0

## Summary

- `doc-impact`와 별개로, 작업 종료/커밋 직전에 “운영 지식 승격 후보”를 Codex가 검토하게 하는 v0를 추가한다.
- AI 판단은 새 global task skill `context-promotion-review`가 맡고, CLI는 fingerprint/receipt/hook gate만 담당한다.
- Receipt는 프로젝트 repo에 저장하지 않고 user-local store에 저장한다.
- Codex hook은 `git commit` 시 receipt가 없으면 commit을 막고, Codex가 skill로 review를 수행하도록 안내한다.

## Key Changes

- 새 global task skill: `context-promotion-review`
  - `supported_tools: ["codex"]`, `allow_implicit_invocation: false`.
  - 절차: `ai-ops context-promotion status` 확인 → 기존 context layer cross-check → `new / already-covered / no-promotion` 분류 → 사용자 승인 → 승인된 수정 적용 → `resolve` 실행 → `status` 재확인.
  - 후보 scope는 `core`, `project-local`, `global`, `no-promotion`.

- 새 CLI group: `ai-ops context-promotion`
  - `status [--json]`: 현재 git root, context-layer 존재 여부, diff fingerprint, receipt 유무 출력.
  - `resolve --decision <promoted|no-promotion> --summary <text> [--scope <core|project-local|global...>] [--target <path...>]`: 현재 diff fingerprint receipt 기록.
  - `prune [--max <number>]`: user-local receipt index를 최근 N개만 남김. 기본 50.
  - `hook pre-tool-use`: Codex hook 내부용. `git commit` 시 receipt 없으면 deny JSON 출력.

- 새 CLI group: `ai-ops codex-hook`
  - `install context-promotion`: `$CODEX_HOME/hooks.json` 또는 `$HOME/.codex/hooks.json`에 `PreToolUse` Bash hook entry를 병합 추가.
  - `status context-promotion`: hook 설치 여부 출력.
  - `uninstall context-promotion`: ai-ops가 추가한 hook entry만 제거.
  - 기존 hook 설정은 보존하고, JSON 파싱 실패 시 쓰기 없이 실패.

- Receipt store
  - 위치: `$AI_OPS_HOME/.ai-ops/context-promotion/projects/<projectKey>/receipts-index.json`, 없으면 `$HOME` 사용.
  - `projectKey`: git root absolute path hash.
  - `fingerprint`: `HEAD`, staged diff, unstaged diff, untracked file names/content hash를 합친 hash.
  - receipt 필드: `fingerprint`, `decision`, `scopes`, `targets`, `summary`, `resolvedAt`.
  - 같은 fingerprint는 교체한다.

## Hook Behavior

- `hook pre-tool-use`는 다음 경우 allow한다.
  - hook input이 `PreToolUse/Bash`가 아님.
  - command가 `git commit` 계열이 아님.
  - cwd/git root에 `.ai-ops/context-layer.json`이 없음.
  - 현재 fingerprint receipt가 있음.

- receipt가 없으면 deny한다.
  - deny reason은 Codex에게 `context-promotion-review` skill을 사용해 승격 후보를 검토하고, 사용자 결정 후 `ai-ops context-promotion resolve ...`를 실행하라고 안내한다.
  - hook은 승격 필요 여부를 판단하지 않는다.

## Test Plan

- Unit tests
  - fingerprint가 staged/unstaged/untracked 변경에 따라 바뀐다.
  - `status`가 receipt 유무를 올바르게 보고한다.
  - `resolve`는 summary 없이 실패하고 valid receipt만 user-local에 쓴다.
  - `prune`은 최근 N개만 남긴다.
  - hook command는 non-commit/non-ai-ops repo를 allow하고 unresolved ai-ops repo commit을 deny한다.
  - hook install/status/uninstall은 기존 `hooks.json`을 보존하고 중복 설치하지 않는다.

- Data/e2e tests
  - `context-promotion-review` skill registry/frontmatter/openai metadata가 통과한다.
  - skill 본문에 cross-check, 사용자 승인 전 편집 금지, resolve 실행, receipt 확인 계약이 포함된다.
  - `AI_OPS_HOME="$(mktemp -d)" ai-ops skill install context-promotion-review --tool codex`가 user home 아래에만 설치된다.
  - `npm run test`, `npm run build`, `npm run compile`.

## Assumptions

- v0는 Codex 전용이다.
- project-local receipt, UserPromptSubmit/PostToolUse logging, AI-based CLI review command는 구현하지 않는다.
- 기존 `doc-impact-reviewer`는 유지한다.
- Receipt는 source of truth가 아니라 commit gate 통과용 user-local 상태다.
- 실제 승격 판단과 문서 수정은 항상 Codex skill과 사용자 승인으로만 수행한다.
