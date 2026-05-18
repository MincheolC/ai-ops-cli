# Subagent Authoring Guide

[Korean](./README.ko.md)

This directory is the source of truth for global agent subagents.

## Directory Shape

```text
apps/cli/data/subagents/
  README.md
  README.ko.md
  subagent-registry.json
  <subagent-id>/
    PROMPT.md
    claude.frontmatter.yaml
    codex.frontmatter.toml
    gemini.frontmatter.yaml
```

## Authoring Rules

1. Only `subagent-registry.json` decides whether a subagent is exposed in the catalog.
2. `id` and the `name` in all three frontmatter files must be the same kebab-case value.
3. `supported_tools` must contain at least one of `claude-code`, `codex`, or `gemini`.
4. `PROMPT.md` is the shared developer instruction body for all tools.
5. Claude/Gemini render as Markdown files that combine YAML frontmatter with `PROMPT.md`.
6. Codex renders as TOML metadata, `developer_instructions`, and `[[skills.config]]`.
7. Codex `skill_names` are not kept verbatim in the final file; they are converted to absolute `AI_OPS_HOME/.agents/skills/<skill>/SKILL.md` paths.
8. Installation does not fail when required skills are missing. The CLI only prints a warning.
9. Subagents are always installed only in the global tool home. The project repo must not receive `.codex/agents`, `.claude/agents`, `.gemini/agents`, or `.ai-ops/subagents-manifest.json`.

## Registry Fields

| Field             | Required | Example                              | Meaning                   |
| ----------------- | -------- | ------------------------------------ | ------------------------- |
| `id`              | Yes      | `security-gate`                      | Canonical subagent id     |
| `supported_tools` | Yes      | `["claude-code", "codex", "gemini"]` | Tools that can install it |
| `source_path`     | Yes      | `security-gate`                      | Relative source directory |

## Output Paths

| Tool        | Output path               |
| ----------- | ------------------------- |
| Codex       | `.codex/agents/<id>.toml` |
| Claude Code | `.claude/agents/<id>.md`  |
| Gemini CLI  | `.gemini/agents/<id>.md`  |

The state file is `.ai-ops/subagents-manifest.json`. It is separate from the skill state file, `.ai-ops/skills-manifest.json`; neither lifecycle reads or writes the other.
