# Phase 2 구현 계획: Review Gate Assets 완성

## Summary

현재 `code-review-gate` skill/subagent 파일은 생성되어 있지만 대부분 얇은 placeholder 수준이다. Phase 2는 생명주기 코드는 건드리지 않고, 7개 review task skill과 `code-review-gate` subagent를 실제 리뷰에 쓸 수 있는 명확한 실행 프로토콜로 확장한다.

## Key Changes

- `code-review-gate` subagent prompt를 강화한다.
  - explicit-only, read-only, no edit/stage/commit 원칙을 고정한다.
  - scope-map → focused passes → final-gate 순서를 명시한다.
  - current changes, `HEAD`, plan-vs-implementation, project-wide, feature, module 리뷰 요청을 모두 처리하게 한다.
  - ambiguity가 있으면 deep review를 멈추고 필요한 target clarification만 보고하게 한다.

- 7개 task skill을 “실행 가능한 리뷰 렌즈”로 확장한다.
  - `code-review-scope-map`: target mode, 포함/제외 surface, 필수 read-only evidence commands, ambiguity stop 조건.
  - `code-review-correctness`: 요구사항 불일치, business invariant, compatibility, edge case, contract regression 중심.
  - `code-review-security`: auth/authz, ownership, token/session, secret/PII, sandbox/command boundary, user-owned file 보호.
  - `code-review-state-concurrency`: manifest/file lifecycle, partial update, stale hash, retry/idempotency, install/update/uninstall ordering.
  - `code-review-test-quality`: missing/weak/suspicious tests, mocks hiding behavior, acceptance criteria coverage.
  - `code-review-architecture-ops`: structure erosion, lifecycle ownership, migration/update/rollback, diagnostics, operational risk.
  - `code-review-final-gate`: Codex 내장 리뷰 스타일의 최종 출력 계약.

- 최종 응답 포맷을 skill contract로 고정한다.
  - `**Findings**`
  - 0개 이상의 `[P0]`, `[P1]`, `[P2]`, `[P3]` finding
  - `**검증**`
  - `통과:`에는 실제 실행/직접 확인한 증거만 기록
  - `미실행/남은 확인:`에는 merge 전에 필요한 미확인 증거만 기록
  - finding 수와 검증 도구는 고정하지 않는다.

- Metadata/registry는 현재 구조를 유지하되 검증한다.
  - 모든 review task skill의 `agents/openai.yaml`은 `allow_implicit_invocation: false`.
  - `code-review-gate` Codex frontmatter는 `sandbox_mode = "read-only"`와 7개 `skill_names`를 가진다.
  - integration registry는 7개 skill + 1개 subagent, hook/receipt 없음.

## Test Plan

- `rule-data.test.ts`에 code-review-gate contract checks를 추가한다.
  - 7개 skill이 모두 explicit-only metadata를 가진다.
  - scope-map skill이 6개 target mode를 모두 포함한다.
  - final-gate skill이 `**Findings**`, severity tags, `**검증**`, `통과:`, `미실행/남은 확인:` 계약을 포함한다.
  - 각 focused skill이 file/line evidence와 no generic advice 원칙을 포함한다.

- Subagent data test를 보강한다.
  - `code-review-gate` Codex frontmatter가 read-only sandbox와 7개 skill 전체를 선언하는지 확인한다.
  - prompt가 explicit-only, read-only, no mutation, scope-map-first 흐름을 포함하는지 확인한다.

- Validation commands:
  - `npm test --workspace=apps/cli -- src/core/schemas/__tests__/rule-data.test.ts`
  - `npm test --workspace=apps/cli -- src/core/__tests__/subagent-loader.test.ts`
  - `npm run build --workspace=apps/cli`
  - `git diff --check`

## Assumptions

- Phase 2는 review assets와 asset contract tests만 다룬다.
- Phase 1의 integration lifecycle 구현은 이미 존재하는 변경을 기반으로 한다.
- README/Studio/전체 CLI 문서 정리는 Phase 4에서 마무리한다.
- 자동 hook, PR automation, implicit invocation은 v1 범위 밖이다.
