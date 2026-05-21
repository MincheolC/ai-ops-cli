# apps/cli Feature 구조 리팩토링 + 유지보수 기준 문서화

## Summary

- `apps/cli/src`를 `commands/core/lib` 중심에서 `features/*` 중심으로 재배치한다.
- CLI command/options/output, manifest/context-layer/studio snapshot JSON schema는 변경하지 않는다.
- 문서 기준은 `00-agent-baseline.md`에 철학, `impact-checklist.md`에 점검 타이밍을 추가한다.
- 줄 수 기준은 hard gate가 아니라 soft trigger로 둔다.

## Key Changes

- 새 구조를 기준으로 이동한다:
  ```text
  src/
    bin/
    cli/
    features/
      project-layer/
      studio/
      skills/
      subagents/
      integrations/
      codex-hooks/
      codex-permissions/
      context-promotion/
      pc/
    shared/
  ```
- `src/bin/index.ts`는 `createProgram().parse()`만 수행하게 줄이고, commander 등록은 `src/cli/program.ts`와 feature별 `register*Commands`로 분리한다.
- `project-layer`는 `templates`, `docs-status`, `manifest/context-index`, `lifecycle`, `audit`, `uninstall`, `packs` 단위로 나눈다. 기존 `project-layer.ts`의 1000줄 단일 책임 혼합은 남기지 않는다.
- `studio`는 project snapshot, runtime snapshot, issue normalization/source state를 분리한다.
- `skills`, `subagents`, `integrations`는 command, state, install-file logic을 각 feature 내부로 옮긴다. 동일한 tool selection/manifest helper만 `shared`로 승격한다.
- `core`에는 장기적으로 둘 이유가 있는 schema/facade만 남기고, feature logic은 남기지 않는다. 기존 내부 import는 새 feature 경로로 갱신한다.
- `apps/cli/data` asset 구조는 유지한다.

## Documentation

- `apps/cli/data/context-layer/docs/agent/rules/00-agent-baseline.md`에 “유지보수/리팩토링 기준” 섹션을 추가한다.
- 같은 내용은 `ai-ops update --force` 흐름으로 설치본 `docs/agent/rules/00-agent-baseline.md`, `.ai-ops/context-layer.json`, `.ai-ops/manifest.json`에 반영한다.
- `impact-checklist.md`에는 다음 점검 트리거를 추가한다:
  - touched production file이 250줄을 넘는가?
  - 새 기능을 400줄 이상 파일에 추가하는가?
  - 같은 패턴이 세 번째 등장했는가?
  - 한 변경이 서로 다른 책임의 section 3곳 이상을 건드리는가?
- 기준 문구는 “검토 신호”로 표현하고, lint/test 실패 조건은 만들지 않는다.

## Test Plan

- 기존 테스트 import를 새 feature 경로에 맞게 갱신하고, behavior assertion은 그대로 유지한다.
- `project-layer` 테스트에 설치된 baseline/checklist 문서가 새 리팩토링 기준을 포함하는지 추가 검증한다.
- 실행 검증:
  - `npm test --workspace=apps/cli`
  - `npm run build --workspace=apps/cli`
  - `node apps/cli/dist/bin/index.js audit`
  - `node apps/cli/dist/bin/index.js studio snapshot --json`
- 완료 전 production TS line-count report를 확인한다. 목표는 touched feature 파일 400줄 이하, 600줄 초과 파일 없음이다. 이는 구현 목표이지 자동 gate는 아니다.

## Assumptions

- 이번 작업은 behavior-preserving refactor다.
- 외부 사용자가 의존하는 표면은 `ai-ops` CLI와 JSON/schema 계약이며, 내부 module path는 변경 가능하다.
- `src/core/index.ts` 같은 compatibility facade는 필요하면 남길 수 있지만, 실제 feature logic을 다시 모으는 용도로 쓰지 않는다.
- 문서 source of truth는 `apps/cli/data/context-layer/**`이고, 설치본은 CLI update 흐름으로 동기화한다.
