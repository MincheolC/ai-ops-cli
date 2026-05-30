# `ai-ops-project-owned-docs` Task Skill 추가 계획

## Summary

`ai-ops-project-owned-docs`를 Codex 전용 explicit-only task skill로 추가한다. 이 스킬은 사용자가 준 운영 지식 후보를 project-owned agent docs 어디에 저장할지 판단하고, 사용자 승인 후 승인된 project-owned 문서만 수정하며, 필요한 경우 `docs/docs-status.md` / `.ai-ops/context-layer.json` 동기화와 audit까지 안내한다. `context-promotion-review`는 이번 범위에서 변경하지 않는다.

## Key Changes

- 새 task skill을 추가한다.
  - Skill id/path: `ai-ops-project-owned-docs`
  - Supported tools: `["codex"]`
  - Group: `["agent-operating-layer"]`
  - Codex metadata: `policy.allow_implicit_invocation: false`
  - Claude/Gemini 지원은 v1 범위 밖이다.

- 스킬 계약을 다음 흐름으로 고정한다.
  - 입력 예: “Studio도 구현 계획 때 고려”, “좀 전에 해결한 OOO issue”, “전체 대화”
  - 먼저 현재 프로젝트의 `AGENTS.md`, `docs/docs-status.md`, `.ai-ops/context-layer.json`, project-owned docs만 읽는다.
  - 분류: `project-rule`, `project-map/runbook`, `business-doc`, `status-sync-only`, `no-doc-change`
  - 보고: 추천 위치, 쓰면 안 되는 위치, 이유, 제안 문구, 필요한 동기화, 사용자 승인 질문
  - 사용자 승인 전 파일 수정 금지
  - 승인 후에는 project-owned 문서만 수정하고, managed baseline docs나 adapter docs에는 규칙을 복제하지 않는다.

- 스킬의 문서 배치 규칙을 명시한다.
  - repo/project 전용 agent 규칙은 `docs/agent/project-rules/*.md`를 우선한다.
  - 소비자 프로젝트 공통 template 성격이 아닌 내용은 `docs/agent/rules/*`, `docs/agent/checks/*`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`에 넣지 않는다.
  - `Reserved` 문서를 `Active`로 승격하거나 새 project-owned doc을 만들 필요가 있으면, frontmatter와 `docs/docs-status.md` / context-layer 동기화까지 제안하고 승인받는다.
  - `ai-ops update`와 `ai-ops audit`이 가능한 프로젝트에서는 승인된 수정 후 동기화와 audit을 수행하도록 안내한다.

- 관련 문서/registry를 갱신한다.
  - `skill-registry.json`에 새 task skill을 등록한다.
  - `apps/cli/data/skills/README.md` / `README.ko.md`의 Operating Task Skills 섹션에 한 줄 사용 설명을 추가한다.
  - 기존 `context-promotion-review`, `doc-impact-reviewer` 동작은 변경하지 않는다.

## Test Plan

- `rule-data.test.ts`에 계약 테스트를 추가한다.
  - registry entry가 존재하고 `kind: task`, `supported_tools: ["codex"]`, `groups: ["agent-operating-layer"]`인지 확인
  - `agents/openai.yaml`이 `allow_implicit_invocation: false`인지 확인
  - `SKILL.md`가 project-owned 범위, 사용자 승인 전 편집 금지, managed baseline docs 편집 금지, `docs/agent/project-rules`, `docs/docs-status.md`, `.ai-ops/context-layer.json`, `ai-ops update`, `ai-ops audit` 계약을 포함하는지 확인

- 실행 검증:
  - `npm test --workspace=apps/cli -- src/core/schemas/__tests__/rule-data.test.ts`
  - `npm run build --workspace=apps/cli`
  - `git diff --check`

## Assumptions

- v1은 Codex 전용으로 시작한다.
- v1은 project-owned docs placement/editing specialist이며 post-commit receipt workflow를 대체하지 않는다.
- 현재 워킹트리에 release/generated docs/publish-script 관련 변경이 남아 있으므로, 구현 시 기존 변경을 되돌리지 않고 새 skill 관련 변경만 추가한다.
