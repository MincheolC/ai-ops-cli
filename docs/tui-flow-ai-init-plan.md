# Objective

Phase 2-C′: `ai-ops init`의 TUI 플로우를 설계하고, 프로젝트 타입별 프리셋을 정의하며, Profile/Manifest 스키마를 새 설계에 맞게 개편합니다.

# Key Files & Context

- `packages/compiler/src/schemas/profile.schema.ts` (삭제 및 `preset.schema.ts`로 교체)
- `packages/compiler/src/schemas/manifest.schema.ts` (변경)
- `packages/compiler/src/schemas/index.ts` (export 변경)
- `packages/compiler/src/schemas/__tests__/profile.schema.test.ts` (삭제 및 `preset.schema.test.ts`로 교체)
- `packages/compiler/src/schemas/__tests__/manifest.schema.test.ts` (변경)
- `packages/compiler/data/presets.yaml` (신규 파일: 프리셋 매핑 정의)

# Implementation Steps

## 1. TUI 플로우 설계 (Mermaid)

피드백 반영 사항:

1. **스코프 선택 지연**: `Rule`은 프로젝트 단위가 일반적이고 `Skill, Hook, Command`는 Global 설정이 될 수 있으므로, 어떤 항목을 설치할지 먼저 선택한 뒤에 필요시 스코프를 묻도록 플로우를 변경했습니다.
2. **모노레포 선행 질문**: 환경 감지를 무작정 하기보다 사용자에게 먼저 모노레포인지 묻고, 그 답변에 따라 Root를 감지할지 Workspace를 감지할지 결정하도록 순서를 변경했습니다.

```mermaid
flowchart TD
    Start[CLI ai-ops init] --> AI_Tools{AI 도구 다중 선택}
    AI_Tools -->|"claude, gemini, codex"| Categories

    Categories{설치 항목 다중 선택}
    Categories -->|"규칙, 스킬, 훅, 명령어"| Has_Rules

    Has_Rules{규칙 포함?}
    Has_Rules -->|"Yes"| Is_Monorepo
    Has_Rules -->|"No"| Has_Exts

    %% Phase 1: 규칙 설치 플로우
    Is_Monorepo{모노레포입니까?}
    Is_Monorepo -->|"Yes"| Detect_Workspace[워크스페이스 환경 자동 감지]
    Is_Monorepo -->|"No"| Detect_Root[루트 환경 자동 감지]

    Detect_Workspace --> Env_Result
    Detect_Root --> Env_Result

    Env_Result{환경 감지 결과}
    Env_Result -->|"성공"| Auto_Suggest[스택 기반 프리셋 추천]
    Env_Result -->|"실패"| App_Type{어플리케이션 타입}

    Auto_Suggest --> Confirm_Auto{추천 수락?}
    Confirm_Auto -->|"Yes"| Manual_Rules[규칙 상세 조정]
    Confirm_Auto -->|"No"| App_Type

    App_Type -->|"Frontend Web"| Preset_Web[프리셋: frontend-web]
    App_Type -->|"Frontend App"| Preset_App[프리셋: frontend-app]
    App_Type -->|"Backend TS"| Preset_Back_TS[프리셋: backend-ts]
    App_Type -->|"Backend Python"| Preset_Back_Py[프리셋: backend-python]

    Preset_Web --> Manual_Rules
    Preset_App --> Manual_Rules
    Preset_Back_TS --> Manual_Rules
    Preset_Back_Py --> Manual_Rules

    Manual_Rules --> Install_Rules[규칙 설치]
    Install_Rules --> Has_Exts

    %% Phase 2: 확장 기능 (스킬, 훅, 명령어) 설치 플로우
    Has_Exts{스킬/훅/명령어 포함?}
    Has_Exts -->|"Yes"| Ext_Scope[스코프 선택: Global/Project]
    Has_Exts -->|"No"| Finalize

    Ext_Scope --> Ext_Select[사용 가능한 확장 리스트 확인 및 선택]
    Ext_Select --> Install_Exts[확장 기능 설치]

    Install_Exts --> Finalize[완료 및 Manifest 업데이트]
```

## 2. 프로젝트 타입 프리셋 매핑 정의 (`data/presets.yaml`)

`packages/compiler/data/presets.yaml` 파일을 생성하여 다음 내용을 정의합니다:

```yaml
frontend-web:
  description: '웹 프론트엔드 프로젝트를 위한 프리셋'
  rules: [general, coding-convention, engineering-standards, typescript, react-ui, nextjs, tech-stack]
frontend-app:
  description: '앱 프론트엔드 프로젝트를 위한 프리셋'
  rules: [general, coding-convention, engineering-standards, flutter, tech-stack]
backend-ts:
  description: 'TypeScript 백엔드 프로젝트를 위한 프리셋'
  rules:
    [
      general,
      coding-convention,
      engineering-standards,
      typescript,
      nestjs,
      prisma-postgresql,
      graphql,
      nestjs-graphql,
      tech-stack,
    ]
backend-python:
  description: 'Python 백엔드 프로젝트를 위한 프리셋'
  rules: [general, coding-convention, engineering-standards, python, fastapi, sqlalchemy, tech-stack]
```

## 3. 스키마 정리 및 교체

1. **Preset 스키마 (`preset.schema.ts`)**
   - `profile.schema.ts` 삭제
   - `preset.schema.ts` 생성: `id`, `description`, `rules` (string array)
2. **Manifest 스키마 업데이트 (`manifest.schema.ts`)**
   - 기존 필드 중 `profile` 제거
   - `tools`: `z.array(z.string().min(1))` (선택한 AI 도구들)
   - `categories`: `z.array(z.enum(['rules', 'skills', 'hooks', 'commands']))`
   - `preset`: `z.string().optional()` (선택한 프리셋 id, 없을 경우 수동 설정)
   - `installed_rules`: `z.array(z.string().min(1))` (`include_rules` 에서 변경)
3. **배럴 파일 업데이트 (`index.ts`)**
   - Profile 관련 export 제거, Preset 관련 export 추가

## 4. 테스트 코드 수정

- `manifest.schema.test.ts`를 새 구조(tools, categories, preset 등)에 맞게 업데이트
- `profile.schema.test.ts`를 삭제하고 `preset.schema.test.ts` 작성

# Verification & Testing

- `npm run test -- packages/compiler/src/schemas` 명령어를 실행하여 Manifest 및 Preset 스키마 테스트가 통과하는지 확인.
- Zod 스키마 구조의 무결성 검증.
