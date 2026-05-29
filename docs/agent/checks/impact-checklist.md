<!-- ai-ops:start -->
<!-- sourceHash: c2028f | generatedAt: 2026-05-29T10:05:25.578Z -->

---
status: Active
layer: agent
owner: ai-ops
read_when:
  - change_impact_analysis
  - before_finish
update_when:
  - impact_policy_changes
---
# Impact Checklist

- business rule, domain invariant, 상태 전이에 영향이 있는가?
- DB schema, migration, seed, data backfill, analytics event에 영향이 있는가?
- public API, GraphQL schema, CLI command, request/response, SDK contract가 바뀌는가?
- auth, permission, privacy, billing, credential, audit log에 영향이 있는가?
- external integration, webhook, cron, queue, cache, background job에 영향이 있는가?
- project-owned 문서, specs, runbook, operator guide, `docs/docs-status.md`, context-layer 갱신이 필요한가?

## 유지보수 점검 신호

다음 항목은 lint/test gate가 아니라 리팩토링 검토 신호다. 해당되면 변경을 끝내기 전에 분리, naming, test 위치를 한 번 확인한다.

- touched production file이 250줄을 넘는가?
- 새 기능을 400줄 이상 파일에 추가하는가?
- 같은 패턴이 세 번째 등장했는가?
- 한 변경이 서로 다른 책임의 section 3곳 이상을 건드리는가?

<!-- ai-ops:end -->
