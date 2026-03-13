# Core Rule / Skill Catalog 분리 및 CLI UX 재설계 계획

## Summary

앞으로는 general core rule만 apps/cli/data/rules/\*.yaml에 남기고, 기술스택/프레임워크/라이브러리 규칙은 모두 apps/cli/data/skills/<skill-id>/를 SSOT로 사용합니다. 이에 맞춰 CLI도
“rule에서 skill을 추론”하는 UX를 버리고, preset이 core rules와 recommended skills를 직접 참조하도록 바꿉니다.

추가로 init에는 selected skills의 설치 스코프를 고르는 단계를 넣습니다. 기본값은 user(global)이고, 사용자는 preset이 추천한 skills를 전역 또는 프로젝트에 설치할지 선택할 수 있습니다.

## Key Changes

### 1. SSOT 및 데이터 모델 재편

#### Core rule YAML로 유지

다음 5개만 rules/\*.yaml에 유지합니다.

- role-persona
- communication
- code-philosophy
- naming-convention
- plan-mode

#### Externalized skill SSOT로 이동

기존 delivery: reference-skill rule YAML은 제거합니다.

- 제거 대상:
  - engineering-standards
  - graphql-core
  - graphql-client-web
  - graphql-client-app
  - graphql-server
  - nestjs-graphql
  - prisma-postgresql
  - sqlalchemy
  - ai-llm-python
  - data-pipeline-python

추가 externalize 대상:

- typescript -> typescript-language
- python -> python-language
- nestjs + libs-backend-ts -> backend-ts-nestjs-runtime
- fastapi + libs-backend-python -> backend-python-fastapi-runtime
- react-typescript + nextjs + libs-frontend-web -> frontend-web-react-next-runtime
- shadcn-ui -> frontend-web-shadcn-ui
- flutter + libs-frontend-app -> frontend-app-flutter-runtime

#### Preset schema 변경

presets.yaml은 다음 구조로 단순화합니다.

- description
- rules: core rule IDs only
- skills: recommended skill IDs

graphql 같은 logical alias/bundle은 제거하고, preset이 최종 skill ID를 직접 참조합니다.

### 2. ai-ops init UX 변경

새 흐름:

1. 도구 선택
2. 모노레포 여부 / 워크스페이스 선택
3. preset 선택
4. preset이 채운 core rules 표시
5. preset이 채운 recommended skills를 멀티셀렉트로 fine-tune
6. 선택된 skills의 설치 스코프 결정
7. optional settings 설치
8. core rules 설치 + selected skills 설치
9. manifest 저장

스코프 선택 규칙:

- 기본값은 user(global)
- prompt는 “selected skills를 어디에 설치할지”를 묻는 단일 단계로 둡니다
- 선택지는 두 개만 둡니다:
  - user(global): 기본값, 여러 프로젝트에서 재사용
  - project: 현재 프로젝트에만 설치
- v1에서는 init에서 skill별 개별 scope 혼합은 지원하지 않습니다
- 즉, 한 번의 init에서 선택된 recommended skills는 모두 같은 scope로 설치합니다

이렇게 두는 이유:

- UX는 단순해야 함
- 대부분의 skill은 여러 프로젝트에서 재사용될 가능성이 큼
- skill별 scope를 섞으면 manifest/workspace UX가 급격히 복잡해짐

모노레포 규칙:

- preset과 skill selection은 workspace별로 가능
- skill install scope prompt는 init 전체에 대해 한 번만 묻습니다
- 선택된 scope가 user면 중복 skill은 dedupe 후 한 번만 설치
- 선택된 scope가 project면 현재 repo 기준 project skill 경로에 설치

### 3. Skill 명령 UX 정리

### ai-ops skill install

역할은 그대로 유지합니다.

- 개별 skill 수동 설치
- 기본 scope는 user
- --project로 project local 설치
- source skill 디렉토리를 그대로 복사
- agents/openai.yaml 같은 tool-specific metadata도 함께 복사

### ai-ops skill list

- installable skill만 나옴
- core rule은 여기 나오지 않음
- 현재 설치 여부와 허용 scope를 같이 보여줌

### ai-ops diff / update / uninstall

- diff는 core rules drift와 project-installed skills drift를 각각 보여줍니다
- update는 manifest의 installed_rules와 installed_skills를 각각 재설치합니다
- uninstall은 project-installed core files와 project-installed skill dirs를 제거합니다
- user/global skill은 계속 ai-ops skill uninstall로 제거합니다

중요한 UX 규칙:

- init에서 user(global) scope로 설치된 skills는 ai-ops uninstall 대상이 아닙니다
- 이 점은 init 완료 메시지와 uninstall 안내에 명시합니다
- 필요하면 ai-ops skill list --scope user와 ai-ops skill uninstall <id>를 안내합니다

## Implementation Changes

- loadAllRules()는 core YAML만 읽습니다
- loadAllSkills()는 reference/task skill 전체를 읽습니다
- resolveReferenceSkills()와 delivery/reference_skill_id/core_excerpt 기반 연결 로직은 제거합니다
- PresetSchema와 preset loader는 rules[] + skills[] 구조를 읽도록 바뀝니다
- init은 resolvePresetRules()와 resolvePresetSkills()를 함께 사용합니다
- init command는 selected skills용 install scope prompt를 추가합니다
- init에서 skill scope가 project면 manifest의 installed_skills에 기록합니다
- init에서 skill scope가 user면 global registry에 기록하고, project manifest에는 기록하지 않습니다
- project manifest는 project-installed rules/files/project-installed skills만 기록합니다
- source hash는 계속 rules + skills + presets 전체 기준으로 계산합니다

## Test Plan

- data loading:
  - rules loader는 core rule 5개만 로드
  - skills loader는 모든 installable skill을 로드
  - presets가 rules[]와 skills[]를 모두 파싱
- init flow:
  - preset 선택 시 recommended skills가 자동 채워짐
  - skill fine-tune 결과가 설치와 상태 저장에 반영됨
  - skill scope prompt의 기본값이 user(global)임
  - user 선택 시 global registry만 갱신되고 project manifest의 installed_skills는 비워짐
  - project 선택 시 project manifest의 installed_skills가 채워짐
- monorepo:
  - workspace별 preset/skill 선택이 가능함
  - user scope 선택 시 중복 skill은 한 번만 global 설치됨
- lifecycle:
  - ai-ops uninstall은 project-installed skills만 제거함
  - user/global skill은 유지됨
  - ai-ops skill uninstall로 별도 제거 가능함
- regression:
  - ai-ops skill install/list/diff/update/uninstall은 기존과 동일하게 동작
  - tool-specific metadata 파일(agents/openai.yaml 등)이 source skill에서 target path로 그대로 복사됨

## Assumptions

- externalized 항목은 rule YAML 메타데이터조차 남기지 않습니다
- preset은 core rules와 skills를 분리 참조합니다
- core rule은 보편적이고 상시 로드 가능한 최소 규칙만 유지합니다
- init은 preset-first UX를 유지하되, skill fine-tune과 단일 skill-scope 선택 단계를 추가합니다
- init 한 번에서 선택된 skills는 모두 동일 scope로 설치합니다
- externalized reference skill의 canonical detailed content는 계속 references/reference.md입니다
