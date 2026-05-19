# Phase 5 구현 계획: Audit View

## Summary

Phase 5는 snapshot에 들어있는 project audit 결과를 사람이 읽기 좋은 `Audit` 화면으로 만든다. 이 단계에서 별도 audit command를 실행하지 않고, 기존 `studio snapshot` read model을 사용한다.

중요 결정: `project.audit.issues`에 Studio용 metadata를 additive로 확장한다. 기존 `level/code/message`는 유지하고 `source`, `affectedPath`, `suggestedActionLabel`을 추가해 UI가 message 문자열 parsing에 의존하지 않게 한다.

## Key Changes

- CLI snapshot contract를 additive로 확장한다.
  - `source`: `manifest`, `context-layer`, `docs-status`, `frontmatter`, `managed-section`, `file-system`, `source-hash`, `unknown`
  - `affectedPath`: 관련 파일/document path 또는 `null`
  - `suggestedActionLabel`: 실행 없는 안내 label 또는 `null`
- `apps/cli/src/core/studio-snapshot.ts`에서 audit issue metadata를 정규화한다.
  - core `auditProjectLayer` 자체는 크게 바꾸지 않는다.
  - Studio snapshot 조립 단계에서 `code` 기반으로 source/path/action label을 붙인다.
- Studio에 Audit view model을 추가한다.
  - severity, code, source, affectedPath 기준으로 grouping
  - selected issue state는 Zustand에 `selectedAuditIssueId`로만 저장
  - snapshot payload는 Zustand에 저장하지 않는다.
- `Audit` nav를 placeholder에서 실제 view로 전환한다.
  - summary cards: errors, warnings, affected paths, issue sources
  - issue list: grouped diagnostics
  - bottom/right diagnostics panel: selected issue details
  - 관련 document path가 있으면 `Open Document`로 Documents view 이동
- Suggested action은 label만 보여준다.
  - `Run`, `Fix`, `Update` 같은 mutation button은 만들지 않는다.
  - `Refresh snapshot`은 기존 read-only snapshot refresh만 사용한다.

## Metadata Mapping

- `missing-manifest`, `invalid-manifest`
  - source: `manifest`
  - affectedPath: `.ai-ops/manifest.json`
- `missing-context-index`, `invalid-context-index`, `context-*`
  - source: `context-layer`
  - affectedPath: `.ai-ops/context-layer.json` 또는 관련 document path
- `missing-docs-status`, `invalid-docs-status`, `docs-status-*`
  - source: `docs-status`
  - affectedPath: `docs/docs-status.md` 또는 관련 document path
- `missing-file`
  - source: `file-system`
  - affectedPath: missing file path
- `invalid-frontmatter`
  - source: `frontmatter`
  - affectedPath: document path
- `missing-managed-section`
  - source: `managed-section`
  - affectedPath: document path
- `source-hash-drift`, `managed-source-hash-drift`
  - source: `source-hash`
  - affectedPath: document path when available, otherwise `null`

## Test Plan

- CLI tests
  - snapshot issue keeps `level/code/message`.
  - docs-status mismatch gets `source: "docs-status"` and affected document path.
  - context mismatch gets `source: "context-layer"` and affected document path.
  - missing file gets `source: "file-system"` and missing path.
  - invalid frontmatter gets `source: "frontmatter"`.
  - unknown code falls back to `source: "unknown"` without crashing.
- Studio tests
  - clean audit renders empty/clear state.
  - errors and warnings are grouped separately.
  - issue groups include code, source, and affected path.
  - selecting an issue opens diagnostics panel.
  - document-linked issue can navigate to Documents and select that document.
  - non-document source issue does not show document navigation.
  - suggested action appears as text/label only, not an executable mutation control.
- Validation
  - `npm run test --workspace=apps/cli`
  - `npm run test --workspace=apps/studio`
  - `npm run build --workspace=apps/cli`
  - `npm run build --workspace=apps/studio`
  - 가능하면 `npm run studio:dev` smoke로 audit warning/error/clear 상태를 확인한다.

## Review And Commit Checkpoint

리뷰 포인트:

- Audit view가 project docs와 runtime assets를 섞지 않는지 확인한다.
- metadata mapping이 Korean message text에 과도하게 의존하지 않는지 확인한다.
- issue click이 mutation 없이 navigation만 수행하는지 확인한다.
- Phase 6 Runtime pages나 Phase 7 Appearance 구현이 섞이지 않았는지 확인한다.

권장 커밋 메시지: `feat(studio): add audit diagnostics view`

## Assumptions

- Phase 5는 `ai-ops audit` 별도 실행 버튼을 만들지 않는다.
- Phase 5는 suggested fix 실행을 만들지 않는다.
- Phase 5의 snapshot contract 변경은 additive이며 `schemaVersion`은 유지한다.
- CLI core audit issue 생성 로직은 최소 변경하고, Studio metadata는 snapshot 조립 계층에서 정규화한다.
