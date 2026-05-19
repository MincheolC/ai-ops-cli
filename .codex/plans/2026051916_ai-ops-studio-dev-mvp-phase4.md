# Phase 4 구현 계획: Project Views

## Summary

Phase 4는 Studio shell을 실제 Project read surface로 바꾼다. 범위는 `Overview`, `Context Graph`, `Documents`, `Inspector`까지이며, Audit detail, Runtime detail, Appearance/theme switcher는 이후 phase로 유지한다.

현재 Phase 3 변경이 staged 상태이므로, Phase 4 착수 전 Phase 3 리뷰/커밋을 먼저 끝내고 diff가 섞이지 않게 한다. `dist`, `node_modules`, `src-tauri/target` 같은 생성물은 Phase 4 커밋에 포함하지 않는다.

## Key Changes

- nav를 PRD 구조에 맞춘다.
  - Project: `Overview`, `Context Graph`, `Documents`
  - `Audit`, `Integrations`, `Skills`, `Subagents`, `Hooks`, `Appearance`는 placeholder만 유지
- snapshot envelope에서 Project view model을 만든다.
  - `snapshot.project.documents`만 document source로 사용
  - repo-wide file picker나 context-layer 밖 파일 노출 없음
  - full CLI schema import 없이 Studio-local type guards/helper로 필요한 필드만 좁힌다.
- Zustand store를 확장한다.
  - `selectedView`
  - `selectedDocumentPath`
  - `sidebarCollapsed`
  - snapshot payload는 저장하지 않는다.
- Markdown preview를 추가한다.
  - `react-markdown` + `remark-gfm` + `rehype-sanitize`
  - `rehype-raw`와 `dangerouslySetInnerHTML`은 사용하지 않는다.
  - edit tab/raw tab은 만들지 않는다.
- Inspector를 추가한다.
  - `status`, `layer`, `owner`, `read_when`, `update_when`
  - indexed/current `contentHash`, match state
  - provenance: `ai-ops-managed`, `project-owned`, `pack-document`, `context-only`
  - `Reserved`, `Draft`, `Archived`, `readError`, hash mismatch warning

## View Behavior

- `Overview`
  - project root, project state, source file health, audit summary, document counts by status/layer/owner를 보여준다.
  - `uninitialized`이면 Context Graph/Documents 대신 empty state를 보여준다.
  - `degraded`이면 경고 banner를 유지하되 읽을 수 있는 documents는 계속 노출한다.
- `Context Graph`
  - documents를 `status -> layer -> owner/path` 기준으로 그룹화한다.
  - `Active`, `Draft`, `Reserved`, `Archived`를 시각적으로 분리한다.
  - document row 선택 시 `selectedDocumentPath`를 설정하고 `Documents` view로 이동한다.
- `Documents`
  - 좌측 document list, 중앙 Markdown preview, 우측 Inspector 구조로 만든다.
  - 모바일에서는 preview 아래에 Inspector를 배치한다.
  - 선택된 문서가 없으면 첫 `Active` 문서, 없으면 첫 document를 기본 선택한다.
- `Reserved`
  - 현재 판단 근거로 쓰지 않는 상태임을 강하게 표시한다.
  - Preview 자체는 가능하지만 Inspector와 list badge에서 경고를 유지한다.

## Test Plan

- `npm run test --workspace=apps/studio`
  - Context Graph가 `snapshot.project.documents`만 렌더링한다.
  - status/layer/owner grouping이 동작한다.
  - graph row 선택 시 Documents view와 selected document가 갱신된다.
  - Markdown preview가 heading, table, code block을 렌더링한다.
  - raw HTML은 실행/렌더링하지 않는다.
  - Inspector가 metadata, hash match, provenance, trust warning을 표시한다.
  - `Reserved` 문서 warning이 list와 inspector에 표시된다.
  - `uninitialized` snapshot에서 graph/documents가 empty state로 표시된다.
- `npm run build --workspace=apps/studio`
- `npm run studio:test`
- 가능하면 `npm run studio:dev` smoke로 initialized/uninitialized project를 각각 확인한다.

## Review And Commit Checkpoint

리뷰 포인트:

- Project view가 context-layer 밖 파일을 열거나 암시하지 않는지 확인한다.
- Markdown preview가 read-only인지 확인한다.
- Inspector 경고가 `Reserved`, `Draft`, `Archived` 신뢰도 차이를 분명히 보여주는지 확인한다.
- Runtime/Audit/Appearance 구현이 Phase 4에 섞이지 않았는지 확인한다.

권장 커밋 메시지: `feat(studio): add project context views`

## Assumptions

- UI text는 기존 Phase 3처럼 English label 중심으로 유지한다.
- Phase 4는 CLI snapshot schema나 Tauri command contract를 바꾸지 않는다.
- Phase 4는 project/user-global 파일에 쓰지 않는다.
- Phase 4는 document editing, raw Markdown tab, arbitrary pinning을 만들지 않는다.
