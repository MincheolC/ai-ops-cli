---
source: https://docs.anthropic.com/en/docs/claude-code/skills
last_fetched: 2026-02-26
---

# Claude Code Skills Agent Instruction Manual

## 1. Core Architecture & Hierarchy

**Priority & Scope Topology (Highest to Lowest Specificity):**

1. `Enterprise` (Managed settings files)
2. `Personal` (`~/.claude/skills/<skill-name>/SKILL.md`)
3. `Project` (`.claude/skills/<skill-name>/SKILL.md`)
4. `Plugin` (`<plugin>/skills/<skill-name>/SKILL.md`)

**Execution & Resolution Rules:**

- **Legacy Override:** Skills take precedence over legacy `.claude/commands/*.md` files sharing the same name.
- **Namespace Isolation:** Plugin skills utilize a `plugin-name:skill-name` namespace to prevent collisions.
- **Nested Discovery:** Skills are automatically discovered from nested `.claude/skills/` directories relative to the active working directory. In monorepos, skills in each package's `.claude/skills/` are discovered when that package's directory is active (requires `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` for `--add-dir` paths).
- **Context Budget:** Skill descriptions load into context dynamically (budgeted at 2% of context window, 16,000 chars fallback).

## 2. Config & Path Specs

| Scope          | Directory / Path                         | Capability / Purpose                       | Override Rules              |
| -------------- | ---------------------------------------- | ------------------------------------------ | --------------------------- |
| **Enterprise** | Managed Settings                         | Organization-wide standard enforcement     | Highest Priority            |
| **Personal**   | `~/.claude/skills/<skill-name>/SKILL.md` | Global user-specific custom slash commands | Overridden by Enterprise    |
| **Project**    | `./.claude/skills/<skill-name>/SKILL.md` | Repo-scoped workflows and execution logic  | Overridden by Personal      |
| **Plugin**     | `<plugin>/skills/<skill-name>/SKILL.md`  | Bundled third-party automations            | Namespaced (`plugin:skill`) |
| **Legacy**     | `./.claude/commands/*.md`                | Deprecated command definitions             | Overridden by Skills        |

## 3. Syntax & Commands (Hard Constraints)

- **Mandatory Commands & Environment Variables:**
- `/<skill-name>`: CLI invocation of a specific skill.
- `/context`: Audits context budget and warns if skills are excluded due to character limits.
- `SLASH_COMMAND_TOOL_CHAR_BUDGET`: Env var to override the default 16,000 character skill description context limit.
- `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`: Env var required to load skills from `--add-dir` paths.

- **Special Syntax Rules (Conditional constraints, Frontmatter):**
- **YAML Frontmatter Fields (Top of `SKILL.md`):**

```yaml
---
name: string # Max 64 chars (a-z, 0-9, -). Defaults to dir name.
description: string # Recommended. Used by LLM for auto-triggering.
disable-model-invocation: boolean # Default false. True = Manual CLI trigger only.
user-invocable: boolean # Default true. False = Hidden from UI, LLM trigger only.
allowed-tools: string # CSV list (e.g., Read, Grep, Bash).
context: fork # Spawns skill in an isolated subagent context.
agent: string # Subagent type. Requires `context: fork`. Valid values: general-purpose, Explore, Plan, claude-code-guide, etc.
---
```

- **String Substitution Variables:**
- `$ARGUMENTS`: Injects all provided CLI arguments. (If omitted in template, appended as `ARGUMENTS: <value>`).
- `$ARGUMENTS[N]` or `$N`: Positional argument injection (0-based index).
- `${CLAUDE_SESSION_ID}`: Injects the current active session ID.

- **Dynamic Context Injection:**
- `!`command``: Executes shell command _before_ prompt ingestion. Output permanently replaces the placeholder in the prompt fed to the LLM.

- **Permission Target Matching (`/permissions`):**
- `Skill(name)`: Exact match.
- `Skill(name *)`: Prefix match with any arguments.

- **Caveats & Constraints (Critical rules to prevent Fatal Errors):**
- **Subagent Forking Constraints:** `context: fork` requires explicit, actionable task instructions within the markdown body. Purely declarative guidelines (e.g., coding standards) will cause the subagent to return empty/meaningless output.
- **Payload Limits:** `SKILL.md` entrypoints must be kept under 500 lines. Overflow logic/data must be referenced in external supporting files (e.g., `reference.md`) within the skill directory.
- **Extended Thinking:** To enable thinking mode for a specific skill, the exact string `"ultrathink"` must be present in the skill content.
