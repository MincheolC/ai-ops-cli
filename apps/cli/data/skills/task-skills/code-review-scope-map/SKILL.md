---
name: code-review-scope-map
description: Normalize an explicit code-review-gate request into a concrete review target and evidence surface.
disable-model-invocation: true
---

# code-review-scope-map

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

## Purpose

Map the review request to one target shape before deep review starts.

- `plan_current_changes`: compare a named plan file against staged, unstaged, and untracked current changes.
- `plan_head_commit`: compare a named plan file against the `HEAD` commit diff.
- `project_wide`: inspect prioritized project surfaces without claiming complete coverage.
- `feature`: identify the route, module, docs, tests, and shared policy surfaces for a named feature.
- `module`: identify explicit paths first, then module/package/symbol evidence.
- `diff_default`: review staged, unstaged, and untracked current changes when no target is supplied.

## Evidence

Prefer read-only commands:

1. `git status --short`
2. `git diff --stat`
3. `git diff`
4. `git diff --cached --stat`
5. `git diff --cached`
6. `git ls-files --others --exclude-standard`

Return the target, included surfaces, excluded surfaces, and any ambiguity that should stop deeper review.
