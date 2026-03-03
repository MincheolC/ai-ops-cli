---
source: https://geminicli.com/docs/cli/custom-commands
last_fetched: 2026-02-26
---

# Custom Commands Agent Instruction Manual

## 1. Core Architecture & Hierarchy

- **Configuration Precedence (Highest to Lowest):**

1. `Project (Local)` > `<your-project-root>/.gemini/commands/`
2. `User (Global)` > `~/.gemini/commands/`

- **Evaluation/Parsing Order (Execution Pipeline):**

1. File Content & Multimodal Injection (`@{...}`)
2. Shell Command Execution (`!{...}`)
3. Argument Substitution (`{{args}}`)

- **Namespacing:** The command name is strictly mapped to its file path relative to the `commands` directory. Path separators (`/` or `\`) are converted to colons (`:`). The file extension MUST be `.toml`. (e.g., `<project>/.gemini/commands/git/commit.toml` maps to `/git:commit`).

## 2. Config & Path Specs

| Scope           | Directory / Path                        | Capability / Purpose                                   | Override Rules                                                                    |
| --------------- | --------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Project (Local) | `<your-project-root>/.gemini/commands/` | Project-specific, version-controllable custom commands | Highest priority. Silently overrides User (Global) commands with identical names. |
| User (Global)   | `~/.gemini/commands/`                   | Global user-wide custom commands across all projects   | Lowest priority.                                                                  |
| Definition      | `*.toml`                                | Stores prompt payload and CLI metadata                 | Must follow TOML v1 formatting.                                                   |

## 3. Syntax & Commands (Hard Constraints)

- **Mandatory Commands:**
- `/commands reload`: Hot-reloads all `.toml` command files into memory without restarting the CLI.
- `/help`: Displays available commands utilizing the `description` metadata (or auto-generates from the filename if omitted).

- **Special Syntax Rules:**
- **TOML Schema:**
- `prompt` (String, Required): The single or multi-line payload sent to the LLM.
- `description` (String, Optional): A one-line metadata description for the CLI UI.

- **Argument Injection (`{{args}}`):**
- _Raw Mode:_ If `{{args}}` is outside `!{...}`, it is injected exactly as typed by the user.
- _Escaped Mode:_ If `{{args}}` is inside `!{...}`, it is automatically shell-escaped to prevent command injection vulnerabilities.

- **Implicit Argument Appending (No `{{args}}` present):**
- If the user provides arguments but the prompt lacks `{{args}}`, the CLI appends `\n\n<Original_Command_And_Args>` to the end of the evaluated prompt.

- **Shell Injection (`!{...}`):**
- Executes the enclosed shell command and injects `stdout`.
- On failure, injects `stderr` followed by a status footprint: `[Shell command exited with code X]`.

- **File & Context Injection (`@{...}`):**
- _Text Files:_ Injected as raw strings.
- _Multimodal/Media:_ Supported formats (PNG, JPEG, PDF, Audio, Video) are encoded as multimodal tokens. Unsupported binaries are gracefully skipped.
- _Directories:_ Traversed recursively to inject all valid child files. Fully respects `.gitignore` and `.geminiignore` restrictions. Supports absolute paths if within the workspace.

- **Caveats & Constraints (Critical rules to prevent Fatal Errors):**
- **Balanced Braces Constraint:** Content enclosed within `!{...}` (shell commands) and `@{...}` (paths) MUST possess perfectly balanced `{` and `}` braces. Unbalanced execution strings MUST be wrapped in an external script file (e.g., `!{./script.sh}`).
- **Execution Blocking:** Any custom command evaluating a shell script (`!{...}`) halts the agentic loop and forces a security confirmation dialog. The agent cannot bypass this user-consent requirement.
