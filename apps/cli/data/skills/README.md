# Skill Authoring Guide

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

반복되는 운영 절차는 task skill로 둔다. 예를 들어 `doc-impact-reviewer`는 변경 완료 또는 커밋 직전에 diff를 확인하고, 갱신 후보 문서를 `required / recommended / not needed`로 제안한 뒤 사용자 승인 후 승인된 문서만 수정한다.

승인이 필요한 task skill은 자동 호출을 막는다.

- Codex: `agents/openai.yaml`에 `policy.allow_implicit_invocation: false`를 둔다.
- Claude Code: `SKILL.md` frontmatter에 `disable-model-invocation: true`를 둔다.
- Gemini CLI: skill-level explicit-only flag가 없으므로 본문에 명시 호출 전용 규칙을 적는다.

설치 예시:

```bash
ai-ops skill install doc-impact-reviewer --tool codex
```

## Directory Shape

```text
apps/cli/data/skills/
  README.md
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
3. `kind`, `supported_tools`, preset grouping, and `source_path` live in `skill-registry.json`.
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

| Field                 | Required | Example                              | Meaning                                           |
| --------------------- | -------- | ------------------------------------ | ------------------------------------------------- |
| `id`                  | Yes      | `graphql-contract`                   | Canonical skill id                                |
| `kind`                | Yes      | `reference` / `task`                 | Skill category                                    |
| `supported_tools`     | Yes      | `["claude-code", "codex", "gemini"]` | Where the skill may be installed                  |
| `groups`              | Yes      | `["frontend-web"]`                   | Display/discovery grouping                        |
| `included_in_presets` | Yes      | `["frontend-web", "backend-ts"]`     | Presets that surface this skill in `ai-ops init`  |
| `source_path`         | Yes      | `reference-skills/graphql-contract`  | Relative directory that contains the skill source |

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

`doc-impact-reviewer`는 운영 문서 영향도를 수동으로 검토하는 task skill이다.

- git status, diff, 변경 파일, 관련 operating-layer 문서를 읽는다.
- 편집 전에 문서 후보와 리스크를 보고한다.
- 사용자 확인 전에는 편집하지 않는다.
- staging, commit, hook 설치를 직접 수행하지 않는다.
