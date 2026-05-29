---
name: code-review-correctness
description: Review explicit code-review-gate targets for requirement, behavior, compatibility, and edge-case defects.
disable-model-invocation: true
---

# code-review-correctness

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Focus on user-visible or contract-visible correctness defects:

- implementation does not satisfy the named plan or stated request
- branch conditions miss valid or invalid states
- compatibility with existing CLI/API/config contracts regresses
- error handling hides actionable failures
- edge cases are not covered by code or tests

Report only concrete defects with file and line evidence. Keep style-only notes out unless they hide a real bug.
