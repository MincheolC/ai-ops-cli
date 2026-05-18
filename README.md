# ai-ops-cli

`ai-ops-cli`의 다음 major breaking model을 설계하고 구현한 모노레포입니다. 새 제품 정의는 “프로젝트에는 AI agent operating layer를 설치하고, 사용자 환경에는 agent skills/subagents를 설치한다”입니다.

현재 repo 구현은 이 operating layer 모델을 기준으로 동작합니다. old rules + skills scaffolder 모델은 deprecated 문맥으로만 남깁니다.

## 목표 모델

```mermaid
flowchart LR
  cli["ai-ops CLI"] --> project["Project repo<br/>agent operating layer"]
  cli --> global["Global tool home<br/>skills / subagents"]

  project --> entry["AGENTS.md<br/>canonical entrypoint"]
  project --> adapters["GEMINI.md / CLAUDE.md<br/>thin adapters"]
  project --> docs["docs/agent/*<br/>docs/business/*<br/>docs/docs-status.md"]
  project --> state[".ai-ops/manifest.json<br/>.ai-ops/context-layer.json"]
  project --> packs["optional packs<br/>docs/specs/*"]

  global --> skills["reference / task skills"]
  global --> subagents["subagents"]
```

## Repository Layout

```text
.
├── apps/
│   └── cli/
│       ├── src/
│       │   ├── bin/        # CLI entrypoint
│       │   ├── commands/   # init/diff/audit/update/uninstall/skill/subagent/pack
│       │   ├── core/       # schemas, loader, renderer, registry, project layer
│       │   └── lib/        # global asset and legacy helper utilities
│       ├── data/
│       │   ├── context-layer/ # project operating layer templates
│       │   ├── skills/     # global skill source/catalog data
│       │   ├── packs/      # optional project pack source data
│       │   ├── subagents/  # global subagent source/catalog 데이터
│       │   └── presets.yaml
│       └── README.md       # package-level operating layer contract
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
- `docs/agent/workflow.md`
- `docs/agent/rules/*`
- `docs/agent/checks/*`
- `docs/agent/maps/codebase-map.md`
- `docs/business/business-rules.md`
- `docs/docs-status.md`
- `.ai-ops/manifest.json`
- `.ai-ops/context-layer.json`

`AGENTS.md`가 canonical entrypoint입니다. `GEMINI.md`와 `CLAUDE.md`는 tool adapter로만 두고 운영 규칙을 중복하지 않습니다.

## Global Assets

skills와 subagents는 프로젝트에 복사하지 않습니다. 각 도구의 user/global discovery 규칙에 맞춰 설치하고, project manifest에는 기록하지 않습니다.
global asset 명령은 `AI_OPS_HOME` 또는 `HOME`이 있어야 실행됩니다. 둘 다 없으면 cwd fallback 없이 실패합니다.

유지하는 global asset 종류:

- reference skills
- task skills
- subagents

현재 skill lifecycle은 global registry만 사용합니다.

```bash
ai-ops skill list
ai-ops skill install skill-load-check --tool codex
ai-ops skill install doc-impact-reviewer --tool codex
ai-ops skill diff
ai-ops skill update
ai-ops skill uninstall skill-load-check
```

`doc-impact-reviewer`는 변경 완료 또는 커밋 직전에 diff를 보고 갱신해야 할 운영 문서 후보를 판정하는 task skill입니다. 수동으로 `$doc-impact-reviewer`를 호출해 사용하며, 사용자 확인 전에는 문서를 수정하지 않고 직접 staging/commit도 하지 않습니다.

Subagent lifecycle도 global registry만 사용합니다.

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

`spec-lifecycle` pack은 `.ai-ops/manifest.json`이 있는 project operating layer 안에서만 동작합니다. 설치 시 `docs/specs/README.md`와 `docs/specs/README.ko.md`는 `Reserved` 문서로 context-layer와 `docs/docs-status.md`에 기록하고, `.gitkeep` 파일은 일반 pack file로만 manifest에 기록합니다.

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

자주 쓰는 명령:

```bash
# Build and print CLI help from dist
npm run compile

# Workspace watch mode
npm run dev

# Lint + test
npm run check
```

코드와 운영 문서 변경은 `npm run check`를 기본 검증으로 사용합니다. CLI 배포 산출물 확인은 `npm run build`와 `npm run compile`을 함께 사용합니다.

Self-dogfood 검증은 이 repo에서 root `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `docs/agent/*`, `docs/business/*`, `docs/docs-status.md`, `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`를 실제 설치한 뒤 수행합니다. legacy `.claude/CLAUDE.md`와 `.claude/rules/*`는 공식 operating layer가 아니며, Claude Code adapter는 root `CLAUDE.md`만 사용합니다.

## Docs

- [Master blueprint](./docs/plan.md)
- [Implementation playbook](./docs/implementation-playbook.md)
- [Rule authoring guide](./docs/rule-authoring-guide.md)

## Release

Release scripts:

```bash
npm run publish:patch
npm run publish:minor
npm run publish:major
```

## License

MIT
