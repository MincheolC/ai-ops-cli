# ai-ops-scaffolder

Monorepo for building and releasing `ai-ops-cli`, a CLI that scaffolds and manages AI tool rules for software projects.

## Overview

This repository is now CLI-centered:

- Runtime package: `apps/cli` (`ai-ops-cli`)
- Compiler/core logic is embedded under `apps/cli/src/core`
- Rule source of truth is embedded under `apps/cli/data`

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
│       │   ├── core/       # rule compiler core (inlined)
│       │   └── lib/        # file install/uninstall helpers
│       ├── data/
│       │   ├── rules/      # rule YAML files
│       │   └── presets.yaml
│       └── README.md       # package-level usage docs
├── docs/
│   ├── references/         # collected tool references (not published to npm)
│   └── *.md
└── scripts/
    └── publish.sh          # release script (CLI-only publish)
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
# Show compiled CLI help
npm run compile

# Watch mode (workspace scripts)
npm run dev

# Lint + test
npm run check
```

## Local CLI Usage

After build, run:

```bash
node apps/cli/dist/bin/index.js --help
```

Package-level commands are documented in:

- `apps/cli/README.md`

## Release

Release scripts (root):

```bash
npm run publish:patch
npm run publish:minor
npm run publish:major
```

`scripts/publish.sh` does:

1. test
2. build
3. bump `apps/cli` version
4. commit + tag
5. publish `ai-ops-cli` to npm

## License

MIT
