# ai-ops Studio

[Korean](./README.ko.md)

`ai-ops Studio` is the desktop Dev MVP for inspecting a project's agent operating layer. It is a project-bound, read-only control plane: Project documents come from `.ai-ops/context-layer.json`, runtime assets are shown as user/global status, and Appearance preferences stay in app-local `localStorage`.

## Launch

With the globally installed CLI, run from the target project root:

```bash
ai-ops studio .
```

Or pass an explicit project root:

```bash
ai-ops studio /path/to/project
```

The global launcher currently supports macOS arm64 through the optional `ai-ops-studio-darwin-arm64` platform package.

For source checkout development, run from the repository root:

```bash
npm run studio:dev
```

Run against another project root:

```bash
AI_OPS_STUDIO_PROJECT_ROOT=/path/to/project npm run studio:dev
```

`studio:dev` builds the CLI first, then starts the Tauri dev shell. If `AI_OPS_STUDIO_PROJECT_ROOT` is already set, the script keeps it. Otherwise it uses the current repository root.

## Build And Test

```bash
npm run studio:test
npm run studio:build
npm run studio:package:darwin-arm64
```

Useful lower-level checks:

```bash
npm run test --workspace=apps/studio
npm run build --workspace=apps/studio
npm run tauri:check --workspace=apps/studio
npm run studio:package:darwin-arm64
node apps/cli/dist/bin/index.js studio snapshot --json
```

## V1 Scope

- Project Overview, Context Graph, Documents, and Audit read only the project operating layer snapshot.
- Runtime pages show Integrations, Skills, Subagents, and Hooks as user/global runtime status.
- Documents are preview-first Markdown views with metadata and trust warnings in the inspector.
- Appearance controls theme preset, color mode, density, Markdown size, and code block style through local app preferences.

## Data Boundary

- Project documents are loaded only from `.ai-ops/context-layer.json`.
- Project health is derived from `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`, `docs/docs-status.md`, document frontmatter, and audit issues.
- Runtime assets are catalog/install status only; they are not project-owned documents.
- Appearance preferences use `localStorage` under `ai-ops-studio.appearance.v1`.

## V1 Non-Goals

- Repo-wide explorer.
- Document editing.
- Runtime install, update, or uninstall.
- Always-on local web server.

## Smoke Scenarios

- Initialized project: run against this repository and visit Project Overview, Context Graph, Documents, Audit, Runtime pages, and Appearance.
- Uninitialized project: run with `AI_OPS_STUDIO_PROJECT_ROOT` pointing at an empty temp directory and verify the uninitialized state while Runtime and Appearance still render.
- Desktop width: check that nav, inspector panels, Markdown preview, Runtime details, and Appearance controls do not overlap or overflow.
- Narrow/mobile-ish width: check horizontal nav, wrapped badges, segmented controls, and long paths.
- Regression boundary: verify no repo-wide file explorer appears and no Install, Update, Uninstall, or Edit controls appear in v1 surfaces.
