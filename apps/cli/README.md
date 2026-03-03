# ai-ops-cli

CLI for managing AI tool rules and presets across projects.

## Why this exists

`ai-ops-cli` was created to reduce configuration drift across AI coding tools in a team.

- Different tools (Claude Code, Codex, Gemini CLI) require different file locations and prompt layouts.
- Tool conventions evolve over time, so manually maintained setup files become inconsistent quickly.
- Teams need a single, repeatable way to install and maintain AI rule scaffolding.

This project uses a centralized rule source (SSOT) and scaffolds tool-native files into project/global scope.
For the full product background and architecture intent, see [`docs/plan.md`](../../docs/plan.md).

## Scope

### What this library provides

- Interactive installation flow for supported AI tools (`ai-ops init`)
- Managed updates based on installed manifest (`ai-ops update`)
- Drift detection against current source hash (`ai-ops diff`)
- Safe cleanup of installed managed files + manifest (`ai-ops uninstall`)
- Scope-aware installation target (`--scope project|global`)

### What this library does not provide

- A hosted backend or remote state service
- Rule authoring workflow inside the CLI itself
- IDE-specific plugin management

## Supported AI tools and installation model

`ai-ops-cli` currently supports:

- Claude Code (`claude-code`)
- Codex (`codex`)
- Gemini CLI (`gemini`)

### Tool-specific installation layout

| Tool        | Single project                                       | Monorepo                                                                      | Why this layout (JIT rationale)                                                                      |
| ----------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Claude Code | `.claude/rules/<rule-id>.md` per rule                | Global rules in `.claude/rules/*.md`, domain rules in `<workspace>/CLAUDE.md` | Keeps always-on rules stable while loading domain rules only for matching paths/workspaces.          |
| Codex       | `AGENTS.md` (global) + `AGENTS.override.md` (domain) | Root `AGENTS.md` + `<workspace>/AGENTS.override.md`                           | Uses root baseline + local override so only relevant workspace context is applied at execution time. |
| Gemini CLI  | `.gemini/GEMINI.md`                                  | Root `.gemini/GEMINI.md` + `<workspace>/GEMINI.md`                            | Splits shared defaults and workspace-local context to reduce irrelevant prompt context.              |

Gemini CLI can also install optional runtime settings to `.gemini/settings.json`.

### Installation behavior details

- Rules are split into global and domain categories and rendered per tool with tool-native file shapes.
- Existing managed files are replaced safely using ai-ops metadata headers.
- Existing non-managed files are preserved and receive an `ai-ops` managed section block instead of full overwrite.
- `update`, `diff`, and `uninstall` operate from the manifest to keep changes deterministic and idempotent.

## Install

```bash
npm install -g ai-ops-cli
```

## Usage

```bash
# Initialize rules for the current project
ai-ops init

# Check for updates
ai-ops diff

# Apply updates
ai-ops update

# Remove installed managed files and manifest
ai-ops uninstall
```

## Options

```
ai-ops [command] [options]

Commands:
  init     Initialize AI tool rules for a project
  update   Update installed rules
  diff     Show diff between installed and current rules
  uninstall Remove installed rules and manifest

Options:
  --scope <scope>  Target scope: project (default) or global
  --force          Force update even when no changes detected
  -V, --version    Output the version number
  -h, --help       Display help
```

## License

MIT
