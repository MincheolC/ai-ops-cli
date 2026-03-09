# ai-ops-scaffolder

Monorepo for building and releasing `ai-ops-cli`, a project-local CLI that scaffolds and manages AI tool rule files from centralized YAML rules.

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
│       │   ├── commands/   # init/update/diff/uninstall
│       │   ├── core/       # schemas, loader, renderer, plans
│       │   └── lib/        # install/uninstall/settings helpers
│       ├── data/
│       │   ├── rules/      # Rule YAML files
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
