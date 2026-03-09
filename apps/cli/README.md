# ai-ops-cli

CLI for managing AI tool rules and presets across projects.

## Why this exists

`ai-ops-cli` reduces configuration drift across AI coding tools.

- Different tools use different file layouts and loading models.
- Manual sync across tools is error-prone over time.
- Teams need a deterministic, repeatable setup for AI pair-programming rules.

The CLI uses centralized YAML rules as SSOT and renders tool-native files into the current project.

> **📌 Core Concept**
>
> Instead of directly managing platform-specific files, manage **abstract metadata** as SSOT and achieve **Asset Centralization** across multiple AI environments.

## What this CLI provides

- Interactive installation (`ai-ops init`)
- Source drift checks (`ai-ops diff`)
- Deterministic re-apply (`ai-ops update`)
- Managed cleanup (`ai-ops uninstall`)
- Project-only operation (no global scope)

## What this CLI does not provide

- Hosted backend or remote state
- In-CLI rule authoring UI
- IDE plugin management

## Supported tools and output layout

| Tool | Single project output | Monorepo output |
| --- | --- | --- |
| Claude Code (`claude-code`) | `.claude/rules/<rule-id>.md` | Shared rules in `.claude/rules/*.md`, domain rules in `<workspace>/CLAUDE.md` |
| Codex (`codex`) | `AGENTS.md` and `AGENTS.override.md` | Root `AGENTS.md` and `<workspace>/AGENTS.override.md` |
| Gemini CLI (`gemini`) | `GEMINI.md` | Root `GEMINI.md` and `<workspace>/GEMINI.md` |

Optional settings files:

- Claude Code: `.claude/settings.local.json`
- Gemini CLI: `.gemini/settings.json`
- Formatting protection section: `.prettierignore`

## Install

```bash
npm install -g ai-ops-cli
```

## Usage

```bash
# Initialize rules for the current project
ai-ops init

# Check drift against current source hash
ai-ops diff

# Re-apply installed rules (or force)
ai-ops update
ai-ops update --force

# Remove installed files and manifest
ai-ops uninstall
```

## CLI surface

```text
ai-ops [command]

Commands:
  init       Initialize AI tool rules for a project
  update     Update installed rules
  diff       Show diff between installed and current rules
  uninstall  Remove installed rules and manifest

Options:
  --force        Force update even when no changes are detected (update only)
  -V, --version  Output version number
  -h, --help     Display help
```

Notes:

- `--scope` is deprecated and explicitly rejected. The CLI is project-only.
- The installation state is tracked in `.ai-ops-manifest.json` at project root.

## How install/update/uninstall behave

- Managed files are wrapped in an `ai-ops` section with metadata (`sourceHash`, `generatedAt`).
- If a file already has an `ai-ops` section, only that section is replaced.
- If a file has no managed section, generated content is appended and user content is preserved.
- `uninstall` removes only managed sections for appended files and keeps user-authored content.

## Init flow summary

`ai-ops init` prompts for:

1. Tool selection (`claude-code`, `codex`, `gemini`)
2. Monorepo confirmation
3. Preset selection per workspace
4. Domain rule fine-tuning per workspace
5. Optional settings installation

Preset and rules are loaded from:

- `apps/cli/data/presets.yaml`
- `apps/cli/data/rules/*.yaml`

## Local development

From repo root:

```bash
npm install
npm run build
npm run compile
npm test
```

From `apps/cli` workspace:

```bash
npm run build --workspace=apps/cli
npm run test --workspace=apps/cli
```

## Related docs

- Master blueprint: [`docs/plan.md`](../../docs/plan.md)
- Implementation playbook: [`docs/implementation-playbook.md`](../../docs/implementation-playbook.md)

## License

MIT
