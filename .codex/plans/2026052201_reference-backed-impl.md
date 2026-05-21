# Reference-Backed Implementation 규칙 추가

## Summary

`agent operating layer`의 범용 workflow 규칙에 “참고 문서의 핵심 제약을 검증 가능한 acceptance condition으로 바꾼다”는 원칙을 추가한다. 이번 `default_permissions` 누락처럼 문서의 `must`, `required`, `top-level`, config/schema/parser 제약을 읽고도 테스트/스모크로 고정하지 않는 문제를 줄이는 것이 목표다.

## Key Changes

- `docs/agent/workflow.md`와 source template인 `apps/cli/data/context-layer/docs/agent/workflow.md`에 새 섹션을 추가한다.
- 위치는 `문서 사용 원칙` 직후가 기본값이다. 이유는 이 규칙이 일반 협업 태도라기보다 reference 문서를 구현 입력으로 바꾸는 workflow 규칙이기 때문이다.
- 섹션 제목은 `Reference-Backed Implementation`으로 둔다.
- 핵심 문구:
  - reference 문서 기반 구현 시 핵심 제약을 acceptance condition으로 먼저 추출한다.
  - `must`, `required`, `top-level`, `cannot mix`, `does not compose` 같은 강제 제약은 그냥 읽고 넘어가지 않는다.
  - config/schema/parser/runtime이 직접 해석하는 구조와 permission/sandbox/credential/network/filesystem boundary는 테스트, fixture, smoke command, audit check 중 하나로 고정한다.
  - 짧은 기억 문장으로 `문서의 중요한 문장을 테스트 이름으로 바꾼다.`를 포함한다.
- `CHANGELOG.md`의 `Unreleased`에 운영 레이어 규칙 보강 항목을 추가한다.

## Test Plan

- `npm run build --workspace=apps/cli`
- `node apps/cli/dist/bin/index.js update --force`를 실행해 managed source와 설치된 operating-layer 문서/hash가 일관되는지 확인한다.
- `node apps/cli/dist/bin/index.js audit`
- `npm run check`
- 최종 diff에서 같은 규칙이 source template과 설치 문서에 모두 반영됐는지 확인한다.

## Assumptions

- 이 규칙은 repo-local `docs/agent/project-rules/routing-rules.md`가 아니라 범용 managed operating layer에 넣는다.
- `00-agent-baseline.md`에는 넣지 않는다. baseline은 태도/코딩 철학 중심으로 유지하고, reference 문서 처리 규칙은 workflow에 둔다.
- 현재 작업 전부터 존재하던 `.ai-ops`, `AGENTS.md`, `docs/agent/*` dirty 변경은 되돌리지 않고 함께 고려한다.
