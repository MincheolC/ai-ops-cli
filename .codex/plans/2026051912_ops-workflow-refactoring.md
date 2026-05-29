# Project Operating Layer Workflow 정리

## Summary

- `workflow.md`는 Codex의 기본 구현 루프를 대체하지 않고, `Intent Routing`, `Context Loading`, `Change Impact Analysis`, `Context Update` 중심의 project-context orchestration 문서로 재작성한다.
- `stop-rules.md`는 workflow의 마지막 단계가 아니라 모든 단계에 적용되는 guardrail로 명시한다.
- `impact-checklist.md`는 범용 영향 분석 문서로 유지하고, `review-checklist.md`는 기본 설치 템플릿에서 제거한다.
- 기존 `review-checklist.md`의 `ai-ops` lifecycle 전용 내용은 유저 프로젝트에 설치하지 않고, `docs/implementation-playbook.md`의 내부 검증 문맥으로만 남긴다.

## Key Changes

- `apps/cli/data/context-layer/docs/agent/workflow.md`
  - 단계는 `Intent Routing → Context Loading → Change Impact Analysis → Native Agent Execution → Context Update → Report`로 정의한다.
  - `Native Agent Execution`은 “구현/검증 세부 방식은 에이전트 기본 작업 루프를 따른다”고 짧게 둔다.
  - `Reserved` 문서는 판단 근거로 쓰지 않고, `Active`일 때만 참고하며 비어 있거나 stale하면 실제 코드/파일을 우선한다고 명시한다.
  - `stop-rules.md`는 모든 단계에서 적용된다고 연결한다.

- `apps/cli/data/context-layer/docs/agent/checks/impact-checklist.md`
  - `CLI surface`, `manifest`, `update/diff/uninstall` 같은 `ai-ops-cli` 전용 항목을 제거한다.
  - 범용 영향 질문으로 교체한다: business/domain rule, DB/migration/data, public API/CLI contract, auth/permission/privacy/billing, external integration/webhook/job/cache, docs/spec/context update 영향.

- 기본 템플릿/설치 목록
  - `docs/agent/checks/review-checklist.md`를 `TEMPLATE_PATHS`에서 제거하고 템플릿 파일도 삭제한다.
  - README, README.ko, `apps/cli/README*`, `docs/plan.md`, `docs/implementation-playbook.md`의 기본 설치 대상 목록에서 `review-checklist.md`를 제거하고 `impact-checklist.md`만 남긴다.
  - 이 repo의 self-dogfood 설치 상태도 갱신해 `docs/docs-status.md`, `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`에서 `review-checklist.md`가 빠지게 한다.

- 내부 검증 보존
  - `review-checklist.md`에 있던 `manifest/context-layer/update/diff/uninstall` 류의 체크는 유저 설치 템플릿이 아니라 `docs/implementation-playbook.md`의 ai-ops 내부 검증/Phase 6 문맥에 짧게 흡수한다.
  - 별도 global skill은 만들지 않는다.

## Test Plan

- `npm run test --workspace=apps/cli`
- `npm run build`
- 빌드 후 이 repo에서 `node apps/cli/dist/bin/index.js init --tool codex --tool gemini --tool claude-code`를 실행해 removed managed file retirement까지 확인한다.
- `node apps/cli/dist/bin/index.js audit`
- `rg -n "review-checklist|docs/agent/checks/\\*" README.md README.ko.md apps/cli/README.md apps/cli/README.ko.md docs/plan.md docs/implementation-playbook.md apps/cli/src/core/project-layer.ts`로 stale 문구가 남지 않았는지 확인한다.

## Assumptions

- `review-checklist.md`는 기본 operating layer에서 제거한다. 검증 자체는 Codex 기본 작업 루프와 repo별 명령 선택에 맡긴다.
- `impact-checklist.md`는 유저 프로젝트에 설치할 가치가 있는 범용 문서로 유지한다.
- 이번 변경에서는 project-specific Active 문서 확장 기능을 새로 만들지 않는다.
