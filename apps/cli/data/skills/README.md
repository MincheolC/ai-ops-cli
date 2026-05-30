# Skill Authoring Guide

[Korean](./README.ko.md)

This directory is the source of truth for installable agent skills.

## Terms

### Reference Skill

A `reference skill` is a lazy-loaded knowledge pack.

- Canonical detail lives in `references/reference.md`
- `SKILL.md` stays thin and tells the agent when to use the skill and what to read first
- Use it for standards, stack guidance, and large domain references

### Task Skill

A `task skill` is a procedural workflow.

- Canonical procedure lives in `SKILL.md`
- `references/` is optional supporting material only
- Use it for repeatable checks, actions, and guided workflows

### Task Skill Usage

Keep repeatable operating procedures as task skills. For example, `ai-ops-project-owned-docs` routes operating notes, diff impact, or conversation learnings into project-owned docs and edits only the documents the user approves.

Disable automatic invocation for task skills that require explicit approval.

- Codex: add `policy.allow_implicit_invocation: false` to `agents/openai.yaml`.
- Claude Code: add `disable-model-invocation: true` to the `SKILL.md` frontmatter.
- Gemini CLI: there is no skill-level explicit-only flag, so write the explicit-invocation rule in the skill body.

Install example:

```bash
ai-ops skill install ai-ops-project-owned-docs --tool codex
```

## Directory Shape

```text
apps/cli/data/skills/
  README.md
  README.ko.md
  skill-registry.json
  reference-skills/
    <skill-name>/
      SKILL.md
      agents/       # optional
      references/   # required for reference skills
      assets/       # optional
      scripts/      # optional
  task-skills/
    <skill-name>/
      SKILL.md
      references/   # optional
      assets/       # optional
      scripts/      # optional
```

## Authoring Rules

1. Directory name must exactly match frontmatter `name`.
2. `SKILL.md` must start with YAML frontmatter.
3. `kind`, `supported_tools`, display grouping, and `source_path` live in `skill-registry.json`.
4. A `reference` skill must live under `reference-skills/` and include `references/reference.md`.
5. A `task` skill must live under `task-skills/` and keep its executable procedure in `SKILL.md`.
6. Do not duplicate the same detailed content across `SKILL.md` and `references/`.
7. Tool-specific metadata is authored in the skill source and copied as-is by the CLI.
8. Codex and Gemini install to `.agents/skills/<skill-name>`. Claude installs to `.claude/skills/<skill-name>`.
9. The CLI copies the whole skill directory tree as-is, so any file under `agents/`, `references/`, `assets/`, or `scripts/` is installed unchanged.

## Frontmatter Fields

`SKILL.md` frontmatter is now agent-facing only. The CLI validates the required fields below and ignores extra tool-specific frontmatter fields.

| Field         | Required | Example                                       | Meaning                                     |
| ------------- | -------- | --------------------------------------------- | ------------------------------------------- |
| `name`        | Yes      | `graphql-contract`                            | Unique skill name and install directory key |
| `description` | Yes      | `Use when changing GraphQL schema contracts.` | Discovery/autotrigger summary               |

## Registry Fields

`skill-registry.json` is the install/catalog SSOT.

| Field             | Required | Example                              | Meaning                                           |
| ----------------- | -------- | ------------------------------------ | ------------------------------------------------- |
| `id`              | Yes      | `graphql-contract`                   | Canonical skill id                                |
| `kind`            | Yes      | `reference` / `task`                 | Skill category                                    |
| `supported_tools` | Yes      | `["claude-code", "codex", "gemini"]` | Where the skill may be installed                  |
| `groups`          | Yes      | `["frontend-web"]`                   | Display/discovery grouping                        |
| `source_path`     | Yes      | `reference-skills/graphql-contract`  | Relative directory that contains the skill source |

## Content Placement

### Reference Skill

- `SKILL.md`: short routing note
- `references/reference.md`: full detailed content

### Task Skill

- `SKILL.md`: full actionable procedure
- `references/`: optional background material
- `scripts/`: optional executable helpers

## Tool-Specific Invocation Control

If a skill must be explicit-only, the skill author must add the tool-specific metadata directly.

### Codex

Create `agents/openai.yaml` yourself.

```yaml
allow_implicit_invocation: false
```

- Use this when Codex should not auto-trigger the skill from the description.
- Because the CLI copies the full directory tree, `agents/openai.yaml` is installed as-is.

### Claude Code

Add `disable-model-invocation: true` to the `SKILL.md` frontmatter yourself.

```yaml
---
name: deploy-script
description: Runs the deployment workflow.
disable-model-invocation: true
---
```

- Use this when Claude should only load the skill through explicit `/skill-name` invocation.
- The CLI preserves this extra frontmatter field and does not generate it for you.

### Gemini CLI

Gemini CLI does not currently provide a skill-level frontmatter flag for disabling implicit invocation.

- If you need explicit-only behavior in Gemini, use a custom command instead.
- Do not add a fake Gemini-only field to `SKILL.md`; Gemini will not interpret it.

## Examples

### Reference Skill Skeleton

```text
reference-skills/graphql-contract/
  SKILL.md
  agents/
    openai.yaml      # optional
  references/
    reference.md
```

### Task Skill Skeleton

```text
task-skills/skill-load-check/
  SKILL.md
  scripts/
    loaded.js
```

## Temporary Validation Skills

`skill-load-check` is an example of a temporary validation skill.

- Keep the description narrow and test-focused
- Keep the body short and procedural
- It is acceptable to delete this skill later once the install/load workflow is proven

## Operating Task Skills

`ai-ops-project-owned-docs` is a Codex-only task skill for routing project-local operating notes, diff impact, or conversation learnings into project-owned docs after user confirmation.

- It classifies user-supplied notes, current diffs, and conversation learnings into project-owned doc targets.
- It proposes the target and text before editing.
- It only edits approved project-owned docs and required status/index files.
- It does not stage, commit, or install hooks by itself.
