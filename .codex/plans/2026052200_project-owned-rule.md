# Project-Owned Agent Rules 개선안

## Summary

`docs/agent/rules/*`는 계속 `ai-ops managed` baseline으로 유지하고, 프로젝트별 agent 규칙은 `docs/agent/project-rules/*.md`에 둔다. `docs/references/codex/`는 패키징/설치 대상이 아니라 이 repo 전용 reference 자료로만 유지하며, 이 repo의 project-owned rule이 필요할 때 참조하도록 한다.

## Key Changes

- `AGENTS.md` managed template의 읽기 순서에 `docs/agent/project-rules/*.md` slot을 추가한다.
- `docs/agent/project-rules/`는 `owner: project`, `status: Active` 가능한 custom agent rule 영역으로 정의한다.
- `docs/business/*`는 그대로 business/domain project-owned 문서로 유지하고, `docs/agent/project-rules/`로 옮기지 않는다.
- `docs/references/codex/`는 package/install template에 포함하지 않는다. 이 repo에서 Codex 관련 구현을 할 때 참고하는 local reference로만 둔다.

## Implementation Changes

- lifecycle/audit가 `docs/agent/project-rules/**/*.md` 중 frontmatter가 있는 문서를 custom project-owned context doc으로 발견하고 추적하게 한다.
- `.ai-ops/context-layer.json`과 `docs/docs-status.md`는 발견된 custom project-owned rule 문서를 반영한다.
- `ai-ops update --force`는 `docs/agent/project-rules/*` 내용을 덮어쓰지 않는다.
- managed `doc-update-rules.md`에는 project-owned agent rule 추가/수정 시 기존 Active agent rules와 중복, 충돌, precedence를 검토해야 한다는 규칙을 추가한다.
- 이 repo에는 첫 project-owned rule로 `docs/agent/project-rules/routing-rules.md`를 추가하고, Codex config/permissions/hooks/skills/agents/sandbox 작업 시 `docs/references/codex/`를 먼저 확인하되 실제 로컬 `codex` 동작 검증을 우선한다는 규칙을 둔다.

## Test Plan

- `ai-ops init/update --force/audit/diff`에서 managed rules는 갱신되고 project-rules 내용은 보존되는지 검증한다.
- frontmatter 있는 `docs/agent/project-rules/routing-rules.md`가 context-layer/docs-status에 반영되는지 확인한다.
- `docs/references/codex/`가 package/install 대상에 포함되지 않는지 pack/build 테스트로 확인한다.
- rule conflict review 문구가 managed template과 설치된 docs에 반영되는지 테스트한다.

## Assumptions

- `docs/references/codex/`는 이 repo 전용 참고 자료이며, 다른 프로젝트 operating layer에 설치하지 않는다.
- project-owned agent rules는 의미별 파일명으로 추가한다. 예: `routing-rules.md`, `testing-rules.md`.
- 충돌이 있는 project rule은 baseline을 조용히 덮지 않고 적용 조건이나 precedence를 명시한다.
