# Plan: plan-mode 규칙 추가 (Mermaid 도식화)

## Context

AI 도구의 Plan mode에서 계획을 세울 때 Mermaid 다이어그램을 활용하여 UX flow, logic flow 등을 도식화하도록 규칙을 추가한다. 텍스트만으로 된 계획보다 다이어그램이 포함된 계획이 사람이 리뷰하기 훨씬 용이하다.

## 변경 사항

### 1. 규칙 YAML 생성

**`packages/compiler/data/rules/plan-mode.yaml`** (신규)

- `id`: `plan-mode`
- `category`: `standard` (global → 항상 로딩)
- `tags`: `[general, planning, mermaid]`
- `priority`: `70`
- content:
  - **constraints**: 순수 텍스트만으로 설명하지 말 것 (다이어그램 가능 시)
  - **guidelines**: Mermaid flowchart / sequenceDiagram / erDiagram 활용
  - **decision_table**: 상황별 적합한 다이어그램 타입 매핑

### 2. 프리셋 업데이트

**`packages/compiler/data/presets.yaml`**

4개 프리셋 모두에 `plan-mode` 추가 (global rule이므로):

- `frontend-web`, `frontend-app`, `backend-ts`, `backend-python`

### 3. 스냅샷 갱신

`npx vitest run -u` — 렌더링 스냅샷에 신규 규칙 반영

## 검증

1. `npx vitest run` — 전체 테스트 통과
2. 스냅샷 업데이트 확인
3. `npm run build` — 빌드 성공
