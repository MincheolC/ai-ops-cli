<!-- ai-ops:start -->
<!-- sourceHash: f57bbf | generatedAt: 2026-05-18T14:27:41.415Z -->

---
status: Active
layer: agent
owner: ai-ops
read_when:
  - review
  - before_finish
update_when:
  - checklist_changes
---
# Review Checklist

- 계획 문서의 의도와 실제 diff가 어긋나는 지점이 있는가?
- 테스트가 잡지 못하는 런타임 회귀 위험이 있는가?
- create-only 파일과 managed section 파일의 보존 정책이 섞이지 않았는가?
- manifest, context-layer, 실제 파일 상태가 같은 기준으로 갱신되는가?
- 검증 명령이 변경 범위에 충분히 직접적인가?

<!-- ai-ops:end -->
