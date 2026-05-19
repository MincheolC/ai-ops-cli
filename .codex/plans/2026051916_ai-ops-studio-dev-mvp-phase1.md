# Phase 1 구현 계획: Studio Snapshot Contract

## Summary

Phase 1의 목표는 desktop app을 만들기 전에, Studio가 읽을 **read-only JSON snapshot 계약**을 CLI/core에 추가하는 것이다. 범위는 `apps/cli` 안에서 `ai-ops studio snapshot --json`을 제공하는 것까지이며, Tauri/Vite UI, theme, getdesign bundle은 이후 phase로 넘긴다.

핵심 원칙은 세 가지다.

- Project 문서는 `.ai-ops/context-layer.json`에 있는 document만 snapshot에 포함한다.
- Runtime assets는 integrations/skills/subagents/hooks로 분리해서 상태만 보여준다.
- Snapshot 실행은 project repo와 user/global runtime asset을 절대 수정하지 않는다.

## Public Interface

- 새 CLI surface:
  - `ai-ops studio snapshot --json`
  - Phase 1에서 bare `ai-ops studio` launcher는 만들지 않는다.
  - stdout은 JSON만 출력한다. Clack UI/log는 사용하지 않는다.
  - audit issue가 있어도 exit code는 `0`이고, issue는 JSON에 담는다.
  - bundled catalog가 깨지는 등 CLI 자체가 snapshot을 만들 수 없는 fatal error만 exit code `1`로 처리한다.

- 새 core API:
  - `buildStudioSnapshot(params): StudioSnapshot`
  - 위치는 `apps/cli/src/core/studio-snapshot.ts` 권장.
  - schema/type은 `apps/cli/src/core/schemas/studio-snapshot.schema.ts` 권장.
  - TypeScript 규칙상 `type` alias, Zod schema, 명시적 runtime narrowing을 사용하고 `interface`, `enum`, `any`, non-null assertion은 쓰지 않는다.

- Snapshot의 최소 top-level shape:
  - `schemaVersion: 1`
  - `kind: "ai-ops-studio-snapshot"`
  - `generatedAt`
  - `cliVersion`
  - `project`
  - `runtime`

## Implementation Changes

- `project` snapshot:
  - `root`, `state: "ready" | "uninitialized" | "degraded"`를 제공한다.
  - `.ai-ops/manifest.json`, `.ai-ops/context-layer.json`, `docs/docs-status.md`의 존재/parse 상태를 요약한다.
  - `auditProjectLayer(basePath)` 결과를 그대로 보존해 `level`, `code`, `message`, `currentSourceHash`를 UI가 쓸 수 있게 한다.
  - `documents`는 context-layer index의 `documents` 배열만 기준으로 만든다. manifest fallback으로 문서를 추가하지 않는다.
  - 각 document는 `path`, `status`, `layer`, `owner`, `read_when`, `update_when`, indexed `contentHash`, current `contentHash`, hash match 여부, provenance를 포함한다.
  - provenance는 `ai-ops-managed`, `project-owned`, `pack-document`, `context-only` 중 하나로 정규화한다.
  - Markdown content는 기존 `parseProjectLayerDocument` 경로를 사용해, ai-ops managed section이 있으면 그 section을 preview source로 삼는다.
  - `Reserved`, `Draft`, `Archived`는 snapshot에서 `trustWarning`을 제공해 UI가 강하게 표시할 수 있게 한다.
  - unsafe path, missing file, invalid frontmatter는 document-level read error로 담고, snapshot 전체 생성은 계속한다.

