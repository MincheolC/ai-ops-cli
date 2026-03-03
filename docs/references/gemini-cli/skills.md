---
source: https://geminicli.com/docs/cli/skills
last_fetched: 2026-02-26
---

# Agent Skills Agent Instruction Manual

## 1. Core Architecture & Hierarchy

- **Tier Precedence (Highest to Lowest):**

1. `Workspace`
2. `User`
3. `Extension`

- **Path Precedence (Within the same tier):**
- `.agents/skills/` > `.gemini/skills/`

- **Execution Lifecycle:**

1. **Discovery:** Load `name` + `description` metadata only.
2. **Activation:** Invoke `activate_skill` tool based on prompt matching.
3. **Consent:** Await user UI approval for directory access.
4. **Injection:** Load `SKILL.md` and folder structure into agent context. The payload is wrapped in `<activated_skill>` tags, containing `<instructions>` (expert procedural guidance) and `<available_resources>` (usable assets).
5. **Execution:** Prioritize procedural guidance for session duration.

## 2. Config & Path Specs

| Scope     | Directory / Path        | Capability / Purpose                 | Override Rules                                                  |
| --------- | ----------------------- | ------------------------------------ | --------------------------------------------------------------- |
| Workspace | `.agents/skills/`       | Project-specific shared capabilities | Highest priority. Overrides `.gemini/skills/` within Workspace. |
| Workspace | `.gemini/skills/`       | Project-specific shared capabilities | Overrides User and Extension tiers.                             |
| User      | `~/.agents/skills/`     | Global user-specific capabilities    | Overrides `.gemini/skills/` within User tier.                   |
| User      | `~/.gemini/skills/`     | Global user-specific capabilities    | Overrides Extension tier.                                       |
| Extension | Bundled extension paths | 3rd-party capabilities               | Lowest priority.                                                |
| Target    | `SKILL.md`              | Skill instructions & execution logic | Target payload for `activate_skill` tool.                       |
| Archive   | `.skill`                | Zipped package format                | Valid target for install commands.                              |

## 3. Syntax & Commands (Hard Constraints)

- **Mandatory Commands:**
- **Interactive Session (`/skills`):**
- `/skills list`
- `/skills link <path>`
- `/skills disable <name>`
- `/skills enable <name>`
- `/skills reload`

- **Terminal (`gemini skills`):**
- `gemini skills list`
- `gemini skills link <path> [--scope workspace]`
- `gemini skills install <repo_url|local_path|file.skill> [--path <subdirectory>] [--scope workspace]`
- `gemini skills uninstall <name> --scope workspace`
- `gemini skills enable <name>`
- `gemini skills disable <name> [--scope workspace]`

- **Special Syntax Rules:**
- **Scope Defaulting:** `disable`, `enable`, and `install` operations strictly default to `user` scope unless the `--scope workspace` flag is explicitly appended.
- **Installation Targeting:** Monorepo or subdirectory installations must use the `--path <dir>` flag in conjunction with the source URL.
- **Progressive Disclosure:** Do not inject full skill logic into the base context window. Rely entirely on the metadata footprint until the skill is formally activated.

- **Caveats & Constraints (Critical rules to prevent Fatal Errors):**
- **Activation Dependency:** An agent cannot autonomously read bundled scripts, templates, or `SKILL.md` content until the `activate_skill` tool successfully executes and receives user consent.
- **Immutability of Session Priority:** Once activated, a skill's framework is permanently injected and prioritized for the entire remainder of the active session.
- **Alias Consistency:** Always resolve `.agents/skills/` ahead of `.gemini/skills/` to maintain cross-agent compatibility standards.
