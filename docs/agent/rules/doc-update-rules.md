<!-- ai-ops:start -->
<!-- sourceHash: c2028f | generatedAt: 2026-05-21T16:02:14.603Z -->

---
status: Active
layer: agent
owner: ai-ops
read_when:
  - document_change
update_when:
  - document_policy_changes
---
# Document Update Rules

## 갱신 기준

- 구현 동작이 바뀌면 해당 동작을 설명하는 `Active` 문서를 갱신한다.
- 문서 상태/frontmatter 관리는 모든 Markdown이 아니라 context-layer와 `docs/docs-status.md`에 등록된 operating-layer 문서를 기준으로 한다.
- `Reserved` 문서를 실제 판단 근거로 승격하려면 frontmatter와 `docs/docs-status.md`를 함께 갱신한다.
- 오래된 문서는 삭제보다 `Archived` 전환을 우선 검토한다.
- `docs/agent/project-rules/*.md`를 추가/수정할 때는 기존 `Active` agent rules와의 중복, 충돌 가능성, 적용 우선순위/조건을 함께 검토하고 필요한 경우 문서에 명시한다.

## 금지

- project-owned create-only 문서를 자동 update로 덮어쓰지 않는다.
- 도구 adapter에 canonical 운영 규칙을 중복 작성하지 않는다.

<!-- ai-ops:end -->
