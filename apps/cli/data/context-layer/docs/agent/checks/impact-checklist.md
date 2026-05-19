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
