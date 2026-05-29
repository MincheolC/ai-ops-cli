# Legacy Cleanup Plan

## Summary

- 2단계로 정리한다.
- 1단계는 repo에 남은 old artifact와 혼동되는 문서 문구를 정리한다.
- 2단계는 현재 public CLI에서 쓰지 않는 old rules/scaffolder 엔진, legacy manifest stack, old settings/workspace 유틸, 관련 테스트를 제거한다.
- 현재 삭제 상태인 root `specs/baseline/.gitkeep`, `specs/delta/.gitkeep`는 사용자가 의도적으로 삭제한 cleanup 범위로 포함한다.

## Key Changes

### 1단계: 안전한 artifact/docs cleanup

- tracked root `.ai-ops-manifest.json` 삭제를 유지한다.
- root `specs/baseline/.gitkeep`, `specs/delta/.gitkeep` 삭제를 유지한다.
- `docs/plan.md`의 monorepo 문구를 명확히 한다:
  - 현재 `ai-ops init`은 monorepo root를 하나의 project로 설치할 수 있다.
  - workspace/package별 adapter/override 자동 생성은 아직 지원하지 않는다.
- user-facing docs에서 old `.ai-ops-manifest.json`, root `specs/`, old `spec init` 언급은 deprecated/historical 문맥으로만 남긴다.
- `docs/tui-flow-ai-init-plan.md`는 현재 context-layer에 등록되지 않은 old init UX 문서이므로 제거한다.

### 2단계: legacy code cleanup

- old project manifest stack 제거:
  - old root manifest I/O, old `ManifestSchema`, old manifest diff/resolution/uninstall fallback 제거
  - `source-hash.ts`에서는 현재 쓰는 hash/version 함수만 남기고 old `buildManifest` 제거
  - `core/index.ts`, `schemas/index.ts`에서 old exports 제거
- old rules/preset renderer stack 제거:
  - YAML rule/preset schema, old renderer, old install-plan, old tool-output map 제거
  - loader에서는 현재 catalog loading에 필요한 skill/subagent/integration/pack logic만 남김
  - skill catalog의 `included_in_presets` 필드는 preset-first 모델 잔재이므로 schema/data/tests에서 제거
- unused old UX utilities 제거:
  - old generic `lib/install.ts`, `lib/uninstall.ts`
  - old Claude/Gemini settings prompt/install utilities
  - old `.prettierignore` prompt/install utility
  - old workspace candidate detector
  - 위 유틸만 쓰던 `deep-merge`/`prompt-control`도 남은 import가 없으면 제거
- 관련 테스트/스냅샷 제거 또는 갱신:
  - old manifest/diff/renderer/install-plan/uninstall-plan/settings/workspace tests 삭제
  - loader/source-hash/e2e tests는 현재 기능 기준으로 기대값 갱신
  - project-layer의 “old root manifest를 읽지 않는다” 검증은 필요하면 literal path 기반으로 유지

## Public Interface Impact

- CLI 명령 표면은 바꾸지 않는다.
- 제거되는 것은 현재 public command에서 쓰지 않는 internal TS exports와 legacy test surface다.
- 유지되는 상태 파일:
  - project: `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`
  - user/global: `.ai-ops/skills-manifest.json`, `.ai-ops/subagents-manifest.json`, `.ai-ops/integrations-manifest.json`
- 제거되는 old contract:
  - root `.ai-ops-manifest.json`
  - root `specs/`
  - preset-first rules scaffolder internals
  - workspace override renderer internals

## Test Plan

- 정리 후 전체 검증:
  ```bash
  npm run build
  npm run check
  npm run compile
  git diff --check
  ```
- 추가 검색 검증:
  ```bash
  rg -n "ManifestSchema|resolveManifestPath|readManifest|writeManifest|buildManifest|renderForTool|buildInstallPlan|inferInstalledFiles" apps/cli/src
  rg -n "included_in_presets|PresetSchema|RuleSchema|loadAllRules|loadPresets|resolvePresetRules" apps/cli/src apps/cli/data
  rg -n "\\.ai-ops-manifest\\.json|root `specs/`|root specs|spec init" README.md README.ko.md apps/cli/README.md apps/cli/README.ko.md docs
  ```
- 검색 결과가 남는 경우:
  - `CHANGELOG.md`, historical docs, deprecated/old model 설명이면 허용
  - `apps/cli/src`의 현재 runtime path에서 남으면 실패로 보고 제거/갱신

## Assumptions

- root `specs/*` 삭제는 사용자 의도 변경이므로 되돌리지 않는다.
- cleanup은 가능하면 2개 커밋으로 나눈다:
  - `chore: remove legacy project artifacts`
  - `refactor: remove legacy scaffolder internals`
- 이번 정리는 `ai-ops integration` 동작, project operating layer runtime behavior, pack runtime behavior를 새로 바꾸지 않는다.
- old workspace/package별 override 기능은 복구하지 않고, 후속 feature로만 남긴다.
