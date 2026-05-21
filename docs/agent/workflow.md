<!-- ai-ops:start -->
<!-- sourceHash: ff653a | generatedAt: 2026-05-21T15:11:30.423Z -->

---
status: Active
layer: agent
owner: ai-ops
read_when:
  - before_task
update_when:
  - workflow_changes
---

# Workflow

이 문서는 에이전트의 기본 구현/검증 루프를 대체하지 않는다. 프로젝트별 문맥을 언제 읽고, 변경 영향과 문서 갱신 필요성을 언제 판단할지 정한다.

## 전역 guardrail

모든 단계에서 `docs/agent/rules/stop-rules.md`를 적용한다. 삭제, reset, credential 노출, 운영 데이터 접근, 계획과 코드 구조 충돌처럼 위험하거나 모호한 지점은 진행 전에 멈추고 확인한다.

## 판단 흐름

1. Intent Routing: 요청이 구현, 리뷰, 조사, 문서, 운영작업 중 무엇인지 분류하고 `docs/agent/rules/routing-rules.md`를 확인한다.
2. Context Loading: `AGENTS.md`, `docs/agent/rules/00-agent-baseline.md`, `docs/agent/workflow.md`, 관련 `Active` 문서, 실제 코드와 파일을 확인한다.
3. Change Impact Analysis: 변경 전후에 `docs/agent/checks/impact-checklist.md`를 사용해 영향 범위를 찾는다.
4. Native Agent Execution: 구현, 수정, 검증 선택은 에이전트(e.g. codex)의 기본 작업 루프와 repo의 기존 패턴을 따른다.
5. Context Update: 변경 결과가 project-owned 문서, specs, `docs/docs-status.md`, `.ai-ops/context-layer.json`에 영향을 주는지 판단한다.
6. Report: 결과, 실행한 검증, 갱신한 문서, 남은 리스크를 짧게 보고한다.

## 문서 사용 원칙

- `Active` 문서만 현재 판단 근거로 사용한다.
- `Reserved` 문서는 자리만 만든 문서이므로 현재 사실로 인용하지 않는다.
- project-owned 문서가 비어 있거나 stale하면 실제 코드, 설정, schema, runtime 파일을 우선한다.
- 문서 상태가 애매하면 `docs/docs-status.md`와 각 문서 frontmatter를 함께 확인한다.

## 보존 원칙

- 사용자 변경으로 보이는 diff는 되돌리지 않는다.
- project-owned 문서는 CLI update가 덮어쓰지 않는다.
- user/global integrations와 그 component는 project operating layer uninstall 대상이 아니다.

<!-- ai-ops:end -->
