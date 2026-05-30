---
status: Active
layer: agent
owner: project
read_when:
  - codex_work
update_when:
  - codex_reference_changes
  - project_rule_changes
---
# Project Routing Rules

## Codex 작업

- Codex config, permissions, hooks, skills, rules/`AGENTS.md`, subagents/custom agents, non-interactive `codex exec`, best practices, sandbox 관련 작업은 `docs/references/codex/`의 관련 문서를 먼저 확인한다.
- `docs/references/codex/`는 이 repo 전용 reference 자료이며, 패키징/설치 대상 operating-layer template으로 취급하지 않는다.
- reference 문서와 현재 설치된 Codex 동작이 어긋나면 실제 로컬 `codex` 동작을 재현/검증한 결과를 우선한다.

## Studio 영향 확인

- registry, component type, CLI status/list output, schema field처럼 Studio snapshot/runtime view/UI에 노출되는 계약이 바뀌면 Studio 영향도 함께 확인한다.
