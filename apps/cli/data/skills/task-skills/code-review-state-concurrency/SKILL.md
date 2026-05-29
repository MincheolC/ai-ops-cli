---
name: code-review-state-concurrency
description: Review explicit code-review-gate targets for async, retry, idempotency, transaction, and stale-state defects.
disable-model-invocation: true
---

# code-review-state-concurrency

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Inspect state and timing risks:

- retries that duplicate side effects
- partial writes or manifest updates that leave inconsistent state
- transaction or file lifecycle ordering issues
- stale cache, stale manifest, or stale source-hash reads
- concurrent hook/workflow behavior and merge ordering
- cleanup paths that race with install/update paths

Tie every finding to a specific state transition or failure mode.
