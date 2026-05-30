---
name: code-review-test-quality
description: Review explicit code-review-gate targets for missing, weak, or misleading tests.
disable-model-invocation: true
---

# code-review-test-quality

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Look for tests that would fail to catch the risky behavior.

## Review lens

Check for:

- plan acceptance criteria without a direct assertion
- missing regression tests for requirement mismatch, business invariant, compatibility, edge case, or contract regression risks
- only happy-path tests around error-prone behavior
- weak assertions that verify existence but not behavior, output, ownership, or failure mode
- mocks, fixtures, snapshots, or golden files that bypass the contract being changed
- suspicious tests that can pass without exercising the changed code path
- e2e gaps for CLI command, filesystem, manifest, hook, subagent, skill, or install lifecycle changes

## Scope compliance

Use the scope map as a hard boundary. Report findings only inside the `included surface`. Do not turn the `excluded surface` into findings; if risk signals appear outside scope, record them only as `미실행/남은 확인`.

## Evidence protocol

1. Start from the scope map and plan acceptance criteria.
2. Link each missing or weak test concern to the production behavior it would fail to catch.
3. Report with file/line evidence from the production code, test file, or missing test boundary.
4. Apply no generic advice: do not ask for more coverage unless a merge-relevant behavior can currently regress unnoticed.

Separate missing tests from tests that exist but assert the wrong thing.
