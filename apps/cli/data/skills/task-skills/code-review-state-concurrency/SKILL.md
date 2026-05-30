---
name: code-review-state-concurrency
description: Review explicit code-review-gate targets for async, retry, idempotency, transaction, and stale-state defects.
disable-model-invocation: true
---

# code-review-state-concurrency

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Inspect state, lifecycle, and timing risks.

## Review lens

Check for:

- manifest/file lifecycle bugs where write order leaves installed files and registry state inconsistent
- partial updates that succeed after one component fails
- stale hash, stale cache, stale manifest, or stale source reads after updates
- retry or rerun behavior that duplicates side effects or hides prior failure
- idempotency gaps in install, update, uninstall, hook dispatch, receipt, or generated asset flows
- install/update/uninstall ordering bugs, especially cleanup that races with ownership checks
- async or concurrent execution where multiple commands can mutate the same state without a stable lock or read-only fallback

## Evidence protocol

1. Trace the state transition from input through file/manifest writes and cleanup.
2. Identify what happens on success, partial failure, rerun, stale state, and missing file cases.
3. Report only findings tied to a concrete transition or failure mode with file/line evidence.
4. Apply no generic advice: do not request locks, transactions, or refactors unless the reviewed diff exposes a specific race, stale read, or inconsistent state.

If there is no state/concurrency finding, name the lifecycle paths inspected.
