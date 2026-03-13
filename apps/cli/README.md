# ai-ops-cli

CLI for managing AI tool rules and agent skills across projects.

## Why this exists

`ai-ops-cli` reduces configuration drift across AI coding tools.

- Different tools use different file layouts and loading models.
- Manual sync across tools is error-prone over time.
- Teams need a deterministic, repeatable setup for AI pair-programming rules and skill packages.

The CLI uses centralized rule YAML, skill directories, and presets as SSOT and renders tool-native outputs into the current project or user environment.

## What this CLI provides

- Interactive project rule installation (`ai-ops init`)
- Skill package installation and lifecycle management (`ai-ops skill ...`)
- Source drift checks (`ai-ops diff`)
- Deterministic re-apply (`ai-ops update`)
- Managed cleanup (`ai-ops uninstall`)

## What this CLI does not provide

- Hosted backend or remote state
- In-CLI rule authoring UI
- IDE plugin management

## Supported tools and output layout

| Tool | Project rules output | Skill output |
| --- | --- | --- |
| Claude Code (`claude-code`) | `.claude/rules/<rule-id>.md`, `<workspace>/CLAUDE.md` | `.claude/skills/<skill-id>/` |
| Codex (`codex`) | `AGENTS.md`, `<workspace>/AGENTS.override.md` | `.agents/skills/<skill-id>/` |
| Gemini CLI (`gemini`) | `GEMINI.md`, `<workspace>/GEMINI.md` | `.agents/skills/<skill-id>/` |

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

# Install a skill globally (user scope by default)
ai-ops skill install skill-load-check --tool codex

# Install a skill only for the current project
ai-ops skill install skill-load-check --project --tool codex

# Inspect or update installed skills
ai-ops skill list
ai-ops skill diff
ai-ops skill update
ai-ops skill uninstall skill-load-check

# Check drift against current source hash
ai-ops diff

# Re-apply installed project rules (or force)
ai-ops update
ai-ops update --force

# Remove installed project files and manifest
ai-ops uninstall
```

## CLI surface

```text
ai-ops [command]

Commands:
  init       Initialize AI tool rules for a project
  skill      Manage agent skills
  update     Update installed rules
  diff       Show diff between installed and current rules
  uninstall  Remove installed rules and manifest

Options:
  --force        Force update even when no changes are detected (update only)
  -V, --version  Output version number
  -h, --help     Display help
```

Notes:

- Project rule installation state is tracked in `.ai-ops-manifest.json`.
- User-scope skill installation state is tracked in `~/.ai-ops/skills-manifest.json`.
- `ai-ops skill` defaults to user scope. Use `--project` to keep a skill local to the current repo.

## How install/update/uninstall behave

- Managed project rule files are wrapped in an `ai-ops` section with metadata (`sourceHash`, `generatedAt`).
- If a rule file already has an `ai-ops` section, only that section is replaced.
- If a rule file has no managed section, generated content is appended and user content is preserved.
- Skill packages are written into dedicated skill directories and replaced as full package trees on update.
- `uninstall` removes only project-managed rule files and project-installed skill directories.

## Init flow summary

`ai-ops init` prompts for:

1. Tool selection (`claude-code`, `codex`, `gemini`)
2. Monorepo confirmation
3. Preset selection per workspace
4. Domain rule fine-tuning per workspace
5. Optional settings installation

Preset and metadata are loaded from:

- `apps/cli/data/presets.yaml`
- `apps/cli/data/rules/*.yaml`
- `apps/cli/data/skills/<skill-id>/`

Skill authoring rules live in `apps/cli/data/skills/README.md`.

Selected reference skills are installed alongside project rules when their source rules are selected.

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

## Local Skill Loading Check

Use the built-in `skill-load-check` task skill before publishing to npm. It writes `scripts/loaded.js` with:

```js
console.log('A Skill loaded');
```

Recommended local flow:

```bash
# 1. Build the CLI
npm run build

# 2. Use an isolated user home so you do not pollute your real ~/.agents or ~/.claude
export AI_OPS_HOME="$(mktemp -d)"

# 3. Install the sample skill globally
node apps/cli/dist/bin/index.js skill install skill-load-check --tool codex

# 4. Verify files exist
find "$AI_OPS_HOME/.agents/skills/skill-load-check" -maxdepth 2 -type f | sort

# 5. Run the sample script manually
node "$AI_OPS_HOME/.agents/skills/skill-load-check/scripts/loaded.js"
```

Expected output:

```text
A Skill loaded
```

Project-scope verification:

```bash
node apps/cli/dist/bin/index.js skill install skill-load-check --project --tool codex
find ./.agents/skills/skill-load-check -maxdepth 2 -type f | sort
node ./.agents/skills/skill-load-check/scripts/loaded.js
```

After file placement is verified, trigger the agent with a prompt such as `validate that the installed skill-load-check skill is available` and confirm the tool discovers the skill metadata. If a tool caches skill discovery, restart that tool session before re-checking.

## Related docs

- Master blueprint: [`docs/plan.md`](../../docs/plan.md)
- Implementation playbook: [`docs/implementation-playbook.md`](../../docs/implementation-playbook.md)

## License

MIT
