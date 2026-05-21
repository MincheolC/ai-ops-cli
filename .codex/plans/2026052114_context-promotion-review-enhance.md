# context-promotion-review False Negative 개선 계획

## Summary

`context-promotion-review`가 `HEAD` 커밋 내용만 보고 `no-promotion`으로 수렴하는 문제를 줄인다. 이번 범위는 **Skill + Hook Prompt + Focused Tests**로 제한하고, `docs/agent/workflow.md` 같은 운영 규칙 문서에는 직접 반영하지 않는다.

기본 판정 성향은 “후보 우선”으로 둔다. 애매한 학습은 바로 승격하지 않고 `near-miss` 또는 `new candidates`로 사용자에게 노출해 결정하게 만든다.

## Key Changes

- `apps/cli/data/skills/task-skills/context-promotion-review/SKILL.md`
  - 필수 입력 확인에 `git status --short`, `git diff --name-only`, `git diff --cached --name-only`, `git ls-files --others --exclude-standard`를 추가한다.
  - 검토 대상을 “방금 만든 `HEAD` 커밋”에서 “`HEAD` 커밋 + 현재 대화/리뷰 루프에서 반복되거나 사용자가 교정한 운영 판단”으로 확장한다.
  - `already-covered`는 Active context layer에 같은 **agent 행동 규칙**이 있을 때만 사용한다고 명시한다. plan/test/operator docs는 근거일 수 있지만 자동으로 already-covered가 되지는 않는다.
  - `no-promotion` 전에 `near-miss / discarded candidates`를 짧게 보고하도록 한다.
  - dirty/untracked/changeset pollution 같은 커밋 hygiene 이슈가 리뷰에서 반복되거나 사용자가 교정한 경우 `project-local` 후보로 검토하도록 명시한다.

- `apps/cli/src/core/context-promotion.ts`
  - hook continuation prompt에 `HEAD`뿐 아니라 “current conversation/review-loop learnings”를 함께 검토하라고 명시한다.
  - prompt의 Review requirements에 worktree inspection 명령과 `already-covered` 기준을 추가한다.
  - 기존 안전 경계는 유지한다: Project root 고정, 다른 repo/웹 검색 금지, 사용자 승인 전 편집 금지, 직접 commit 금지.

- `apps/cli/src/core/schemas/__tests__/rule-data.test.ts` 및 `apps/cli/src/core/__tests__/context-promotion.test.ts`
  - skill 본문이 worktree/staged/untracked 확인 명령을 포함하는지 테스트한다.
  - skill 본문이 사용자 교정/리뷰 루프 학습/near-miss 보고/Active context layer 기준의 `already-covered`를 포함하는지 테스트한다.
  - hook prompt가 같은 검토 범위를 안내하는지 테스트한다.

## Test Plan

- Focused tests만 실행한다.
  - `npm test -- apps/cli/src/core/schemas/__tests__/rule-data.test.ts`
  - `npm test -- apps/cli/src/core/__tests__/context-promotion.test.ts`
- 테스트 전에 현재 dirty worktree를 확인하고, 구현 시 기존 변경인 `apps/studio/tsconfig.json` 및 untracked phase plan 파일은 건드리지 않는다.
- staging/commit이 필요해지면 이번 변경 파일만 명시적으로 stage한다.

## Assumptions

- 이번 변경은 classifier recall 개선이 목적이며, 실제 `docs/agent/workflow.md`에 changeset hygiene 규칙을 승격하는 작업은 포함하지 않는다.
- `context-promotion-review`는 여전히 자동 편집자가 아니라 후보 제안자다. 승격 파일 수정은 사용자 승인 후에만 한다.
- `no-promotion`은 유지하되, “아무 후보 없음”으로 바로 닫기 전에 근거 있는 near-miss를 노출하는 방향으로 튜닝한다.
