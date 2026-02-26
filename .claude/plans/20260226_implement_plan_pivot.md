# 구현 계획 업데이트: TUI 설계 + Profile → 프리셋 전환

## Context

피봇 리뷰 결과, Profile 개념을 "프로젝트 타입 프리셋"으로 대체하고 TUI 플로우를 먼저 설계하기로 결정했다.
Phase 2-C까지 완료된 상태이므로, 2-C 이후에 TUI 설계 단계를 추가하고 기존 2-D 이후를 조정한다.

## 변경 대상

`/Users/charles/ai-projects/ai-scaffolding-monorepo/.claude/plans/20260224_implement_plan.md`

## 변경 내용

### 1. 2-C 뒤에 새로운 섹션 추가: `2-C′. TUI 플로우 설계 & 프리셋 정의`

```
### 2-C′. TUI 플로우 설계 & 프로젝트 타입 프리셋 정의

Profile 개념을 폐기하고, CLI `init`의 동적 TUI 플로우가 Rule 선택을 결정하는 방식으로 전환합니다.

- **2-C′-1.** TUI 플로우 설계 — `ai-ops init`의 전체 사용자 경험을 설계
  - 설치 카테고리 다중 선택: 규칙 / 스킬 / 훅 / 커스텀 커멘드
  - 규칙 선택 분기:
    - 신규 프로젝트: 모노레포 여부 → 프론트웹/앱/백엔드 선택 → 프리셋 적용
    - 기존 프로젝트: package.json 자동 감지 → 추천 규칙 제안 또는 수동 선택
  - AI 도구 선택: claude-code / gemini-cli / codex (다중 선택)
  - 스코프 선택: project (cwd) / global (~)
- **2-C′-2.** 프로젝트 타입 프리셋 매핑 정의 — `src/presets/` 또는 `data/presets.yaml`
  - frontend-web: [typescript, react-typescript, nextjs, shadcn-ui, libs-frontend-web]
  - frontend-app: [flutter, libs-frontend-app]
  - backend-ts: [typescript, nestjs, prisma-postgresql, libs-backend-ts]
  - backend-python: [python, fastapi, sqlalchemy, libs-backend-python]
  - 등 프리셋-규칙 매핑 확정
- **2-C′-3.** Profile 스키마 정리 — `profile.schema.ts` 제거 또는 프리셋 스키마로 경량 교체, 관련 테스트 수정
- **2-C′-4.** Manifest 스키마 조정 — TUI 선택 결과를 반영하도록 manifest에 기록할 필드 확정 (선택된 프리셋, 도구, 스코프 등)
```

### 2. 기존 2-D는 그대로 유지 (Extensions 네이티브 파일 작성)

### 3. Phase 5 (CLI 구현)에서 TUI 설계 문서를 입력으로 참조하도록 명시

## Verification

- `20260224_implement_plan.md`에 2-C′ 섹션이 2-C 뒤, 2-D 앞에 정확히 삽입됨
- Profile 관련 기존 내용과 충돌 없음