- `runtime` snapshot:
  - `integrations`는 bundled integration catalog와 user/global `.ai-ops/integrations-manifest.json`을 결합해 `installed`, `components`, `owned/pre-existing` 상태를 보여준다.
  - `skills`는 bundled skill catalog와 `.ai-ops/skills-manifest.json`을 결합해 catalog/install state를 보여준다.
  - `subagents`는 bundled subagent catalog와 `.ai-ops/subagents-manifest.json`을 결합해 catalog/install state를 보여준다.
  - `hooks`는 known Codex hook definitions, `CODEX_HOME || HOME/.codex/hooks.json` 기준의 installed/error 상태만 보여준다.
  - Runtime file existence check는 installed manifest의 `installed_paths`에 한해 `existsSync` 수준으로만 수행한다. 파일 내용 분석이나 usage analytics는 하지 않는다.
  - `AI_OPS_HOME`, `HOME`, `CODEX_HOME`이 없으면 runtime 전체를 fatal로 만들지 않고 `available: false`와 reason을 담는다.

- CLI wiring:
  - `apps/cli/src/commands/studio.ts`를 추가하고 `apps/cli/src/bin/index.ts`에 `studio snapshot` command group을 등록한다.
  - command layer는 cwd/env/stdout만 다루고, snapshot 조립은 core 함수에 위임한다.
  - JSON output은 deterministic하게 `JSON.stringify(snapshot, null, 2) + "\n"`로 출력한다.

- Docs:
  - `apps/cli/README.md`와 `apps/cli/README.ko.md`의 CLI surface에 `studio snapshot --json`을 추가한다.
  - 설명은 “Studio read-only snapshot contract”로 제한하고, desktop app 사용법은 아직 문서화하지 않는다.

## Test Plan

- Core tests:
  - initialized project에서 snapshot이 `state: "ready"`이고 context-layer documents만 포함하는지 검증한다.
  - uninitialized temp repo에서 `.ai-ops`를 생성하지 않고 `state: "uninitialized"`와 audit issue를 반환하는지 검증한다.
  - invalid manifest/context-layer/docs-status에서 snapshot 생성이 중단되지 않고 `state: "degraded"`와 issue/read error를 담는지 검증한다.
  - context-layer에 manifest 밖 extra document가 있을 때 `context-only` provenance와 audit warning이 같이 나오는지 검증한다.
  - `Reserved` 문서가 trust warning을 갖는지 검증한다.
  - runtime manifests가 없을 때 catalog는 보이고 installed는 false인지 검증한다.
  - installed skill/subagent/integration manifest가 있을 때 installed state와 owned component가 반영되는지 검증한다.
  - snapshot 전후 project dir/user runtime dir 파일 목록이 바뀌지 않는지 검증한다.

- Command tests:
  - `studio snapshot --json` stdout이 valid JSON이고 Clack text가 섞이지 않는지 검증한다.
  - audit error가 있는 project에서도 exit code가 `0`인 JSON snapshot을 반환하는지 검증한다.
  - fatal catalog load failure는 exit code `1` 경로로 별도 검증하거나, 최소한 core schema test로 package data corruption을 잡는다.

- Validation commands:
  - `npm run test --workspace=apps/cli`
  - `npm run build --workspace=apps/cli`
  - 필요하면 `node apps/cli/dist/bin/index.js studio snapshot --json` smoke

## Review And Commit Checkpoint

Phase 1 구현 후에는 diff를 먼저 리뷰한다.

- public CLI command가 의도보다 넓어지지 않았는지 확인한다.
- project docs와 runtime assets가 JSON에서도 섞이지 않는지 확인한다.
- snapshot 실행이 쓰기 작업을 하지 않는지 테스트와 코드 경로로 확인한다.
- 문서 변경은 `apps/cli` README pair에만 제한한다.

리뷰가 통과하면 Phase 1만 stage해서 커밋한다. 권장 커밋 메시지는 `feat(cli): add studio snapshot contract`이다.

## Assumptions

- Phase 1은 desktop shell을 만들지 않는다.
- Phase 1은 `getdesign` theme bundle을 다루지 않는다.
- Phase 1은 project document edit, runtime install/update/uninstall, usage analytics를 만들지 않는다.
- Runtime status는 “상태 표시”까지만 하되, installed manifest에 기록된 path 존재 여부와 known Codex hook 설치 여부는 read-only health로 포함한다.
