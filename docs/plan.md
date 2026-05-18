# ai-ops agent operating layer master blueprint

## 요약

`ai-ops`는 프로젝트 안에 AI agent operating layer를 설치하고 유지하는 bash CLI다. 프로젝트에는 에이전트가 항상 읽어야 하는 운영 문서와 상태 인덱스만 둔다. skills와 subagents는 프로젝트에 복사하지 않고 사용자 환경의 global asset으로 설치한다.

이 문서는 다음 major breaking release의 기준 계약이다. 현재 repo 구현은 project operating layer, global skills, global subagents, optional packs 경계를 기준으로 동작하며, old rules + skills scaffolder 모델은 deprecated 문맥으로만 남긴다.

```text
Project repo
  AGENTS.md
  GEMINI.md / CLAUDE.md
  docs/agent/*
  docs/business/*
  docs/docs-status.md
  docs/specs/*        # optional pack
  .ai-ops/manifest.json
  .ai-ops/context-layer.json

Global tool home
  skills/*
  subagents/*
```

## 제품 정의

`ai-ops`의 책임은 프로젝트마다 흩어지는 에이전트 운영 지식을 한 계층으로 설치하고, drift를 감지하고, 안전하게 갱신하는 것이다.

- project scope: agent operating layer 문서와 `.ai-ops/*` 상태 파일
- global scope: reference/task skills와 subagents
- adapter scope: `GEMINI.md`, `CLAUDE.md`처럼 도구가 요구하는 얇은 진입 파일

이 경계를 통해 프로젝트별 지식은 repository에 남기고, 재사용 가능한 실행 능력은 사용자 환경에 둔다.

## 설치 대상

### Project operating layer

기본 설치 대상:

- `AGENTS.md`
- `GEMINI.md`
- `CLAUDE.md`
- `docs/agent/rules/00-agent-baseline.md`
- `docs/agent/workflow.md`
- `docs/agent/rules/routing-rules.md`
- `docs/agent/rules/doc-update-rules.md`
- `docs/agent/rules/stop-rules.md`
- `docs/agent/checks/impact-checklist.md`
- `docs/agent/checks/review-checklist.md`
- `docs/agent/maps/codebase-map.md`
- `docs/business/business-rules.md`
- `docs/docs-status.md`
- `.ai-ops/manifest.json`
- `.ai-ops/context-layer.json`

`AGENTS.md`는 canonical entrypoint다. `GEMINI.md`와 `CLAUDE.md`는 각 도구가 읽을 수 있도록 `AGENTS.md`를 우선 기준으로 삼으라는 adapter 역할만 한다. 중복된 canonical 문서를 피하기 위해 `docs/agent/AGENTS.md`는 만들지 않는다.

### Optional packs

`docs/specs/`는 optional pack 위치로 고정한다. spec lifecycle이 필요한 프로젝트만 설치한다.

Deprecated old model:

- root `specs/`는 더 이상 새 모델의 설치 위치가 아니다.
- 기존 `ai-ops spec init`의 root `specs/` scaffolding은 `ai-ops pack install spec-lifecycle`로 대체한다.
- `apps/cli/data/rules/*.yaml`와 `apps/cli/data/presets.yaml`은 새 모델의 설치 원천이 아니다. baseline rule은 `docs/agent/rules/00-agent-baseline.md`가 canonical source다.

### Global assets

global 설치 대상:

- reference skills
- task skills
- subagents

skills와 subagents는 프로젝트 운영 문서가 아니다. CLI는 각 도구의 global 또는 user-level discovery 규칙에 맞춰 설치한다.

## 문서 신뢰도 모델

operating layer 문서는 frontmatter와 `docs/docs-status.md`로 신뢰도를 관리한다.

공통 frontmatter:

```yaml
status: Active
layer: agent
owner: ai-ops
read_when:
  - before_task
update_when:
  - workflow_changes
```

기본 상태:

| 상태       | 의미                                           | 기본 적용 문서                       |
| ---------- | ---------------------------------------------- | ------------------------------------ |
| `Active`   | 에이전트가 판단 근거로 사용할 수 있음          | workflow, rules, checks              |
| `Reserved` | 자리만 만들었고 근거로 쓰면 안 됨             | codebase-map, business-rules, specs  |
| `Draft`    | 작성 중이며 사용 전 검토가 필요함              | 프로젝트가 직접 작성 중인 확장 문서 |
| `Archived` | 과거 기록이며 현재 운영 판단에 사용하지 않음   | deprecated 문서                      |

`Reserved` 문서는 비어 있거나 프로젝트별 보강 전 상태일 수 있다. 에이전트는 `Reserved` 문서를 현재 사실로 인용하지 않는다.

