---
source: https://developers.openai.com/codex/guides/agents-md
last_fetched: 2026-02-26
---

# Codex AGENTS.md Agent Instruction Manual

## 1. Core Architecture & Hierarchy

- **Execution Pipeline:** Codex builds the instruction chain once per run/session prior to execution.
- **Path Traversal Priority (Top-Down Execution):**

1. `Global Scope` (Codex Home)
2. `Project Scope` (Project Git Root $\rightarrow$ Current Working Directory)

- **Merge & Override Protocol:** Files are concatenated from the Root down to the CWD, separated by blank lines. Instructions closer to the CWD appear later in the prompt, inherently overriding earlier/higher-level guidance.
- **Intra-Directory Resolution Precedence (Highest to Lowest):**
  _(Codex includes a maximum of ONE file per directory, evaluating in this exact order)_

1. `AGENTS.override.md`
2. `AGENTS.md`
3. `[project_doc_fallback_filenames]` (Matched fallbacks defined in config)

## 2. Config & Path Specs

| Scope         | Directory / Path                  | Capability / Purpose                           | Override Rules                                                        |
| ------------- | --------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| Global        | `~/.codex/` or `$CODEX_HOME`      | Persistent user-wide baseline defaults         | Lowest priority. Overridden by any project-level configurations.      |
| Project Root  | Project Root (Typically Git Root) | Repository-wide expectations                   | Overrides Global. Overridden by Nested Subdirectories.                |
| Subdirectory  | Nested directories down to CWD    | Team or domain-specific specialized rules      | Highest priority. Replaces broader rules higher in the tree.          |
| Configuration | `~/.codex/config.toml`            | Overrides default discovery bounds & filenames | Manages `project_doc_fallback_filenames` and `project_doc_max_bytes`. |
| Logs          | `~/.codex/log/codex-tui.log`      | `session-*.jsonl`                              | Audit trail for active instruction sources                            | Read-only verification of loaded context. |

## 3. Syntax & Commands (Hard Constraints)

- **Mandatory Commands:**
- Verify full instruction chain: `codex --ask-for-approval never "Summarize the current instructions."`
- Verify targeted subdirectory chain: `codex --cd <dir> --ask-for-approval never "Show which instruction files are active."`
- Execute with custom profile path: `CODEX_HOME=<custom_path> codex exec "<prompt>"`

- **Special Syntax Rules:**
- **Environment Variables:**
- `CODEX_HOME`: Overrides the default `~/.codex` global directory path.

- **TOML Configuration (`config.toml`):**
- `project_doc_fallback_filenames` (Array of Strings): Custom filenames treated as instruction files (e.g., `["TEAM_GUIDE.md", ".agents.md"]`).
- `project_doc_max_bytes` (Integer): The maximum byte limit for the concatenated payload. Default is `32768` (32 KiB).

- **Caveats & Constraints (Critical rules to prevent Fatal Errors):**
- **Max Bytes Truncation:** Codex strictly halts the ingestion of further instruction files once the concatenated byte size reaches `project_doc_max_bytes`. Large setups must be chunked or the limit explicitly raised.
- **Empty File Ignorance:** Codex completely ignores files with 0 bytes. They will not trigger an override or inclusion.
- **Path Termination Hard Stop:** The discovery pipeline abruptly stops searching once it reaches the Current Working Directory (CWD). Files in deeper nested directories below the CWD are completely invisible to the session.
- **Single File Per Directory Ceiling:** Only the highest-precedence file (`.override.md` > `.md` > `fallback`) inside a single directory is ingested; all other matching instruction files in that same directory are silently ignored.
