# ai-ops Studio

[English](./README.md)

`ai-ops Studio`는 project agent operating layer를 점검하는 desktop Dev MVP입니다. 이 앱은 project-bound read-only control plane입니다. Project 문서는 `.ai-ops/context-layer.json`에서만 오고, runtime asset은 user/global status로만 표시하며, Appearance preference는 app-local `localStorage`에만 저장합니다.

## 실행

글로벌 설치된 CLI로 대상 project root에서 실행:

```bash
ai-ops studio .
```

또는 project root를 명시합니다:

```bash
ai-ops studio /path/to/project
```

글로벌 launcher는 현재 macOS arm64를 `ai-ops-studio-darwin-arm64` optional platform package로 지원합니다.

Source checkout 개발은 repo root에서 실행합니다:

```bash
npm run studio:dev
```

다른 project root를 대상으로 실행:

```bash
AI_OPS_STUDIO_PROJECT_ROOT=/path/to/project npm run studio:dev
```

`studio:dev`는 CLI를 먼저 build한 다음 Tauri dev shell을 시작합니다. `AI_OPS_STUDIO_PROJECT_ROOT`가 이미 설정되어 있으면 그 값을 유지하고, 없을 때만 현재 repo root를 사용합니다.

## Build And Test

```bash
npm run studio:test
npm run studio:build
npm run studio:package:darwin-arm64
```

하위 검증 명령:

```bash
npm run test --workspace=apps/studio
npm run build --workspace=apps/studio
npm run tauri:check --workspace=apps/studio
npm run studio:package:darwin-arm64
node apps/cli/dist/bin/index.js studio snapshot --json
```

## V1 Scope

- Project Overview, Context Graph, Documents, Audit은 project operating layer snapshot만 읽습니다.
- Runtime pages는 Integrations, Skills, Subagents, Hooks를 user/global runtime status로 보여줍니다.
- Documents는 preview-first Markdown view이며 metadata와 trust warning은 inspector에 표시합니다.
- Appearance는 theme preset, color mode, density, Markdown size, code block style을 local app preference로 저장합니다.

## Data Boundary

- Project document는 `.ai-ops/context-layer.json`에서만 로드합니다.
- Project health는 `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`, `docs/docs-status.md`, document frontmatter, audit issue에서 계산합니다.
- Runtime asset은 catalog/install status일 뿐 project-owned document가 아닙니다.
- Appearance preference는 `ai-ops-studio.appearance.v1` localStorage key를 사용합니다.

## V1 Non-Goals

- Repo-wide explorer.
- Document editing.
- Runtime install, update, uninstall.
- Always-on local web server.

## Smoke Scenarios

- Initialized project: 이 repo를 대상으로 실행하고 Project Overview, Context Graph, Documents, Audit, Runtime pages, Appearance를 확인합니다.
- Uninitialized project: `AI_OPS_STUDIO_PROJECT_ROOT`를 empty temp directory로 지정하고 uninitialized state가 보이면서 Runtime과 Appearance가 계속 렌더링되는지 확인합니다.
- Desktop width: nav, inspector panel, Markdown preview, Runtime details, Appearance controls가 겹치거나 넘치지 않는지 확인합니다.
- Narrow/mobile-ish width: horizontal nav, wrapped badge, segmented control, long path 표시를 확인합니다.
- Regression boundary: repo-wide file explorer가 보이지 않고 v1 surface에 Install, Update, Uninstall, Edit control이 없는지 확인합니다.
