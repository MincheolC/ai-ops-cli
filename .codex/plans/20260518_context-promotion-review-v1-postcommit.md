# Context Promotion Review v0.1: Post-Commit Follow-Up

## Summary

- `git commit`을 막던 `PreToolUse` gate를 제거하고, `PostToolUse` 기반 후속 리뷰로 바꾼다.
- 작업 커밋은 그대로 진행되며, 커밋 성공 후 Codex가 `context-promotion-review`를 사용해 승격 후보를 검토한다.
- 승격이 필요하면 Codex는 파일만 수정하고 사용자 검사 대기 상태로 멈춘다. 승격 커밋은 사용자가 별도로 요청할 때만 만든다.

## Key Changes

- Hook 설치는 `PreToolUse` 대신 `PostToolUse` Bash hook을 추가한다. 공식 Codex Hooks 기준으로 `PostToolUse decision: "block"`은 커밋을 되돌리지 않고, hook 메시지로 모델을 이어서 실행시키는 용도로 쓴다: https://developers.openai.com/codex/hooks
- Hook command 기본값은 npm global 설치를 전제로 `ai-ops context-promotion hook post-tool-use`를 저장한다. 비표준 PATH 환경은 `--command` override로 처리한다.
- `codex-hook install context-promotion`은 `context-promotion-review` Codex skill도 user-local global 위치에 보장 설치한다.
- `context-promotion hook pre-tool-use`는 새 설치 경로에서 제거하고, `context-promotion hook post-tool-use`를 추가한다.
- 새 hook은 `git commit` 계열 Bash 명령 뒤에만 동작한다. `.ai-ops/context-layer.json`이 없는 repo에서는 아무 출력 없이 통과한다.
- receipt는 diff gate용이 아니라 “현재 `HEAD` 커밋에 대해 promotion review를 처리했다”는 user-local 기록으로 바꾼다. receipt에는 기존 `fingerprint`와 함께 `commitHash`를 추가한다.
- `context-promotion-review` skill 절차를 “커밋 직전 diff 검토”에서 “방금 만든 `HEAD` 커밋 검토”로 바꾼다. 필수 확인 명령은 `git show --stat HEAD`, `git show --name-only HEAD`, 필요 시 `git show HEAD`, 기존 context layer cross-check다.
- skill 보호 규칙에 “승격 수정 후 직접 커밋 금지, 사용자 검사 대기”를 명시한다.
- docs/README/playbook의 “commit gate / before commit / retry commit” 표현을 “post-commit review / separate promotion change”로 갱신한다.

## Public Interface Changes

- CLI 유지:
  - `ai-ops context-promotion status`
  - `ai-ops context-promotion resolve`
  - `ai-ops context-promotion prune`
  - `ai-ops codex-hook install|status|uninstall context-promotion`
- CLI 추가:
  - `ai-ops context-promotion hook post-tool-use`
- CLI deprecated:
  - `ai-ops context-promotion hook pre-tool-use`
- Hook config:
  - `codex-hook install context-promotion`은 `PostToolUse` entry를 설치한다.
  - 기본 command는 `ai-ops context-promotion hook post-tool-use`다.
  - `--command <command>`로 custom command를 저장할 수 있다.
  - uninstall은 legacy `PreToolUse`와 새 `PostToolUse`의 ai-ops entry를 모두 제거한다.
  - status는 새 `PostToolUse` 설치 여부와 `context-promotion-review` Codex skill 설치 여부를 함께 보고한다.

## Test Plan

- Unit tests:
  - `PostToolUse` hook은 non-commit, non-Bash, non-ai-ops repo에서 출력 없이 통과한다.
  - `PostToolUse` hook은 ai-ops repo의 `git commit` 후 review continuation JSON을 출력한다.
  - `PostToolUse` hook output은 `decision: "block"`과 `hookSpecificOutput.hookEventName: "PostToolUse"`를 포함한다.
  - `resolve`는 현재 `HEAD` commit hash가 포함된 receipt를 user-local store에 기록한다.
  - `status`는 현재 `HEAD` receipt 유무를 올바르게 보고한다.
  - hook install/status/uninstall은 기존 hooks를 보존하고, legacy PreToolUse entry를 중복/잔존시키지 않는다.
  - hook install은 portable default command를 쓰고, `--command` override를 반영한다.
- Data/e2e tests:
  - `context-promotion-review` skill 본문에 `git show --stat HEAD`, `git show --name-only HEAD`, 사용자 승인 전 편집 금지, 직접 커밋 금지, receipt 확인 계약이 포함된다.
  - `AI_OPS_HOME="$(mktemp -d)" CODEX_HOME="$(mktemp -d)" ai-ops codex-hook install context-promotion`은 user-local hook과 skill만 설치하고 cwd를 건드리지 않는다.
- Verification:
  - `npm test`
  - `npm run check`
  - `npm run build`
  - `npm run compile`
  - temp hooks file로 `install -> status -> uninstall` smoke

## Assumptions

- 기존 사용자는 사용자 한 명뿐이므로 legacy PreToolUse migration은 “제거 가능” 중심으로 단순화한다.
- hook은 AI 판단을 하지 않는다. 판단은 항상 `context-promotion-review` skill과 사용자 승인으로만 한다.
- 승격 수정은 작업 커밋과 같은 커밋에 섞지 않는다.
- 승격 수정 후 자동 커밋하지 않는다. Codex는 수정 완료 후 사용자 검사 요청으로 멈춘다.
