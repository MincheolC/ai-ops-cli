---
name: code-review-correctness
description: Review explicit code-review-gate targets for requirement, behavior, compatibility, and edge-case defects.
disable-model-invocation: true
---

# code-review-correctness

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

Focus on user-visible, operator-visible, or contract-visible correctness defects.

## Review lens

Check for:

- requirement mismatch between the named plan, request, tests, and implementation
- business invariant violations or state transitions that accept invalid states
- compatibility regressions in CLI options, config keys, JSON schemas, package data, or public output
- edge cases around empty input, missing files, stale manifests, partial diffs, and unsupported tools
- contract regression where an older supported command, file layout, or install/update behavior now changes
- error handling that hides actionable failures or reports success after a failed branch

## Evidence protocol

1. Read the scope map and the named plan or request.
2. Inspect the implementation surface and directly related tests.
3. For each candidate, map expected behavior -> actual branch/condition -> consequence.
4. Report only findings with file/line evidence.
5. Apply no generic advice: style, naming, or broad cleanup is out of scope unless it causes a concrete defect.

If there is no correctness finding, say which requirement or contract surfaces were inspected.
