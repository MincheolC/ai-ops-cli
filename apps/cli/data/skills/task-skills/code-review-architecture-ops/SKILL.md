---
name: code-review-architecture-ops
description: Review explicit code-review-gate targets for architecture, migration, rollout, performance, and observability risks.
disable-model-invocation: true
---

# code-review-architecture-ops

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Check whether the change erodes maintainable system boundaries:

- public CLI/API contracts are split across unclear ownership boundaries
- lifecycle code mixes catalog parsing, rendering, and state mutation in a risky way
- migration/update/uninstall paths are incomplete
- performance or repeated I/O costs grow without need
- diagnostics do not explain operator-actionable failures
- docs or runbooks become materially stale for changed behavior

Report architecture issues only when they create a concrete defect, migration risk, or operating risk.
