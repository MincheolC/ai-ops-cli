# ai-ops-cli

CLI for managing core AI tool rules and agent skills across projects.

## Why this exists

`ai-ops-cli` reduces configuration drift across AI coding tools.

- different tools use different file layouts and loading models
- manual sync across tools is error-prone over time
- teams need a deterministic setup for shared core rules and installable skills

The CLI treats these as separate sources of truth:

- `apps/cli/data/rules/*.yaml`: always-loaded core rules only
- `apps/cli/data/skills/<skill-id>/`: installable skills
- `apps/cli/data/presets.yaml`: preset-to-core-rule and preset-to-skill mapping

## What this CLI provides

- interactive project initialization (`ai-ops init`)
- skill package installation and lifecycle management (`ai-ops skill ...`)
- source drift checks (`ai-ops diff`)
- deterministic re-apply (`ai-ops update`)
- managed cleanup (`ai-ops uninstall`)

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
# Initialize the current project
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

# Check project drift
ai-ops diff

# Re-apply current project state
ai-ops update
ai-ops update --force

# Remove project-managed files
ai-ops uninstall
```

## CLI Surface

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

- Project installation state is tracked in `.ai-ops-manifest.json`.
- User-scope skill state is tracked in `~/.ai-ops/skills-manifest.json`.
- `ai-ops skill` defaults to user scope. Use `--project` to keep a skill local to the current repo.

## Install / Update / Uninstall Behavior

- Managed project rule files are wrapped in an `ai-ops` section with metadata (`sourceHash`, `generatedAt`).
- If a rule file already has an `ai-ops` section, only that section is replaced.
- If a rule file has no managed section, generated content is appended and user content is preserved.
- Skill packages are written into dedicated directories and replaced as full package trees on update.
- `uninstall` removes only project-managed rule files and project-installed skill directories.
- User-scope skills are never removed by `ai-ops uninstall`.

## Init Flow Summary

`ai-ops init` prompts for:

1. Tool selection (`claude-code`, `codex`, `gemini`)
2. Monorepo confirmation
3. Workspace selection for monorepos
4. Preset selection per workspace
5. Locked core rules review
6. Recommended skill fine-tuning per workspace
7. One shared install scope for selected skills (`user` default or `project`)
8. Optional settings installation

Important behavior:

- core rules come from the preset directly and are not fine-tuned in `init`
- selected skills can be trimmed or expanded before installation
- when `user` scope is chosen, selected skills are written only to the global skill registry
- when `project` scope is chosen, selected skills are recorded in `.ai-ops-manifest.json`

Skill authoring rules live in `apps/cli/data/skills/README.md`.

## Local Development

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

Use the built-in `skill-load-check` task skill before publishing to npm.

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

After file placement is verified, use a real tool prompt that should trigger `skill-load-check` and confirm the tool discovers the skill metadata. If the tool caches skill discovery, restart that tool session before re-checking.

## Related Docs

- Master blueprint: [`docs/plan.md`](../../docs/plan.md)
- Implementation playbook: [`docs/implementation-playbook.md`](../../docs/implementation-playbook.md)

## License

MIT
