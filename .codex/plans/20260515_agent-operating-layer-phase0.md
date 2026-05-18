# Phase 0 구현 계획: AI Agent Operating Layer 계약 고정

## 요약

Phase 0은 코드 동작을 바꾸지 않고, repo의 공식 계약 문서를 새 제품 방향에 맞게 갱신한다. 현재 문서의 “rules + skills scaffolder” 모델을 “프로젝트에는 agent operating layer, 사용자 환경에는 skills/subagents” 모델로 교체한다.

이 phase에서는 CLI 구현, schema, renderer, manifest, 테스트 코드는 수정하지 않는다. 다음 phase 구현자가 결정을 다시 하지 않도록 문서에서 breaking policy와 목표 구조를 고정한다.

## 핵심 변경

- `docs/plan.md`를 새 master blueprint로 재작성한다.
  - 제품 정의: `ai-ops`는 프로젝트 안에 AI agent operating layer를 설치하고 유지하는 bash CLI.
  - Project 설치 대상: `AGENTS.md`, tool adapter, `docs/agent/*`, `docs/business/*`, `docs/docs-status.md`, `.ai-ops/*`.
  - Global 설치 대상: reference/task skills, subagents.
  - `AGENTS.md`는 canonical entrypoint, `GEMINI.md`/`CLAUDE.md`는 adapter.
  - `docs/specs/`는 optional pack 위치로 고정.
  - project skill scope, old `.ai-ops-manifest.json`, legacy manifest migration은 제거 방향으로 명시.
  - 기존 프로젝트는 old uninstall 후 new init하는 breaking release로 명시.

- `docs/implementation-playbook.md`를 새 phase 실행 가이드로 갱신한다.
  - Phase 0부터 Phase 6까지 구현 순서와 완료 기준을 기록한다.
  - 각 phase는 임시 디렉터리 설치 검증을 수행하고, 실제 프로젝트 재설치는 모든 phase 후 통합 검증에서만 수행한다.
  - Phase 1의 첫 구현 범위는 project operating layer MVP로 제한한다.

- README 계열 문서를 새 포지셔닝으로 맞춘다.
  - 루트 `README.md`
  - `apps/cli/README.md`
  - `apps/cli/README.ko.md`
  - 현재 명령 설명은 “현재 구현 상태”가 아니라 “전환 목표 계약”임을 명확히 하거나, 별도 “Planned breaking model” 섹션으로 분리한다.
  - `--project` skill 설치, 루트 `specs/`, `.ai-ops-manifest.json` 설명은 Phase 0 문서에서 deprecated/old model로 표시한다.

- 오래된 설계 보조 문서의 상태를 정리한다.
  - `docs/tui-flow-ai-init-plan.md`는 기존 init UX 문서이므로 deprecated 또는 historical로 표시한다.
  - `docs/rule-authoring-guide.md`는 core rule 작성 문서로 유지하되, 새 모델에서는 “always-loaded agent entry guidance의 일부”임을 명확히 한다.

## 테스트 계획

- 문서 변경 후 포맷만 확인한다.
  - Markdown 링크가 깨지지 않는지 눈으로 확인한다.
  - `rg`로 오래된 핵심 문구가 남았는지 확인한다: `--project`, `project scope skill`, `.ai-ops-manifest.json`, root `specs/`, `preset-first`.
  - 의도적으로 남긴 old/deprecated 설명은 `Deprecated` 또는 `old model` 문맥 안에 있어야 한다.

- 코드 검증은 선택적으로만 수행한다.
  - Phase 0은 코드 변경이 없으므로 `npm test`는 필수 완료 기준이 아니다.
  - 문서 링크나 markdown formatting을 건드리는 formatter는 repo-tracked 파일을 재작성할 수 있으므로 별도 승인 없이 실행하지 않는다.

## 가정과 기본값

- Phase 0은 문서 계약 고정 phase이며 repo-tracked 구현 파일은 바꾸지 않는다.
- `AGENTS.md`/`GEMINI.md` 루트 파일은 현재 old renderer가 생성한 산출물이므로 Phase 0에서 직접 수정하지 않는다. 실제 canonical/adapter 출력은 Phase 1 renderer 변경에서 처리한다.
- `docs/specs/`는 optional pack이지만, 설치 시 위치는 고정한다.
- `pc`와 `mermaid-pretty-render`는 core operating layer가 아니며, 필요하면 후속 phase에서 global utility skill로 분류한다.
- 기존 프로젝트 자동 마이그레이션은 만들지 않는다.
