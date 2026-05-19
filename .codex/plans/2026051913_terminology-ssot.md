# Terminology SSOT 정리 계획

## Summary

- 프로젝트 용어 SSOT는 `docs/business/terminology.md` 하나로 통일한다.
- legacy spec glossary path는 새 모델에서 제거하고, spec lifecycle은 `docs/business/terminology.md`를 소비/갱신한다.
- `docs/agent/terminology.md`는 사용자 프로젝트에 기본 설치하되, ai-ops 제품 백과사전이 아니라 operating layer 해석에 필요한 최소 용어만 담는다.
- legacy glossary sync skill은 alias 없이 `project-terminology-sync`로 rename한다.

## Key Changes

- Base operating layer에 문서 2개를 추가한다.
  - `docs/agent/terminology.md`: `status: Active`, `layer: agent`, `owner: ai-ops`; managed 문서.
  - `docs/business/terminology.md`: `status: Reserved`, `layer: business`, `owner: project`; project-owned 문서.
- `docs/agent/terminology.md`에는 최소 운영 용어만 둔다.
  - `agent operating layer`, `context layer`, `docs/docs-status.md`, `.ai-ops/context-layer.json`, document status, `ai-ops managed`, `project-owned`, `optional pack`, `read_when`, `update_when`.
  - release model, phase history, implementation internals, integration catalog 내부 구조는 사용자 프로젝트에 설치하지 않는다.
- `docs/business/terminology.md`는 project/domain terminology SSOT로 설계한다.
  - 핵심 용어, 엔티티, 상태, UI label, code-facing name, 금지/회피 표현, `검토 중인 용어` 섹션을 포함한다.
  - spec, plan, packet, business rule 문서는 이 파일의 용어를 따른다.
- Project layer install/update 대상에 두 문서를 반영한다.
  - `TEMPLATE_PATHS`에 두 문서를 추가한다.
  - `PROJECT_OWNED_PATHS`에는 `docs/business/terminology.md`만 추가한다.
  - self-dogfood 상태 파일과 `docs/docs-status.md`도 같은 기준으로 갱신한다.
- Spec lifecycle glossary를 제거한다.
  - 모든 legacy spec glossary path 참조를 `docs/business/terminology.md`로 교체한다.
  - `docs/specs/README*`에는 “용어 SSOT는 `docs/business/terminology.md`”라고 명시한다.
  - 기존 glossary 경로에 대한 deprecated alias나 병행 문서는 만들지 않는다.
- Skill rename을 수행한다.
  - legacy glossary sync skill 디렉터리, registry id, agent yaml, README/문서 참조를 `project-terminology-sync`로 변경한다.
  - 새 skill은 specs뿐 아니라 `.codex/plans`, business docs, active spec docs에서 용어 drift를 찾아 `docs/business/terminology.md`를 생성/수정한다.
  - 기존 id alias는 두지 않는다.

## Public Interfaces

- 새 installed documents:
  - `docs/agent/terminology.md`
  - `docs/business/terminology.md`
- 제거되는 새 모델 참조:
  - legacy spec glossary path
  - legacy glossary sync skill id
- 새 task skill id:
  - `project-terminology-sync`

## Test Plan

- Unit tests:
  - project layer install 결과에 두 terminology 문서가 포함되는지 확인한다.
  - `docs/business/terminology.md`가 project-owned preserved file로 동작하는지 확인한다.
  - loader/registry test에서 `project-terminology-sync`가 등록되고 legacy glossary sync skill id가 사라졌는지 확인한다.
- Search checks:
  - legacy glossary id/path 검색 결과가 deprecated 설명 없이 남지 않게 한다.
  - README, plan, playbook, spec skill 문서가 `docs/business/terminology.md`를 기준으로 설명하는지 확인한다.
- Runtime validation:
  - `npm run test --workspace=apps/cli`
  - `npm run build`
  - 빌드 후 temp repo에서 `ai-ops init --tool codex --tool gemini --tool claude-code`, `ai-ops audit` 실행.
  - 이 repo self-dogfood에서 `init/update` 후 `docs/docs-status.md`, `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`이 같은 문서 목록을 가리키는지 확인한다.

## Assumptions

- `docs/agent/terminology.md`는 기본 설치하지만 작게 유지한다.
- `docs/business/terminology.md`가 유일한 project terminology SSOT다.
- legacy spec glossary path와 legacy glossary sync skill id에 대한 호환 alias는 제공하지 않는다.
- 현재 별도 plan인 `2026051912_ops-workflow-refactoring.md`와 함께 구현할 경우, 기본 설치 문서 목록 변경은 한 번에 reconcile한다.
