---
name: code-review-architecture-ops
description: Review explicit code-review-gate targets for architecture, migration, rollout, performance, and observability risks.
disable-model-invocation: true
---

# code-review-architecture-ops

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Check whether the change erodes maintainable system boundaries or operational safety.

## Review lens

Check for:

- structure erosion where public CLI/API contracts, schemas, or package data are split across unclear ownership boundaries
- lifecycle ownership bugs where catalog parsing, rendering, installation, state mutation, and cleanup become coupled in a risky way
- migration, update, rollback, or uninstall paths that leave old files, stale manifests, or incompatible generated assets
- diagnostics that fail to explain operator-actionable recovery steps
- repeated I/O, broad project scans, or expensive parsing that can slow common CLI workflows without need
- docs, runbooks, or operating-layer templates that become materially stale for changed behavior
- feature or module boundaries that make future review, audit, or installation behavior ambiguous

## Scope compliance

Use the scope map as a hard boundary. Report findings only inside the `included surface`. Do not turn the `excluded surface` into findings; if risk signals appear outside scope, record them only as `미실행/남은 확인`.

## Evidence protocol

1. Inspect the owning module boundaries and lifecycle path named by the scope map.
2. Compare the changed contract with registry, schema, docs, diagnostics, and install/update/uninstall behavior.
3. Report architecture issues only when they create a concrete defect, migration risk, or operating risk with file/line evidence.
4. Apply no generic advice: do not recommend broad refactors unless the current change creates a merge-relevant operational problem.

If there is no architecture/ops finding, mention the boundary or rollout surfaces inspected.
