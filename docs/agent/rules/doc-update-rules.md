<!-- ai-ops:start -->
<!-- sourceHash: 3f6980 | generatedAt: 2026-05-16T11:06:18.637Z -->

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
- `Reserved` 문서를 실제 판단 근거로 승격하려면 frontmatter와 `docs/docs-status.md`를 함께 갱신한다.
- 오래된 문서는 삭제보다 `Archived` 전환을 우선 검토한다.

## 금지

- project-owned create-only 문서를 자동 update로 덮어쓰지 않는다.
- 도구 adapter에 canonical 운영 규칙을 중복 작성하지 않는다.

<!-- ai-ops:end -->
