<!-- ai-ops:start -->
<!-- sourceHash: 9b0773 | generatedAt: 2026-05-19T14:56:02.318Z -->

---
status: Active
layer: agent
owner: ai-ops
read_when:
  - before_task
update_when:
  - operating_layer_changes
---
# Agent Operating Layer

이 파일은 이 프로젝트의 canonical agent entrypoint다. 도구별 adapter가 있더라도 운영 판단은 이 파일과 `docs/agent/*` 문서를 기준으로 한다.

## 읽기 순서

1. `AGENTS.md`
2. `docs/agent/rules/00-agent-baseline.md`
3. `docs/agent/workflow.md`
4. `docs/agent/terminology.md`
5. 나머지 `docs/agent/rules/*.md`
6. 변경 영향 확인이 필요하면 `docs/agent/checks/impact-checklist.md`
7. `docs/docs-status.md`

## 문서 신뢰도

- `Active`: 현재 판단 근거로 사용할 수 있다.
- `Reserved`: 자리만 만든 문서다. 프로젝트가 보강하기 전까지 현재 판단 근거로 사용하지 않는다.
- `Draft`: 작성 중인 문서다. 사용 전 검토가 필요하다.
- `Archived`: 과거 기록이다. 현재 운영 판단에 사용하지 않는다.

문서 상태가 애매하면 `docs/docs-status.md`와 각 문서 frontmatter를 함께 확인한다.

<!-- ai-ops:end -->
