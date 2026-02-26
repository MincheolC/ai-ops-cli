---
source: https://docs.anthropic.com/en/docs/claude-code/hooks
last_fetched: 2026-02-26
---

# Claude Code Hooks Agent Instruction Manual

## 1. Core Architecture & Hierarchy

**Priority & Scope Topology (Highest to Lowest Specificity):**

1. `Component` (Skill/Agent YAML Frontmatter)
2. `Plugin` (`hooks/hooks.json`)
3. `Project (Local)` (`.claude/settings.local.json`)
4. `Project (Shared)` (`.claude/settings.json`)
5. `User (Global)` (`~/.claude/settings.json`)
6. `Managed Policy` (Organization-wide settings)

**Execution Pipeline & Resolution:**

- `Event Trigger` -> `Matcher Validation (Regex)` -> `Handler Execution (Command/Prompt/Agent)` -> `Outcome Evaluation (Exit Code & JSON)`

## 2. Config & Path Specs

| Scope                | Directory / Path                                            | Capability / Purpose                          | Override Rules                                                      |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| **Org Policy**       | Managed policy settings                                     | Enforce organization-wide security/compliance | Overrides user `disableAllHooks` if `allowManagedHooksOnly` is true |
| **User (Global)**    | `~/.claude/settings.json`                                   | Cross-project personal workflows/preferences  | Overridden by local/project configs                                 |
| **Project (Shared)** | `.claude/settings.json`                                     | Team-shared repo hooks                        | Committed to version control                                        |
| **Project (Local)**  | `.claude/settings.local.json`                               | Private sandbox hooks                         | Auto-gitignored                                                     |
| **Plugin**           | `hooks/hooks.json`                                          | Plugin-bundled automation                     | Active only when plugin is enabled                                  |
| **Component**        | `hooks:` field in `SKILL.md` / agent `.md` YAML Frontmatter | Component lifecycle-scoped hooks              | Active only during component runtime                                |

## 3. Syntax & Commands (Hard Constraints)

- **Mandatory Commands & Environment Variables:**
- `claude --debug` / `Ctrl+O`: Exposes hook execution traces, stdout/stderr, and match states.
- `/hooks`: Interactive CLI menu to manage/toggle hook configurations.
- `$CLAUDE_PROJECT_DIR`: Resolves to the absolute project root path.
- `${CLAUDE_PLUGIN_ROOT}`: Resolves to the active plugin directory.
- `$CLAUDE_ENV_FILE`: Writable file path for persisting `export` statements (Strictly available to `SessionStart` hooks only).
- `$CLAUDE_CODE_REMOTE`: Set to `"true"` in remote web environments.

- **Special Syntax Rules (Conditional constraints, Schema):**
- **Hook Types:**
- `"command"`: Spawns shell processes. Parses stdout for JSON on exit `0`.
- `"prompt"`: Single-turn LLM evaluation. Injects input via `$ARGUMENTS` placeholder. Output must be `{"ok": boolean, "reason": "..."}`.
- `"agent"`: Multi-turn subagent verification (Max 50 turns). Injects input via `$ARGUMENTS`.

- **Matchers (Regex):** Filters execution based on target fields (e.g., `tool_name` for `PreToolUse`, `agent_type` for `SubagentStart`).
- Ex: `"Bash"`, `"Edit|Write"`, `"mcp__.*"`.
- Events without matcher support (always fire): `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`.

- **Decision Control (JSON via Stdout on Exit 0):**
- _Universal:_ `{"continue": false, "stopReason": "..."}` (Hard stop agent).
- _Top-Level:_ `{"decision": "block", "reason": "..."}` (`UserPromptSubmit`, `PostToolUse`, `Stop`, `ConfigChange`).
- _Nested (PreToolUse):_ `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow|deny|ask", "updatedInput": {...}}}`.
- _Nested (PermissionRequest):_ `{"hookSpecificOutput": {"hookEventName": "PermissionRequest", "decision": {"behavior": "allow|deny", "updatedInput": {...}}}}`.

- **Caveats & Constraints (Critical rules to prevent Fatal Errors):**
- **Exit Code 2 (Blocking):** Forces an immediate block. **ALL stdout JSON is ignored**. Stderr text is fed back to the LLM.
- **JSON Purity (Exit 0):** If utilizing JSON decision control, `stdout` must contain _only_ valid JSON. Extraneous shell profile echoes will trigger parser failures.
- **Async Hook Restrictions:** `"async": true` is strictly limited to `"command"` types. Background hooks cannot return decisions, block events, or modify execution flow.
- **WorktreeCreate Payload:** Must output exactly the absolute path to the directory on `stdout` and exit `0`. JSON decision objects are strictly prohibited for this event.
- **State Mutations:** Hook files are cached at session startup. Mid-session file edits trigger a warning and require manual `/hooks` menu approval to reload.
