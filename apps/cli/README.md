# ai-ops-cli

`ai-ops-cli`는 다음 major release에서 프로젝트에 AI agent operating layer를 설치하고, 사용자 환경에 agent skills/subagents를 설치하는 CLI로 전환됩니다.

이 문서는 Phase 0에서 고정한 planned breaking model을 설명합니다. 현재 npm 배포 또는 현재 코드의 일부 명령은 아직 old rules + skills scaffolder 모델로 동작할 수 있습니다.

## Planned Breaking Model

```mermaid
flowchart TD
  init["ai-ops init"] --> layer["Project operating layer 설치"]
  layer --> entry["AGENTS.md canonical entrypoint"]
  layer --> adapters["GEMINI.md / CLAUDE.md adapters"]
  layer --> docs["docs/agent/* / docs/business/*"]
  layer --> state[".ai-ops/manifest.json / context-layer.json"]

  skill["ai-ops skill ..."] --> globalSkills["Global skills only"]
  subagent["ai-ops subagent ..."] --> globalSubagents["Global subagents only"]
  specs["optional pack"] --> docsSpecs["docs/specs/"]
```

핵심 경계:

- project scope는 operating layer 문서만 관리합니다.
- global scope는 skills/subagents만 관리합니다.
- `AGENTS.md`가 canonical entrypoint입니다.
- `GEMINI.md`와 `CLAUDE.md`는 `AGENTS.md`를 기준으로 삼게 하는 adapter입니다.
- `docs/specs/`는 optional pack 위치입니다.

## 설치 대상

Project repo:

```text
AGENTS.md
GEMINI.md
CLAUDE.md
docs/agent/workflow.md
docs/agent/rules/routing-rules.md
docs/agent/rules/doc-update-rules.md
docs/agent/rules/stop-rules.md
docs/agent/checks/impact-checklist.md
docs/agent/checks/review-checklist.md
docs/agent/maps/codebase-map.md
docs/business/business-rules.md
docs/docs-status.md
.ai-ops/manifest.json
.ai-ops/context-layer.json
```

Global tool home:

```text
skills/*
subagents/*
```

## 목표 CLI 표면

```text
ai-ops [command]

Commands:
  init       Install or refresh the project agent operating layer
  diff       Show drift in the project operating layer
  update     Re-apply the project operating layer
  audit      Check frontmatter, docs-status, manifest, and context-layer consistency
  uninstall  Remove project-managed operating layer files
  skill      Manage global agent skills
  subagent   Manage global agent subagents
```

`--tool`은 유지합니다. Codex, Claude Code, Gemini CLI가 서로 다른 discovery 위치와 adapter 파일을 사용하기 때문입니다.

## Deprecated Old Model

다음 동작은 현재 코드나 과거 README에 남아 있을 수 있지만 새 계약에서는 제거 대상입니다.

- preset-first init UX
- project scope skill 설치
- `ai-ops skill install --project`
- project-installed skill metadata
- `.ai-ops-manifest.json`
- legacy manifest migration
- root `specs/`

기존 프로젝트 자동 마이그레이션은 제공하지 않습니다. 기존 사용자는 old CLI로 `ai-ops uninstall`을 실행한 뒤 새 major CLI로 `ai-ops init`을 다시 실행합니다.

## Old Model Command Notes

후속 phase 전까지 현재 CLI help에는 아래 old model 명령이 보일 수 있습니다.

```bash
ai-ops init
ai-ops skill install skill-load-check --tool codex
ai-ops skill install skill-load-check --project --tool codex
ai-ops spec init
ai-ops diff
ai-ops update
ai-ops uninstall
```

Deprecated old model 문맥에서만 유지되는 항목:

- `--project`는 project scope skill 설치용 old option입니다.
- `spec init`은 root `specs/`를 만드는 old command입니다.
- `.ai-ops-manifest.json`는 old project manifest입니다.

## 개발

저장소 루트 기준:

```bash
npm install
npm run build
npm run compile
npm test
```

CLI workspace만 확인할 때:

```bash
npm run build --workspace=apps/cli
npm run test --workspace=apps/cli
```

코드 변경 phase에서는 `npm run check`를 기본 검증으로 사용합니다. Phase 0은 문서 계약만 수정하므로 `npm test`가 필수 완료 기준은 아닙니다.

## 관련 문서

- [Master blueprint](../../docs/plan.md)
- [Implementation playbook](../../docs/implementation-playbook.md)
