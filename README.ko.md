# ai-ops-cli

[English](./README.md)

`ai-ops-cli`의 다음 major breaking model을 설계하고 구현한 모노레포입니다. 제품 정의는 “프로젝트/에이전트 작업에 필요한 operating layer와 global runtime integration을 설치하고 관리한다”입니다.

현재 repo 구현은 project operating layer 모델과 bundled user/global runtime workflow를 다루는 `ai-ops integration ...` 명령을 제공합니다. skill, subagent, Codex hook, user-local receipt를 다루는 low-level component 명령은 디버그와 개별 관리 용도로 계속 사용할 수 있습니다. old rules + skills scaffolder 모델은 deprecated 문맥으로만 남깁니다.

## 목표 모델

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

## 저장소 구조

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

새 모델에서 project repo에 설치되는 대상은 다음 운영 문서와 상태 파일입니다.

- `AGENTS.md`
- `GEMINI.md`
- `CLAUDE.md`
- `docs/agent/rules/00-agent-baseline.md`
- `docs/agent/workflow.md`
- `docs/agent/terminology.md`
- `docs/agent/rules/*`
- `docs/agent/checks/impact-checklist.md`
- `docs/agent/maps/codebase-map.md`
- `docs/business/terminology.md`
- `docs/business/business-rules.md`
- `docs/docs-status.md`
- `.ai-ops/manifest.json`
- `.ai-ops/context-layer.json`

`AGENTS.md`가 canonical entrypoint입니다. `docs/agent/rules/00-agent-baseline.md`는 협업 태도, 커뮤니케이션, 코드 철학, naming, planning 기본값을 담고 `AGENTS.md` 직후 먼저 읽습니다. `GEMINI.md`와 `CLAUDE.md`는 tool adapter로만 두고 운영 규칙을 중복하지 않습니다.

## 수정 FAQ

### `ai-ops update`가 덮어쓰는 파일은 무엇인가요?

`AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `docs/agent/rules/*`, `docs/agent/checks/impact-checklist.md`, `docs/agent/terminology.md`, `docs/agent/workflow.md`는 ai-ops managed 문서입니다. 이 파일의 `<!-- ai-ops:start -->`부터 `<!-- ai-ops:end -->`까지는 CLI 템플릿 영역이고, `ai-ops update` 때 현재 CLI 템플릿으로 다시 적용됩니다. 사용자가 이 영역을 직접 수정하면 다음 update에서 유지되지 않습니다.

`.ai-ops/manifest.json`과 `.ai-ops/context-layer.json`도 직접 편집 대상이 아닙니다. 각각 설치 상태와 문서 index를 기록하는 CLI 상태 파일입니다.

### 사용자가 직접 수정해야 하는 파일은 무엇인가요?

프로젝트 지식은 project-owned 문서에 적습니다. 기본 project-owned 문서는 `docs/agent/maps/codebase-map.md`, `docs/business/terminology.md`, `docs/business/business-rules.md`, `docs/docs-status.md`입니다. `docs/agent/maps/codebase-map.md`, `docs/business/terminology.md`, `docs/business/business-rules.md`는 처음에는 Reserved 템플릿이지만, 프로젝트가 실제 내용을 채운 뒤에는 update가 자동으로 덮어쓰지 않습니다.

`docs/docs-status.md`는 project-owned 문서이지만 자유 메모장이 아니라 context-layer registry입니다. 문서 status/frontmatter를 바꿀 때 함께 맞추는 파일이며, update 과정에서 manifest와 실제 문서 frontmatter 기준으로 테이블이 정리될 수 있습니다.

### 프로젝트 고유 agent rule은 어디에 적나요?

현재 기본 layer에는 프로젝트 구조와 비즈니스 규칙을 담는 project-owned 문서가 있지만, 프로젝트별 agent 행동 규칙만을 위한 별도 Active 문서는 아직 first-class 템플릿으로 열려 있지 않습니다. 그래서 `AGENTS.md`의 managed 영역이나 tool adapter에 직접 규칙을 추가하는 방식은 update-safe한 계약이 아닙니다.

프로젝트별 agent rule을 안정적으로 지원하려면 `docs/agent/rules/project-rules.md` 같은 project-owned Active 문서를 추가하고, manifest/context-layer/docs-status가 함께 추적하도록 제품 계약을 확장하는 것이 다음 개선 후보입니다.

## ai-ops Integrations

Integration은 여러 프로젝트에서 agent 작업을 돕는 user/global runtime 기능 단위입니다. skill, subagent, Codex hook, hook runner, user-local receipt/config 같은 component로 구성될 수 있습니다. 이 component들은 프로젝트에 복사하지 않고 project manifest에도 기록하지 않습니다.

Integration component 명령은 `AI_OPS_HOME` 또는 `HOME`이 있어야 실행됩니다. 둘 다 없으면 cwd fallback 없이 실패합니다.

유지하는 runtime 표면:

- integrations
- reference skills
- task skills
- subagents
- Codex hooks
- user-local context-promotion receipts

Integration lifecycle 명령:

```bash
ai-ops integration list
ai-ops integration install context-promotion
ai-ops integration install pc
ai-ops integration status pc
ai-ops integration uninstall pc
```

`context-promotion`은 `context-promotion-review` Codex skill, Codex `PostToolUse` hook, user-local receipt workflow를 설치해 `git commit` 이후 재사용 가능한 운영 지식 승격 검토를 돕습니다.

`pc`는 `pc` Codex skill과 Codex `PostToolUse` hook runner를 설치합니다. 성공적인 `git commit` 이후 `~/.personal-project-contexts/`에 matching workspace, active workstream, current repo scope가 준비된 경우에만 Codex가 `$pc:done`으로 이어가게 합니다. 준비되지 않은 repository에는 pc context를 새로 만들지 않습니다.

Integration 소유권은 user/global runtime home 아래 `.ai-ops/integrations-manifest.json`에 기록됩니다. Uninstall은 integration install이 소유한 component만 제거하고, 기존에 수동 설치되어 있던 skill이나 hook은 보존합니다.

Skill lifecycle 명령:

```bash
ai-ops skill list
ai-ops skill install skill-load-check --tool codex
ai-ops skill install doc-impact-reviewer --tool codex
ai-ops skill install context-promotion-review --tool codex
ai-ops skill diff
ai-ops skill update
ai-ops skill uninstall skill-load-check
```

`doc-impact-reviewer`는 변경 완료 또는 커밋 직전에 diff를 보고 갱신해야 할 운영 문서 후보를 판정하는 task skill입니다. 수동으로 `$doc-impact-reviewer`를 호출해 사용하며, 사용자 확인 전에는 문서를 수정하지 않고 직접 staging/commit도 하지 않습니다.

Subagent lifecycle 명령:

```bash
ai-ops subagent list
ai-ops subagent install security-gate --tool codex
ai-ops subagent diff
ai-ops subagent update
ai-ops subagent uninstall security-gate
```

설치 위치는 도구별 global discovery 경로입니다.

- Codex: `.codex/agents/<id>.toml`
- Claude Code: `.claude/agents/<id>.md`
- Gemini CLI: `.gemini/agents/<id>.md`
- 상태 파일: `.ai-ops/subagents-manifest.json`

Low-level component 명령도 계속 사용할 수 있습니다. 단일 skill 설치, Codex hook 점검, context-promotion receipt 직접 관리가 필요할 때 사용합니다.

## Optional Specs Pack

`docs/specs/`는 optional pack 위치로 고정합니다. spec lifecycle이 필요한 프로젝트만 설치합니다.

```bash
ai-ops init --tool codex
ai-ops pack list
ai-ops pack install spec-lifecycle
ai-ops pack diff spec-lifecycle
ai-ops pack update spec-lifecycle
ai-ops pack uninstall spec-lifecycle
```

`spec-lifecycle` pack은 `.ai-ops/manifest.json`이 있는 project operating layer 안에서만 동작합니다. 설치 시 `docs/specs/README.md`와 `docs/specs/README.ko.md`는 `Reserved` 문서로 context-layer와 `docs/docs-status.md`에 기록하고, `.gitkeep` 파일은 일반 pack file로만 manifest에 기록합니다. 프로젝트 용어는 계속 `docs/business/terminology.md`에서 중앙 관리합니다.

Deprecated old model:

- root `specs/`는 새 모델의 설치 위치가 아닙니다.
- old `ai-ops spec init` 방식은 optional pack 설치 모델로 대체되었습니다.

## Deprecated Old Model

다음 항목은 현재 코드나 과거 문서에 남아 있을 수 있지만 새 계약에서는 제거 대상입니다.

- preset-first init UX
- project scope skill 설치
- `ai-ops skill install --project`
- `.ai-ops-manifest.json`
- legacy manifest migration
- root `specs/`

이번 전환은 breaking release입니다. 기존 프로젝트는 old CLI로 uninstall한 뒤 새 major CLI로 다시 init합니다.

## Development

저장소 루트 기준:

```bash
npm install
npm run build
npm test
```

## Studio Dev MVP

`apps/studio`는 `ai-ops Studio`의 desktop Dev MVP입니다. `.ai-ops/context-layer.json`에 기록된 operating-layer graph만 읽는 project-bound read-only control plane이며, project operating document preview, audit diagnostics, runtime integration/component status, app-local appearance preference를 보여줍니다. repo-wide explorer나 mutation control은 v1 범위에 포함하지 않습니다.

현재 repo를 대상으로 실행:

```bash
npm run studio:dev
```

다른 project root를 대상으로 실행:

```bash
AI_OPS_STUDIO_PROJECT_ROOT=/path/to/project npm run studio:dev
```

Studio workspace build/test:

```bash
npm run studio:test
npm run studio:build
```

범위, 경계, smoke scenario는 [apps/studio/README.ko.md](./apps/studio/README.ko.md)를 봅니다.

자주 쓰는 명령:

```bash
# Build and print CLI help from dist
npm run compile

# Workspace watch mode
npm run dev

# Lint + test
npm run check

# Studio desktop shell
npm run studio:dev
npm run studio:build
npm run studio:test
```

코드와 운영 문서 변경은 `npm run check`를 기본 검증으로 사용합니다. CLI 배포 산출물 확인은 `npm run build`와 `npm run compile`을 함께 사용합니다.

Self-dogfood 검증은 이 repo에서 root `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `docs/agent/*`, `docs/business/*`, `docs/docs-status.md`, `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`를 실제 설치한 뒤 수행합니다. legacy `.claude/CLAUDE.md`와 `.claude/rules/*`는 공식 operating layer가 아니며, Claude Code adapter는 root `CLAUDE.md`만 사용합니다.

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
