# ai-ops-scaffolder

Monorepo for building and releasing `ai-ops-cli`, a CLI that scaffolds project rules and agent skill packages from centralized metadata.

## Overview

This repository is CLI-centered:

- Runtime package: `apps/cli` (`ai-ops-cli`)
- Rule/compiler core logic: `apps/cli/src/core`
- Data source (SSOT): `apps/cli/data`

Supported tools:

- Claude Code
- Codex
- Gemini CLI

## Repository Layout

```text
.
├── apps/
│   └── cli/
│       ├── src/
│       │   ├── bin/        # CLI entrypoint
│       │   ├── commands/   # init/skill/update/diff/uninstall
│       │   ├── core/       # schemas, loader, renderer, registry
│       │   └── lib/        # install/uninstall/settings helpers
│       ├── data/
│       │   ├── rules/      # Rule YAML files
│       │   ├── skills/     # Skill catalog + reference/task skill sources
│       │   └── presets.yaml
│       └── README.md       # package-level usage docs
├── docs/
│   ├── plan.md                     # master blueprint (rebuild-level)
│   ├── implementation-playbook.md  # implementation/operation playbook
│   └── references/                 # collected tool references
└── scripts/
    └── publish.sh                  # CLI release script
```

## Development

From repository root:

```bash
npm install
npm run build
npm test
```

Useful commands:

```bash
# Build and print CLI help from dist
npm run compile

# Workspace watch mode
npm run dev

# Lint + test
npm run check
```

## Local Skill Verification Before Publish

Before `npm publish`, verify the sample `skill-load-check` package end-to-end.

```bash
npm run build
export AI_OPS_HOME="$(mktemp -d)"
node apps/cli/dist/bin/index.js skill install skill-load-check --tool codex
find "$AI_OPS_HOME/.agents/skills/skill-load-check" -maxdepth 2 -type f | sort
node "$AI_OPS_HOME/.agents/skills/skill-load-check/scripts/loaded.js"
```

The script must print:

```text
A Skill loaded
```

For a repo-local check, use:

```bash
node apps/cli/dist/bin/index.js skill install skill-load-check --project --tool codex
find ./.agents/skills/skill-load-check -maxdepth 2 -type f | sort
node ./.agents/skills/skill-load-check/scripts/loaded.js
```

After the file-level check passes, restart the target agent session if needed and verify that the tool can discover the installed skill metadata.

## Local CLI Usage

After build:

```bash
node apps/cli/dist/bin/index.js --help
```

Package usage docs:

- `apps/cli/README.md`

Architecture and implementation docs:

- `docs/plan.md`
- `docs/implementation-playbook.md`

## Release

Release scripts (root):

```bash
npm run publish:patch
npm run publish:minor
npm run publish:major
```

`scripts/publish.sh` flow:

1. Run tests
2. Build CLI
3. Bump `apps/cli` version
4. Create commit and tag
5. Publish `ai-ops-cli` to npm

## License

MIT
