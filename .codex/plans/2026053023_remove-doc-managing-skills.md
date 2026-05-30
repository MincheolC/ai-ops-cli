# `doc-impact-reviewer`와 `context-promotion` 제거 계획

## Summary

문서/운영 지식 업데이트 흐름을 `ai-ops-project-owned-docs` 하나로 통합한다. 외부 사용자가 없으므로 `doc-impact-reviewer`, `context-promotion-review`, `context-promotion` integration/hook/receipt 표면은 호환 shim 없이 hard delete한다.

`pc`는 유지한다. Shared Codex `PostToolUse` hook infrastructure는 남기되, 앞으로 지원 workflow는 `pc` 하나뿐이다.

## Key Changes

- `ai-ops-project-owned-docs`를 유일한 명시 호출 문서 skill로 확장한다.
  - 사용자 메모, 현재 diff 기반 문서 영향 검토, 최근 대화/트러블슈팅에서 나온 운영 학습을 모두 입력으로 받는다.
  - 사용자 승인 전 편집 금지, project-owned 문서만 편집, 필요 시 `ai-ops update`/`audit` 안내, staging/commit 금지는 유지한다.
  - `context-promotion receipt` 관련 금지 문구는 제거한다.

- obsolete skill/catalog를 제거한다.
  - `doc-impact-reviewer`, `context-promotion-review` skill directory를 삭제한다.
  - `skill-registry.json`과 skills README 계열에서 두 skill을 제거한다.
  - README 계열의 operating-doc 업데이트 안내는 `ai-ops-project-owned-docs`만 설치/사용하도록 정리한다.

- `context-promotion` 제품 표면을 제거한다.
  - `apps/cli/src/features/context-promotion/*`를 삭제한다.
  - `ai-ops context-promotion ...` command registration을 제거한다.
  - integration registry와 integration id schema에서 `context-promotion`을 제거한다.
  - `context-promotion` receipt config와 관련 문서 설명을 제거한다.

- `pc`는 유지하고 hook 내부를 단순화한다.
  - 성공한 `git commit` PostToolUse parser를 `context-promotion` 폴더에서 `features/codex-hooks/git-commit-hook.ts` 같은 shared 위치로 이동한다.
  - `pc`와 integration dispatcher는 새 shared parser를 import한다.
  - dispatcher에서 `context-promotion` workflow 처리를 제거한다. `--workflows context-promotion`은 이제 다른 unknown workflow처럼 에러 처리한다.
  - low-level `ai-ops codex-hook install/status/uninstall context-promotion` 명령은 제거한다. `pc` hook 설치는 계속 `ai-ops integration install pc`로만 제공한다.

- 현재 문서를 정리한다.
  - `README.md`, `README.ko.md`, `apps/cli/README.md`, `apps/cli/README.ko.md`, `docs/plan.md`, `docs/implementation-playbook.md`를 현재 제품 표면에 맞게 수정한다.
  - `.codex/plans/*context-promotion*` 같은 과거 계획 문서는 historical record로 남긴다.
  - safe-local permission 코드/문서/테스트에서 `${AI_OPS_HOME:-$HOME}/.ai-ops/context-promotion` write allowance를 제거한다. Personal context와 workspace `.codex/plans` allowance는 유지한다.

## Test Plan

- Focused tests:
  - `npm test --workspace=apps/cli -- src/core/schemas/__tests__/rule-data.test.ts`
  - `npm test --workspace=apps/cli -- src/core/schemas/__tests__/integration-catalog.schema.test.ts`
  - `npm test --workspace=apps/cli -- src/core/__tests__/loader.test.ts`
  - `npm test --workspace=apps/cli -- src/core/__tests__/integration-post-tool-use-dispatcher.test.ts`
  - `npm test --workspace=apps/cli -- src/core/__tests__/pc-integration.test.ts`
  - `npm test --workspace=apps/cli -- src/core/__tests__/codex-permissions.test.ts`
  - `context-promotion.test.ts`는 삭제한다. context-promotion 전용 e2e case는 삭제하거나 `pc` 전용 검증으로 축소한다.

- Broader validation:
  - `npm test --workspace=apps/cli`
  - `npm run build --workspace=apps/cli`
  - `git diff --check`

## Assumptions

- 이 변경은 deprecation이 아니라 hard removal이다.
- user-local migration이나 no-op compatibility shim은 만들지 않는다.
- 기존 로컬 `~/.codex/hooks.json`, `~/.ai-ops/context-promotion`, 설치된 global skill folder는 필요하면 repo 밖에서 수동 정리한다.
- 변경 후 Codex `PostToolUse` integration workflow는 `pc`만 지원한다.