## 도구별 entrypoint 계약

| 도구       | entrypoint | 역할 |
| ---------- | ---------- | ---- |
| Codex      | `AGENTS.md` | canonical operating layer entrypoint |
| Gemini CLI | `GEMINI.md` | `AGENTS.md`를 기준으로 읽도록 안내하는 adapter |
| Claude Code | `CLAUDE.md` | `AGENTS.md`를 기준으로 읽도록 안내하는 adapter |

도구별 adapter에는 중복 운영 규칙을 넣지 않는다. adapter가 길어지는 경우 canonical 문서를 분리한 것이 아니라 중복을 만든 신호로 본다.

## 상태 파일

### `.ai-ops/manifest.json`

project operating layer 설치 상태를 기록한다.

추적 대상:

- 설치된 CLI 버전
- 선택된 도구 adapter
- 설치된 project layer 파일 목록
- 각 파일의 source hash
- optional pack 설치 여부
- 생성/갱신 시각

### `.ai-ops/context-layer.json`

에이전트가 문서 계층을 빠르게 탐색할 수 있는 index다.

추적 대상:

- 문서 경로
- frontmatter 상태
- layer
- read/update 조건
- content hash

`audit` 명령은 `manifest.json`, `context-layer.json`, 실제 파일, `docs/docs-status.md`의 불일치를 읽기 전용으로 검사한다.

## Scope 정책

새 모델은 scope를 단순화한다.

- project scope는 operating layer 문서만 관리한다.
- global scope는 skills/subagents만 관리한다.
- `skill` 명령은 project-local 설치 옵션을 제공하지 않는다.
- `skill` 명령에서 `--project`, `--global`, `--scope` 공개 옵션은 제거한다.
- `--tool`은 유지한다. 각 도구의 skill/subagent discovery 위치가 다르기 때문이다.

Deprecated old model:

- `--project` skill 설치는 제거 대상이다.
- `--global`과 `--scope`로 skill scope를 직접 지정하는 모델은 제거 대상이다.
- project scope skill 설치와 project-installed skill manifest 추적은 제거 대상이다.
- old `.ai-ops-manifest.json`는 새 `.ai-ops/manifest.json`로 대체한다.
- legacy manifest migration은 제공하지 않는다.

## Breaking policy

이번 전환은 breaking release다. 기존 프로젝트 자동 마이그레이션은 만들지 않는다.

기존 사용자는 다음 절차를 따른다.

1. old CLI로 `ai-ops uninstall`을 실행한다.
2. 새 major CLI를 설치한다.
3. 새 모델로 `ai-ops init`을 다시 실행한다.
4. 필요한 경우 optional `docs/specs/` pack을 설치한다.

이 정책은 복잡한 partial migration보다 운영 계층의 신뢰도를 우선한다. old manifest와 새 context-layer가 한 프로젝트에서 섞이면 에이전트가 stale 계약을 사실로 읽을 수 있기 때문이다.

## 명령 목표 계약

### `ai-ops init`

project operating layer를 설치한다.

```mermaid
flowchart TD
  Start["ai-ops init"] --> Tool["대상 도구 adapter 선택"]
  Tool --> Layer["project operating layer 파일 생성"]
  Layer --> Manifest[".ai-ops/manifest.json 기록"]
  Manifest --> Index[".ai-ops/context-layer.json 기록"]
  Index --> Done["완료"]
```

Phase 1 MVP는 root project만 다룬다. monorepo workspace override는 후속 개선으로 둔다.

### `ai-ops diff`

현재 파일과 `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`의 drift를 비교한다.

### `ai-ops update`

project operating layer를 현재 CLI 템플릿 기준으로 재적용한다. 사용자 작성 영역이 있는 문서는 보존 규칙을 명확히 둔다.

### `ai-ops audit`

frontmatter, `docs/docs-status.md`, manifest, context-layer index의 불일치를 읽기 전용으로 검사한다.

### `ai-ops uninstall`

project operating layer와 `.ai-ops/*` 상태 파일만 제거한다. global skills/subagents는 제거하지 않는다.

### `ai-ops skill ...`

global skill lifecycle만 관리한다.

### `ai-ops subagent ...`

global subagent lifecycle만 관리한다. Phase 3에서 도입한다.

## Deprecated old model

다음 모델은 문서와 코드에서 단계적으로 제거한다.

- `rules + skills scaffolder`를 제품 정의로 설명하는 문구
- preset-first init UX
- project scope skill 설치
- `ai-ops skill install --project`
- project-installed skill directory 추적
- `.ai-ops-manifest.json`
- legacy externalized rule migration
- root `specs/`

위 항목은 새 operating layer 계약 밖에 있는 historical/deprecated 모델로만 남긴다.
