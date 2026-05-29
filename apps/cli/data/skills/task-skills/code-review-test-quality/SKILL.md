---
name: code-review-test-quality
description: Review explicit code-review-gate targets for missing, weak, or misleading tests.
disable-model-invocation: true
---

# code-review-test-quality

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Look for test coverage that would fail to catch the risky behavior:

- plan acceptance criteria without a direct assertion
- only happy-path tests around error-prone behavior
- mocks that bypass the contract being changed
- snapshot or fixture churn that masks behavior
- e2e gaps for CLI command, filesystem, manifest, or install lifecycle changes

Separate missing tests from tests that exist but assert the wrong thing.
