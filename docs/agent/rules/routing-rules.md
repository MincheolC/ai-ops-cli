<!-- ai-ops:start -->
<!-- sourceHash: c2028f | generatedAt: 2026-05-21T16:02:14.603Z -->

---
status: Active
layer: agent
owner: ai-ops
read_when:
  - before_task
update_when:
  - routing_changes
---
# Routing Rules

## 판단 순서

1. 요청이 코드 변경인지, 리뷰인지, 문서 정리인지 구분한다.
2. repo 내부의 계획 문서가 지정되면 실제 diff와 직접 비교한다.
3. 외부 사실이나 최신 정보가 필요한 경우 현재 출처를 확인한다.
4. 프로젝트 문서가 `Reserved`이면 현재 사실로 인용하지 않는다.

## 범위

- project scope: `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `docs/agent/*`, `docs/business/*`, `docs/docs-status.md`, `.ai-ops/*`
- integration scope: user/global runtime integrations and their components
- component scope: skills, subagents, Codex hooks, hook runners, user-local receipts/config

<!-- ai-ops:end -->
