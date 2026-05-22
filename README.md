# ai-ops-cli

[Korean](./README.ko.md)

`ai-ops-cli` is the monorepo for designing and implementing the next major breaking model of `ai-ops-cli`. The product definition is: install and manage the operating layer and global runtime integrations needed for project/agent work.

The current implementation follows the project operating layer model and exposes `ai-ops integration ...` for bundled user/global runtime workflows. Low-level component commands for skills, subagents, Codex hooks, and user-local receipts remain available for debugging and direct management. The old rules + skills scaffolder model remains only as deprecated context.

## Target Model

```mermaid
flowchart LR
  cli["ai-ops CLI"] --> project["Project repo<br/>agent operating layer"]
  cli --> integrations["User/global runtime<br/>ai-ops integrations"]

  project --> entry["AGENTS.md<br/>canonical entrypoint"]
  project --> adapters["GEMINI.md / CLAUDE.md<br/>thin adapters"]
  project --> docs["docs/agent/*<br/>docs/business/*<br/>docs/docs-status.md"]
  project --> state[".ai-ops/manifest.json<br/>.ai-ops/context-layer.json"]
  project --> packs["optional packs<br/>docs/specs/*"]

  integrations --> skills["skills"]
  integrations --> subagents["subagents"]
  integrations --> hooks["Codex hooks / runners"]
  integrations --> receipts["user-local receipts / config"]
```

## Repository Layout

```text
.
├── apps/
│   ├── cli/
│   │   ├── src/
│   │   │   ├── bin/        # CLI entrypoint
│   │   │   ├── commands/   # init/diff/audit/update/uninstall/skill/subagent/pack/integration/hooks
│   │   │   ├── core/       # schemas, loader, renderer, registry, project layer, integrations
│   │   │   └── lib/        # integration component and legacy helper utilities
│   │   ├── data/
│   │   │   ├── context-layer/ # project operating layer templates
│   │   │   ├── integrations/  # integration catalog data
│   │   │   ├── skills/        # skill component source/catalog data
│   │   │   ├── packs/         # optional project pack source data
│   │   │   └── subagents/     # subagent component source/catalog data
│   │   └── README.md          # package-level operating layer and integrations contract
│   └── studio/
│       ├── src/               # Tauri/Vite React read-only Studio UI
│       ├── src-tauri/         # desktop shell and snapshot bridge
│       └── README.md          # Studio Dev MVP guide
├── docs/
│   ├── plan.md                     # master blueprint
│   ├── implementation-playbook.md  # phase execution guide
│   └── references/                 # collected tool references
└── scripts/
    └── publish.sh                  # CLI release script
```

## Project Operating Layer

In the new model, the project repo receives these operating documents and state files:

- `AGENTS.md`
- `GEMINI.md`
- `CLAUDE.md`
- `docs/agent/rules/00-agent-baseline.md`
- `docs/agent/workflow.md`
- `docs/agent/terminology.md`
- `docs/agent/rules/*`
- `docs/agent/project-rules/*.md` (project-owned, when present)
- `docs/agent/checks/impact-checklist.md`
- `docs/agent/maps/codebase-map.md`
- `docs/business/terminology.md`
- `docs/business/business-rules.md`
- `docs/docs-status.md`
- `.ai-ops/manifest.json`
- `.ai-ops/context-layer.json`

`AGENTS.md` is the canonical entrypoint. `docs/agent/rules/00-agent-baseline.md` is read immediately after `AGENTS.md` and contains the default collaboration posture, communication rules, code philosophy, naming rules, and planning defaults. `GEMINI.md` and `CLAUDE.md` are thin tool adapters and should not duplicate canonical operating rules.

## Editing FAQ

### What does `ai-ops update` overwrite?

`AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `docs/agent/rules/*`, `docs/agent/checks/impact-checklist.md`, `docs/agent/terminology.md`, and `docs/agent/workflow.md` are ai-ops managed documents. In these files, the region from `<!-- ai-ops:start -->` through `<!-- ai-ops:end -->` is CLI template content. `ai-ops update` reapplies the current CLI template to that region. User edits inside that region are not preserved across update.

`docs/agent/project-rules/*.md` is project-owned and is not overwritten by `ai-ops update --force`.

`.ai-ops/manifest.json` and `.ai-ops/context-layer.json` are also not direct-edit files. They are CLI state files for installation state and document indexing.

### Which files should users edit directly?

Project knowledge belongs in project-owned documents. The default project-owned documents are `docs/agent/maps/codebase-map.md`, `docs/business/terminology.md`, `docs/business/business-rules.md`, and `docs/docs-status.md`. Project-specific agent behavior rules belong in `docs/agent/project-rules/*.md`. `docs/agent/maps/codebase-map.md`, `docs/business/terminology.md`, and `docs/business/business-rules.md` start as Reserved templates, but once the project fills them with real content, update does not automatically overwrite them.

`docs/docs-status.md` is project-owned, but it is not a free-form notebook. It is the context-layer registry. Update it together with document status/frontmatter changes; the update flow may also normalize its table from the manifest and current document frontmatter.

### Where should project-specific agent rules go?

Use `docs/agent/project-rules/*.md`. Files in this directory are project-owned context documents when they have valid operating-layer frontmatter. `ai-ops update`, `diff`, and `audit` discover them, track them in `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`, and `docs/docs-status.md`, and preserve their content across forced updates.

`docs/references/codex/` in this repo is local reference material for ai-ops-cli development. It is not packaged or installed into other project operating layers.

## ai-ops Integrations

Integrations are user/global runtime features that help agent work happen across projects. They can be composed from skills, subagents, Codex hooks, hook runners, and user-local receipts/config. These components are not copied into the project repo and are not recorded in the project manifest.

Integration component commands require `AI_OPS_HOME` or `HOME`. If neither exists, they fail closed instead of falling back to the current working directory.

Maintained runtime surfaces:

- integrations
- reference skills
- task skills
- subagents
- Codex hooks
- Codex safe permissions
- user-local context-promotion receipts

Integration lifecycle commands:

```bash
ai-ops integration list
ai-ops integration install context-promotion
ai-ops integration install pc
ai-ops integration status pc
ai-ops integration uninstall pc
```

`context-promotion` installs the `context-promotion-review` Codex skill, a Codex `PostToolUse` hook, and user-local receipt workflow for reusable operating knowledge review after `git commit`.

`pc` installs the `pc` Codex skill and a Codex `PostToolUse` hook runner. After a successful `git commit`, the hook asks Codex to continue into `$pc:done` only when `~/.personal-project-contexts/` already has a matching workspace, active workstream, and current repo scope. It does not create pc context for unprepared repositories.

Codex safe permissions can reduce repeated approval prompts for the narrow user-local work used by `pc` and `context-promotion-review`:

```bash
ai-ops codex-permissions install safe-local
ai-ops codex-permissions status safe-local
ai-ops codex-permissions uninstall safe-local
```

`safe-local` upserts a user-level Codex permission profile named `ai-ops-safe-local` in `~/.codex/config.toml`. It grants write access to `~/.personal-project-contexts`, `${AI_OPS_HOME:-$HOME}/.ai-ops/context-promotion`, and `.codex/plans` under active project roots while keeping `.git` read-only. It installs Codex-compatible env-file protection rules by validating the generated profile against the installed Codex runtime and choosing the first accepted syntax. If Codex validation is unavailable, it uses a portable compatibility syntax with a warning; if Codex is available but no candidate validates, it fails closed without writing `config.toml`. It does not install `PermissionRequest` hooks or command allow rules.

For an ai-coding worker, keep Codex subprocesses run-scoped and let the orchestrator own commits, pushes, and PR creation:

```bash
codex exec --ignore-user-config --ignore-rules --cd "$WORKTREE" \
  -c 'approval_policy="never"' \
  -c 'default_permissions=":read-only"'

codex exec --ignore-user-config --ignore-rules --cd "$WORKTREE" \
  -c 'approval_policy="never"' \
  -c 'default_permissions="ai-worker-impl"' \
  -c 'permissions.ai-worker-impl.filesystem.":minimal"="read"' \
  -c 'permissions.ai-worker-impl.filesystem.":project_roots"."."="write"' \
  -c 'permissions.ai-worker-impl.filesystem.":project_roots".".git"="read"' \
  -c 'permissions.ai-worker-impl.filesystem.":project_roots".".codex/plans"="write"' \
  -c 'permissions.ai-worker-impl.network.enabled=false'
```

When adding env-file carveouts to run-scoped worker profiles, validate the exact TOML syntax against the installed Codex runtime; `safe-local` performs that validation automatically for its managed profile.

After each Codex run, the orchestrator should verify HEAD, branch refs, and changed-file scope. The orchestrator, not Codex, should run validation commands, create commits, push branches, and call `gh pr create --draft`.

Integration ownership is recorded in `.ai-ops/integrations-manifest.json` under the user/global runtime home. Uninstall removes only components that the integration install owned; pre-existing manual skill or hook installs are preserved.

Skill lifecycle commands:

```bash
ai-ops skill list
ai-ops skill install skill-load-check --tool codex
ai-ops skill install doc-impact-reviewer --tool codex
ai-ops skill install context-promotion-review --tool codex
ai-ops skill diff
ai-ops skill update
ai-ops skill uninstall skill-load-check
```

`doc-impact-reviewer` is a task skill that reviews diffs near the end of work or before commit and classifies operating-document update candidates. It is invoked manually with `$doc-impact-reviewer`; it does not edit documents, stage files, or commit before user approval.

Subagent lifecycle commands:

```bash
ai-ops subagent list
ai-ops subagent install security-gate --tool codex
ai-ops subagent diff
ai-ops subagent update
ai-ops subagent uninstall security-gate
```

Tool-specific install paths:

- Codex: `.codex/agents/<id>.toml`
- Claude Code: `.claude/agents/<id>.md`
- Gemini CLI: `.gemini/agents/<id>.md`
- State file: `.ai-ops/subagents-manifest.json`

Low-level component commands remain available. Use them when you need to install a single skill, inspect a Codex hook, or manage context-promotion receipts directly.

## Optional Specs Pack

`docs/specs/` is the fixed optional pack location. Install it only for projects that need the spec lifecycle.

```bash
ai-ops init --tool codex
ai-ops pack list
ai-ops pack install spec-lifecycle
ai-ops pack diff spec-lifecycle
ai-ops pack update spec-lifecycle
ai-ops pack uninstall spec-lifecycle
```

The `spec-lifecycle` pack runs only inside a project operating layer with `.ai-ops/manifest.json`. On install, `docs/specs/README.md` and `docs/specs/README.ko.md` are registered as Reserved documents in the context-layer and `docs/docs-status.md`; `.gitkeep` files are tracked only as regular pack files in the manifest. Project terminology remains centralized in `docs/business/terminology.md`.

Deprecated old model:

- root `specs/` is no longer the install location.
- old `ai-ops spec init` is replaced by the optional pack install model.

## Deprecated Old Model

The following items may still appear in current code or older docs, but they are outside the new contract:

- preset-first init UX
- project-scope skill installation
- `ai-ops skill install --project`
- `.ai-ops-manifest.json`
- legacy manifest migration
- root `specs/`

This transition is a breaking release. Existing projects should run uninstall with the old CLI, install the new major CLI, and run init again with the new model.

## Development

From the repository root:

```bash
npm install
npm run build
npm test
```

## Studio Dev MVP

`apps/studio` is the desktop Dev MVP for `ai-ops Studio`: a project-bound, read-only control plane for the operating-layer graph in `.ai-ops/context-layer.json`. It previews project operating documents, audit diagnostics, runtime integration/component status, and app-local appearance preferences without adding a repo-wide explorer or mutation controls.

With the globally installed CLI, launch Studio against the current project:

```bash
ai-ops studio .
```

The global launcher currently supports macOS arm64 through the optional `ai-ops-studio-darwin-arm64` platform package. Source checkout development still uses the Tauri dev shell:

```bash
npm run studio:dev
```

Launch against another project root:

```bash
AI_OPS_STUDIO_PROJECT_ROOT=/path/to/project npm run studio:dev
```

Build and test the Studio workspace:

```bash
npm run studio:test
npm run studio:build
npm run studio:package:darwin-arm64
```

See [apps/studio/README.md](./apps/studio/README.md) for scope, boundaries, and smoke scenarios.

Common commands:

```bash
# Build and print CLI help from dist
npm run compile

# Workspace watch mode
npm run dev

# Lint + test
npm run check

# Studio desktop shell
ai-ops studio .
npm run studio:dev
npm run studio:build
npm run studio:test
```

Use `npm run check` as the default validation for code and operating-document changes. For CLI release artifacts, run both `npm run build` and `npm run compile`.

Self-dogfood validation installs the root `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `docs/agent/*`, `docs/business/*`, `docs/docs-status.md`, `.ai-ops/manifest.json`, and `.ai-ops/context-layer.json` in this repo. Legacy `.claude/CLAUDE.md` and `.claude/rules/*` are not part of the official operating layer; the Claude Code adapter is the root `CLAUDE.md`.

## Docs

- [Master blueprint](./docs/plan.md)
- [Implementation playbook](./docs/implementation-playbook.md)

## Release

Release scripts:

```bash
npm run publish:patch
npm run publish:minor
npm run publish:major
```

## License

MIT
