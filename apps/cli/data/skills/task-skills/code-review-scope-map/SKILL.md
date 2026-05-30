---
name: code-review-scope-map
description: Normalize an explicit code-review-gate request into a concrete review target and evidence surface.
disable-model-invocation: true
---

# code-review-scope-map

Use only when the `code-review-gate` subagent or user explicitly asks for this skill.

## Purpose

Map the review request to one target shape before deep review starts. Return a compact scope map, not findings.

## Mode protocol

Pick exactly one target mode:

### `plan_current_changes`

Use only when the request names a plan and asks to compare that plan against the current worktree, with trigger phrases like "현재 변경사항은 [plan] 구현", "current changes implement [plan]", or "this work implements [plan]".

- Target identifier: the named plan path plus the current worktree.
- Included surface: named plan file, staged changes, unstaged changes, untracked implementation files, untracked plan files that affect acceptance, and directly related tests/docs.
- Excluded surface: unrelated dirty files, older commits, sibling repos, and broad project areas not changed by the implementation.
- Required evidence: direct read of the plan, `git status --short`, `git diff --stat`, `git diff`, `git diff --cached --stat`, `git diff --cached`, and `git ls-files --others --exclude-standard`.
- Focused passes to run: correctness, test-quality, and any security/state/architecture pass implied by the changed surface.

### `plan_head_commit`

Use for trigger phrases like `직전 커밋은 [계획 문서] 구현`, `HEAD commit implements [plan]`, `직전 커밋`, `HEAD commit`, or `last commit`. If the request names a plan, compare that plan against the `HEAD` evidence; otherwise review the `HEAD` commit directly.

- Target identifier: `HEAD`, plus the named plan path when supplied.
- Included surface: files changed by `HEAD`, directly related context needed to judge the commit, directly related tests/docs, and the named plan file when supplied.
- Excluded surface: uncommitted worktree changes, unrelated history, sibling repos, and unchanged project-wide surfaces.
- Required evidence: `git show --stat HEAD`, `git show --name-only HEAD`, `git show HEAD`, and direct read of the plan only when a plan is supplied.
- Focused passes to run: correctness, test-quality, and any security/state/architecture pass implied by the committed surface.

### `project_wide`

Use for trigger phrases like `이 프로젝트 전체`, `whole project`, `project-wide`, or "review the entire repo".

- Target identifier: project root plus the priority surfaces inspected.
- Included surface: entrypoints, integration/skill/subagent registries, schemas, CLI commands, docs/status, important tests, and project-owned policy surfaces.
- Excluded surface: surfaces not sampled, generated dependencies, vendored assets, external services, sibling repos, and any area without enough time or priority evidence.
- Required evidence: `rg --files`, relevant package manifests, registry/schema reads, CLI entrypoint reads, docs/status reads, and targeted test reads.
- Focused passes to run: architecture-ops first, then correctness/test-quality/security/state only where the inspected surfaces justify them.
- Constraint: never claim complete coverage; always say exactly what was inspected and what was excluded.

### `feature`

Use for trigger phrases like `기능`, `feature`, or a named product/CLI capability.

- Target identifier: the feature name and the matched route, command, module, or package surface.
- Included surface: feature routes/commands/modules, docs, tests, configs, generated assets, and directly connected shared auth, policy, schema, or test helper code.
- Excluded surface: neighboring features, unrelated shared utilities, broad project-wide scans, and shared code without a direct feature dependency.
- Required evidence: `rg -n` for the feature name, `rg --files` for candidate paths, direct reads of matched files, and relevant `git diff`/`git show` evidence when the feature review is tied to changes.
- Focused passes to run: correctness and test-quality by default; add security/state/architecture only for directly connected surfaces.

### `module`

Use for trigger phrases like `모듈`, `module`, explicit paths, package names, directory names, or symbols.

- Target identifier: the explicit path when provided; otherwise the narrowed package, directory, or symbol candidate.
- Included surface: explicit paths first, then directly related package files, imports/exports, schemas/configs, tests, and docs.
- Excluded surface: consumers outside the direct dependency path, unrelated packages, sibling repos, and project-wide areas not required to understand the module.
- Required evidence: path existence checks through direct reads, `rg --files`, targeted `rg -n` symbol/package search, and relevant `git diff`/`git show` evidence when the module review is tied to changes.
- Focused passes to run: passes implied by the module responsibility and changed/inspected files.

### `diff_default`

Use when the user asks for review of `현재 변경사항`, `current changes`, `current diff`, or otherwise supplies no plan, commit, feature, module, or project-wide target.

- Target identifier: current worktree diff.
- Included surface: staged changes, unstaged changes, untracked implementation files, and directly related tests/docs.
- Excluded surface: unchanged history, unrelated untracked notes/plans, sibling repos, and broad project-wide surfaces.
- Required evidence: `git status --short`, `git diff --stat`, `git diff`, `git diff --cached --stat`, `git diff --cached`, and `git ls-files --others --exclude-standard`.
- Focused passes to run: correctness and test-quality by default; add security/state/architecture only when the changed surface indicates that risk.

## Scope output

Return these fields:

- `target mode`: one of the six target modes above.
- `target identifier`: plan path, commit, project root, feature name, module path/name, or current worktree.
- `included surface`: files, directories, commits, plans, commands, configs, docs, tests, and generated assets that must be inspected.
- `excluded surface`: nearby areas intentionally not reviewed, with the reason.
- `required evidence`: read-only commands and direct file reads that justify the scope.
- `ambiguity`: absent, or the specific target clarification needed before deeper review.
- `focused passes to run`: focused skills that should run, with a short reason for each.

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

When stopped, set `ambiguity`, return only the target clarification needed and the evidence that caused the ambiguity. Do not run focused review passes when `ambiguity` is present.
