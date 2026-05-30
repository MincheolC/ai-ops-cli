---
name: code-review-scope-map
description: Normalize an explicit code-review-gate request into a concrete review target and evidence surface.
disable-model-invocation: true
---

# code-review-scope-map

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

## Purpose

Map the review request to one target shape before deep review starts. Return a compact scope map, not findings.

## Target modes

Pick exactly one target mode:

- `plan_current_changes`: compare a named plan file against staged, unstaged, and untracked current changes.
- `plan_head_commit`: compare a named plan file against the `HEAD` commit diff.
- `project_wide`: inspect prioritized project surfaces without claiming complete coverage.
- `feature`: identify the route, module, docs, tests, and shared policy surfaces for a named feature.
- `module`: identify explicit paths first, then module/package/symbol evidence.
- `diff_default`: review staged, unstaged, and untracked current changes when no target is supplied.

## Scope output

Return these fields:

- `target mode`: one of the six target modes above.
- `included surface`: files, directories, commits, plans, commands, configs, docs, tests, and generated assets that must be inspected.
- `excluded surface`: nearby areas intentionally not reviewed, with the reason.
- `ambiguity`: absent, or the specific target clarification needed before deeper review.
- `evidence`: read-only commands and direct file reads that justify the scope.

## Read-only evidence commands

Prefer read-only commands:

1. `git status --short`
2. `git diff --stat`
3. `git diff`
4. `git diff --cached --stat`
5. `git diff --cached`
6. `git ls-files --others --exclude-standard`
7. `git show --stat HEAD`
8. `git show --name-only HEAD`
9. `git show HEAD`

Use direct file reads for named plans, manifests, schemas, route handlers, tests, and docs needed to understand the target.

## Ambiguity stop

Stop before deeper review when:

- multiple plans, commits, modules, or features could match the request
- a project-wide request lacks enough priority to inspect responsibly
- the requested target points outside the project root or into a sibling repo without explicit permission
- the named plan or path cannot be found
- the requested target would require web search or external system access that was not explicitly requested

When stopped, return only the target clarification needed and the evidence that caused the ambiguity.
