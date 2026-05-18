# ai-ops Integrations 문서 정리 계획

## Summary

- 제품 정의를 “프로젝트/에이전트 작업에 필요한 operating layer와 global runtime integration을 설치하고 관리하는 도구”로 재정렬한다.
- `integration`을 상위 제품 개념으로 두고, 현재 CLI의 `skill`, `subagent`, `codex-hook`, `context-promotion`은 integration을 이루는 low-level component/관리 명령으로 설명한다.
- 현재 구현과 목표 모델을 분리한다. 문서가 아직 없는 `ai-ops integration ...` 명령을 현재 기능처럼 말하지 않는다.

## Key Changes

- `docs/plan.md`, `README.md`, `README.ko.md`, `apps/cli/README.md`, `apps/cli/README.ko.md`의 제품 정의와 다이어그램을 `project operating layer + ai-ops integrations` 구조로 갱신한다.
- `global assets` 표현은 내부 component 개념으로 낮춘다. 사용자-facing 설명은 `global runtime integrations`를 우선 사용한다.
- `integration` 정의를 추가한다: skill, subagent, Codex hook, hook runner, user-local receipt/config 등을 묶어 agent runtime workflow를 제공하는 user/global 설치 단위.
- 현재 CLI Surface는 그대로 문서화한다: `skill`, `subagent`, `codex-hook`, `context-promotion`, `pack`은 유지되며, integration 명령은 “목표 UX/후속 구현”으로만 언급한다.
- `context-promotion`은 현재 존재하는 integration-like 사례로 재분류하고, `pc`는 “planned integration candidate” 예시로 짧게 기록한다.
- `docs/implementation-playbook.md`에 문서 재정렬 phase를 추가하거나 현재 phase 설명을 보강해, 향후 `integration` 명령 구현이 별도 phase임을 명확히 한다.

## Operating Layer Updates

- self-dogfood 문서도 새 정의를 읽도록 `docs/agent/rules/routing-rules.md`와 `docs/agent/workflow.md`를 갱신한다.
- CLI가 새 프로젝트에 설치하는 템플릿도 동일하게 맞추기 위해 `apps/cli/data/context-layer/docs/agent/rules/routing-rules.md`와 `apps/cli/data/context-layer/docs/agent/workflow.md`를 함께 갱신한다.
- generated root 문서는 수동으로 `sourceHash`를 고치지 않는다. 템플릿 변경 후 빌드된 CLI의 `update --force` 흐름으로 root managed docs의 header/hash를 재생성한다.
- `project scope`는 계속 operating-layer 문서와 `.ai-ops/*` project state만 의미한다. `integrations`는 user/global runtime scope이며 project layer uninstall 대상이 아니다.

## Public Contract

- 이번 작업은 문서/제품 계약 정리다. 런타임 CLI 동작, schema, registry, hook runner 구현은 바꾸지 않는다.
- 필요하면 `apps/cli/package.json`의 description 같은 public-facing metadata 문구만 새 제품 정의에 맞춰 조정한다.
- `ai-ops integration list/install/status/uninstall` 같은 명령은 현재 구현으로 문서화하지 않는다. 후속 phase의 목표 인터페이스로만 둔다.
- 기존 low-level 명령은 유지된다: 개별 skill/subagent 설치, Codex hook 상태 확인, context-promotion receipt 관리는 계속 해당 명령에서 설명한다.

## Test Plan

- `rg`로 오래된 무조건 문구를 확인한다: `global scope는 skills/subagents만`, `global assets`, `skills/subagents into the user's global tool environment`.
- 검색 결과가 남는 경우, deprecated 설명이거나 low-level component 설명인지 확인한다.
- `npm run check`를 실행해 문서/템플릿 변경이 기존 테스트와 충돌하지 않는지 확인한다.
- 빌드 후 `node apps/cli/dist/bin/index.js update --force`, `diff`, `audit` 흐름으로 self-dogfood managed docs가 템플릿과 일치하는지 확인한다.

## Assumptions

- 선택된 방향은 “목표+현재 분리”다: integration은 제품 방향이고, 현재 CLI는 low-level component 명령을 제공한다.
- operating layer 템플릿까지 이번 정리에 포함한다.
- 이번 작업은 `pc` integration 구현이 아니라, `pc`를 수용할 수 있는 제품/문서 개념 정리다.
