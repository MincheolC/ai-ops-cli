# Phase 3 구현 계획: Review Target Protocol 고정

## Summary

Phase 3는 `code-review-gate`가 “무엇을 리뷰할지”를 안정적으로 해석하게 만드는 단계다. CLI lifecycle은 건드리지 않고, `code-review-scope-map`을 중심으로 plan/current diff/HEAD/project/feature/module 요청을 명확히 분류하고, subagent와 focused skills가 그 scope를 벗어나지 않도록 계약을 보강한다.

## Key Changes

- `code-review-scope-map`을 mode별 실행 프로토콜로 확장한다.
  - `plan_current_changes`: “현재 변경사항은 [계획 문서] 구현” 요청. named plan + staged/unstaged/untracked/untracked plan files를 비교한다.
  - `plan_head_commit`: “직전 커밋은 [계획 문서] 구현” 요청. named plan + `git show HEAD` 계열 evidence를 비교한다.
  - `project_wide`: “이 프로젝트 전체” 요청. entrypoint, registry/schema, CLI command, docs/status, tests를 우선순위 audit로 보고 완전성 보장은 하지 않는다.
  - `feature`: “A 기능” 요청. feature name을 route/command/module/docs/tests/shared policy surface로 매핑한다.
  - `module`: “B 모듈” 요청. explicit path를 최우선으로 하고 없으면 package/directory/symbol search로 후보를 좁힌다.
  - `diff_default`: target이 없으면 current worktree diff 전체를 리뷰한다.

- scope-map output을 더 엄격히 고정한다.
  - `target mode`, `target identifier`, `included surface`, `excluded surface`, `required evidence`, `ambiguity`, `focused passes to run`를 반환하게 한다.
  - ambiguity가 있으면 focused review로 넘어가지 않고 필요한 clarification만 남긴다.
  - project-wide/feature/module 요청은 “어디까지 봤고 어디는 제외했는지”를 반드시 남긴다.

- `code-review-gate` subagent prompt를 Phase 3 protocol에 맞춘다.
  - 사용자 시나리오 4종을 명시적으로 지원한다: current changes/HEAD commit plan review, project-wide review, feature review, module review.
  - scope-map의 excluded surface를 finding 후보로 끌어오지 않게 한다.
  - feature/module review에서는 직접 연결된 shared auth/policy/schema/test helper까지만 포함한다.

- focused skills와 final-gate의 scope 준수 규칙을 보강한다.
  - focused skills는 scope-map의 included surface 밖 이슈를 보고하지 않는다.
  - scope 밖에서 위험 신호가 보이면 finding이 아니라 `미실행/남은 확인`으로만 남긴다.
  - final-gate는 project-wide의 제한 사항과 feature/module excluded surface를 `**검증**`에 짧게 반영한다.

## Test Plan

- `rule-data.test.ts`를 보강한다.
  - scope-map skill이 6개 target mode별 trigger phrase와 evidence command를 포함하는지 확인한다.
  - `현재 변경사항`, `직전 커밋`, `이 프로젝트 전체`, `기능`, `모듈` 시나리오가 skill text에 명시되는지 확인한다.
  - scope-map output fields와 ambiguity stop 조건을 검증한다.
  - focused skills가 `included surface` / `excluded surface` scope 준수 문구를 포함하는지 확인한다.

- `subagent-loader.test.ts`를 보강한다.
  - `code-review-gate` prompt가 6개 target mode와 ambiguity stop, scope-map-first 흐름을 포함하는지 확인한다.
  - prompt가 project-wide 완전성 보장 금지와 feature/module slice 제한을 포함하는지 확인한다.

- Validation commands:
  - `npm test --workspace=apps/cli -- src/core/schemas/__tests__/rule-data.test.ts`
  - `npm test --workspace=apps/cli -- src/core/__tests__/subagent-loader.test.ts`
  - `npm run build --workspace=apps/cli`
  - `git diff --check`

## Assumptions

- Phase 3는 review target protocol과 contract tests만 다룬다.
- 새 CLI 명령, hook, 자동 리뷰 실행은 추가하지 않는다.
- 현재 untracked `.codex/plans/*.md`는 계획 문서로 유지하고, 구현 commit 범위에는 포함하지 않는다.
- Phase 4에서 README/README.ko와 최종 사용 문서 정리를 별도로 한다.
