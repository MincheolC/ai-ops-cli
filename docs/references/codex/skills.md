---
source: https://developers.openai.com/codex/skills
last_fetched: 2026-02-26
---

# Codex Agent Skills Agent Instruction Manual

## 1. Core Architecture & Hierarchy

- **Execution Pipeline (Progressive Disclosure):**

1. **Initialization:** Codex exclusively loads metadata (`name`, `description`, file path, and `agents/openai.yaml` metadata) to conserve context window.
2. **Evaluation:** Codex performs implicit matching based on the `description` string or waits for explicit invocation.
3. **Activation:** The full `SKILL.md` instruction payload is dynamically injected into the context window only upon formal skill activation.

- **Skill Directory Topology:**
- `my-skill/`
- `SKILL.md` (Required: instructions + metadata)
- `scripts/` (Optional: executable code)
- `references/` (Optional: documentation)
- `assets/` (Optional: templates, resources)
- `agents/`
- `openai.yaml` (Optional: appearance, policies, dependencies)

- **Scope Hierarchy (Scanned recursively upwards):**
- `REPO` ($CWD $\rightarrow$ Parent Dirs $\rightarrow$ Root) > `USER` > `ADMIN` > `SYSTEM`
- _Note: Naming collisions do not trigger overrides or merges; skills with identical names coexist independently._

## 2. Config & Path Specs

| Scope    | Directory / Path            | Capability / Purpose                                   | Override Rules                                    |
| -------- | --------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| `REPO`   | `$CWD/.agents/skills`       | Working directory-specific skills (e.g., microservice) | Coexists without merging on name collisions.      |
| `REPO`   | `$CWD/../.agents/skills`    | Shared parent folder specific skills                   | Coexists without merging on name collisions.      |
| `REPO`   | `$REPO_ROOT/.agents/skills` | Repository root specific skills (global to repo)       | Coexists without merging on name collisions.      |
| `USER`   | `$HOME/.agents/skills`      | Personal cross-repository user skills                  | Coexists without merging on name collisions.      |
| `ADMIN`  | `/etc/codex/skills`         | Machine/Container shared system-level skills           | Coexists without merging on name collisions.      |
| `SYSTEM` | Bundled internally          | Broad baseline default skills                          | Coexists without merging on name collisions.      |
| Config   | `~/.codex/config.toml`      | Skill state management                                 | Toggles skill enablement via `[[skills.config]]`. |

## 3. Syntax & Commands (Hard Constraints)

- **Mandatory Commands:**
- Create Skill: `$skill-creator`
- Install Skill: `$skill-installer install <skill_name> from <source_path>`
- Explicit Invocation: `/skills` or prefix `$` in the prompt.

- **Special Syntax Rules:**
- **`SKILL.md` Frontmatter:** The file MUST begin with valid YAML frontmatter containing the exact keys `name` and `description`.
- **`agents/openai.yaml` Schema:**
- `policy.allow_implicit_invocation` (Boolean): Dictates if the agent can self-select the skill (Default: `true`).
- `dependencies.tools` (Array): Declares required MCP servers/tools.

- **Disable/Enable Configurations:** To disable a skill without deleting it, append the following block to `~/.codex/config.toml`:

```toml
[[skills.config]]
path = "/absolute/path/to/skill/SKILL.md"
enabled = false

```

- **Symlink Resolution:** Codex strictly follows symlink targets when evaluating any `.agents/skills` directory.

- **Caveats & Constraints (Critical rules to prevent Fatal Errors):**
- **State Refresh Hard Constraint:** The Codex process MUST be entirely restarted if `~/.codex/config.toml` is modified, or if hot-reloading fails to detect a newly created/installed skill.
- **Implicit Trigger Reliance:** Implicit invocation relies entirely on the lexical boundaries of the `description` frontmatter. Ambiguous descriptions will cause misfires or complete failure to trigger.
- **Non-Merging Conflict Resolution:** If two independent skills share the exact same `name`, the agent will not deduplicate or merge them; both will pollute the selection pool.
