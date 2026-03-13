# Agent Skills 외부화 및 글로벌 설치 확장 계획 v3

## Summary

기존 계획을 다음 기준으로 재정의한다.

- 코어(항상 로드)는 최소화한다.
- 대형/특수/고위험 규칙은 모두 Agent Skill로 외부화 가능한 구조로 전환한다.
- reference skill과 task skill을 유지하되, 둘 다 project와 user(global) 스코프를 지원한다.
- 기본 설치 스코프는 user(global)로 둔다. 프로젝트 종속성이 강한 경우만 --project로 설치한다.
- Codex/Gemini는 .agents/skills, Claude는 .claude/skills에 설치한다.
- npm 배포 전에, README에 “로컬에서 skill 지연 로딩을 검증하는 테스트 절차”를 명시한다. 검증용 임시 script는 console.log('A Skill loaded')를 출력하는 최소 스크립트로 표준화한다.
- 구현은 한 번에 밀지 않고, 명령/스키마/렌더러/문서/검증을 분리한 작업 단위로 쪼갠다. 각 단위는 구현, 테스트, 커밋까지 포함한다.

## Key Changes

### 1. Skill 분류와 글로벌 지원 정책

/
Skill은 두 타입으로 유지한다.

- reference skill
  - 목적: 기존 rule 지식을 지연 로딩 가능한 skill 패키지로 제공
  - 설치 방식: ai-ops init/update에서 preset/rule 선택 결과에 따라 자동 생성 가능
  - 수동 설치 방식: ai-ops skill install <id>도 허용
  - 스코프: user 기본, project 선택 가능
  - 글로벌 허용: 가능
- task skill
  - 목적: 문제 해결 절차, 워크플로우, 점검 루틴 등 능동 트리거형 skill 제공
  - 설치 방식: ai-ops skill ...
  - 스코프: user 기본, project 선택 가능
  - 글로벌 허용: 가능

글로벌 허용 조건은 “명시 메타데이터”로 고정한다.

- 모든 skill 정의에 install_scopes: ("user" | "project")[] 추가
- 글로벌 설치 가능 여부는 install_scopes에 user 포함 여부로 판정
- 추론 기반 허용, 태그 기반 간접 판정은 사용하지 않는다

### 2. 설치 경로 및 skill 패키지 표준

설치 경로는 아래로 고정한다.

- Codex/Gemini
  - project: ./.agents/skills/<skill-id>/
  - user: ~/.agents/skills/<skill-id>/
- Claude
  - project: ./.claude/skills/<skill-id>/
  - user: ~/.claude/skills/<skill-id>/

skill 디렉토리 구조는 agentskills 표준으로 통일한다.

- SKILL.md 필수
- references/ optional
- assets/ optional
- scripts/ optional

SKILL.md frontmatter/metadata에 아래를 포함한다.

- name
- description
- kind: reference | task
- supported_tools
- allow_implicit_invocation
- install_scopes
- Claude 전용 제약이 필요하면 renderer가 SKILL.md 본문/frontmatter를 tool별로 미세 조정

agents/openai.yaml 같은 추가 메타 파일은 v1에서 도입하지 않는다.

### 3. CLI 표면 재설계

기존 명령은 프로젝트 중심 기본 설치 플로우를 유지하되, skill 산출물을 함께 다룬다.

- ai-ops init
  - 코어 rule 설치
  - 선택된 rule 중 delivery=reference-skill인 항목은 대응 skill도 생성
  - 기본 scope는 user
  - --project를 주면 project scope로 설치
  - 초기 버전에서는 interactive prompt에서 scope 선택을 먼저 받되, non-interactive 확장 가능성을 고려해 옵션 형태를 병행 가능하게 설계
- ai-ops update
  - project manifest 기준 project 설치물 갱신
  - user scope 설치물은 ai-ops skill update --scope user 또는 ai-ops update --global-skills 중 하나로 다룰 수 있도록 설계
  - v1 단순화를 위해 project/update와 global skill/update는 명령을 분리한다
- ai-ops diff
  - project manifest 기준 변경 확인
  - global skill 상태 비교는 ai-ops skill diff를 신규 추가하는 쪽으로 고정
- ai-ops uninstall
  - project 설치물만 제거
  - global 설치물은 제거하지 않음

신규 명령군은 모든 skill의 직접 설치/관리 surface가 된다.

- ai-ops skill list [--scope user|project] [--tool <tool>...]
- ai-ops skill install <skill-id> [--scope user|project] [--tool <tool>...]
- ai-ops skill update [skill-id] [--scope user|project] [--tool <tool>...]
- ai-ops skill diff [skill-id] [--scope user|project]
- ai-ops skill uninstall <skill-id> [--scope user|project] [--tool <tool>...]

동작 규칙:

- 기본 scope는 user
- -g는 --scope user alias로 허용
- --project는 --scope project alias로 허용
- reference skill, task skill 모두 ai-ops skill install 대상
- init은 여전히 preset 기반 대량 설치용, skill 명령은 개별/운영 관리용

### 4. 데이터 모델 및 상태 추적

프로젝트 manifest와 글로벌 registry를 분리한다.

- 프로젝트 manifest: .ai-ops-manifest.json
  - 역할: project scope 설치 상태 추적
  - 기존 필드 유지
  - 신규 필드:
    - installed_skills?: { id, kind, tools, scope, installed_paths, sourceHash, source_rules? }[]
- 글로벌 registry: ~/.ai-ops/skills-manifest.json
  - 역할: user scope skill 설치 상태 추적
  - 필드:
    - skills: { id, kind, tools, scope: "user", installed_paths, cliVersion, sourceHash, generatedAt }[]

SSOT는 rule과 skill을 분리한다.

- rule 스키마 추가 필드
  - delivery: "core" | "reference-skill"
  - reference_skill_id?
  - core_excerpt?
  - supported_tools
- skill 스키마 신규 도입
  - id
  - kind: "reference" | "task"
  - description
  - supported_tools
  - allow_implicit_invocation
  - install_scopes
  - references?
  - assets?
  - scripts?
  - source_from_rules?

설계 원칙:

- rule은 “코어 문서에 남길 최소 지식”을 담당
- skill은 “지연 로딩 가능한 확장 지식/절차”를 담당
- 같은 도메인이라도 코어와 skill 양쪽에 일부가 동시에 존재할 수 있음

### 5. 렌더링 및 검증 전략

렌더러는 “instruction 파일 렌더링”과 “skill 패키지 렌더링”을 분리한다.

- 기존 renderer는 core rule 문서 산출물 담당
- 신규 skill renderer는 skill 디렉토리 전체 산출물 담당
- tool별 차이:
  - Codex/Gemini: 공통 .agents/skills 포맷
  - Claude: .claude/skills 포맷 및 frontmatter 제한 반영

지연 로딩 로컬 검증용 테스트 skill 규칙:

- 모든 에이전트에서 공통으로 사용할 scripts/loaded.js 또는 동등 파일을 가진 샘플 skill을 만든다
- 스크립트는 최소 동작만 포함:
  - console.log('A Skill loaded')
- README에는 아래 검증 절차를 추가한다.
  - 로컬에서 skill 설치
  - 에이전트별로 해당 skill이 로딩될 만한 프롬프트 실행
  - 필요 시 skill 내부 script를 수동 실행해 파일 배치/참조 경로도 확인
  - 세션/프로세스 재시작이 필요한 도구(Codex 등)는 명시
- 이 테스트 skill은 개발 검증용 fixture로 두고, npm publish 산출물 포함 여부는 명확히 결정한다.
  - 권장: 실제 패키지에는 포함하지 않고 test fixture 또는 example asset으로만 유지

## Work Breakdown

### 1. Skill 도메인 모델 도입

- 목표: rule/skill 스키마와 타입 시스템을 분리하고 글로벌 설치 가능 정책을 메타데이터로 고정
- 작업:
  - rule.schema 확장
  - skill.schema 신규 도입
  - sample data 정의
  - source hash 범위 재정의
- 테스트:
  - schema parse 성공/실패 케이스
  - install_scopes 검증
  - reference_skill_id 정합성 검증
- 커밋 단위:
  - feat(cli): add skill schemas and metadata model

### 2. Skill 렌더러 및 설치 경로 추상화

- 목표: tool/scope별 skill 출력 경로와 패키지 렌더링을 분리된 모듈로 구현
- 작업:
  - .agents/skills / .claude/skills path resolver 추가
  - skill package renderer 추가
  - tool별 SKILL.md 생성기 추가
  - 임시 검증용 console.log('A Skill loaded') 스크립트 fixture 지원
- 테스트:
  - tool별 path snapshot
  - rendered skill 구조 snapshot
  - optional 디렉토리 생성 여부 검증
- 커밋 단위:
  - feat(cli): render agent skill packages for project and user scope

### 3. Registry/Manifest 이원화

- 목표: project manifest와 user skill registry를 분리해 상태 추적
- 작업:
  - .ai-ops-manifest.json 확장
  - ~/.ai-ops/skills-manifest.json I/O 추가
  - diff/update/uninstall이 어떤 저장소를 읽는지 명확히 분리
- 테스트:
  - project manifest backward compatibility
  - global registry read/write
  - uninstall 대상 계산 검증
- 커밋 단위:
  - feat(cli): track project installs and global skills separately

### 4. ai-ops skill 명령군 추가

- 목표: 모든 skill의 수동 설치/갱신/제거/조회 surface 제공
- 작업:
  - list/install/update/diff/uninstall 추가
  - -g, --project, --scope 처리
  - 지원하지 않는 scope 요청 시 오류 처리
- 테스트:
  - 기본 scope=user 확인
  - project/user 경로 분기
  - reference/task 공통 설치 가능 확인
- 커밋 단위:
  - feat(cli): add skill management commands

### 5. init/update/diff/uninstall와 reference skill 통합

- 목표: preset 기반 설치 흐름에서 reference skill을 함께 관리
- 작업:
  - init prompt에 scope 결정 추가
  - 외부화 대상 rule 선택 시 reference skill 포함 설치
  - update/diff/uninstall에 skill 산출물 연동
- 테스트:
  - 기존 project-only 설치 회귀
  - skill 포함 preset 설치 시 manifest 반영
  - uninstall 시 skill 디렉토리 제거
- 커밋 단위:
  - feat(cli): integrate reference skills into project install flow

### 6. README 및 로컬 테스트 가이드 정리

- 목표: npm 배포 전 수동 검증 절차를 문서화
- 작업:
  - local build/install/run 절차 업데이트
  - 샘플 skill 지연 로딩 검증 절차 추가
  - 에이전트별 차이점, 재시작 필요 여부, 확인 포인트 정리
- 테스트:
  - 문서 절차대로 실제 로컬 검증 수행
  - 최소 1개 reference skill, 1개 task skill 검증
- 커밋 단위:
  - docs(cli): document local skill loading verification before publish

### 7. 최종 통합 검증 및 릴리즈 준비

- 목표: npm publish 전 회귀와 수동 검증을 마감
- 작업:
  - 전체 테스트 실행
  - 주요 e2e 보강
  - changelog/release note 정리
- 테스트:
  - npm test
  - CLI e2e
  - README 수동 시나리오 재실행
- 커밋 단위:
  - chore(cli): finalize skill externalization release readiness

## Test Plan

1. 스키마/정적 검증

- rule과 skill 메타데이터가 올바르게 파싱되는지
- 글로벌 설치 허용/비허용이 install_scopes로만 제어되는지

2. 설치 경로 검증

- Codex/Gemini는 .agents/skills, Claude는 .claude/skills에 배치되는지
- user와 project scope가 올바른 루트로 분기되는지

3. 명령 동작 검증

- ai-ops skill install 기본값이 user인지
- ai-ops init --project가 project manifest만 갱신하는지
- ai-ops skill uninstall --scope user가 global registry만 갱신하는지

4. 지연 로딩 검증

- 샘플 skill의 scripts에 console.log('A Skill loaded')를 넣고 로컬에서 확인 가능한지
- 에이전트별로 skill discovery 후 트리거가 가능한지
- description 기반 자동 트리거가 과도하지 않은지

5. 회귀 검증

- 기존 사용자 프로젝트에서 rules-only 흐름이 깨지지 않는지
- 구 manifest를 읽을 때 신규 installed_skills가 없어도 update/uninstall이 가능한지

## Assumptions

- v1에서는 reference skill과 task skill 모두 글로벌 설치를 지원한다.
- 다만 init/update/uninstall은 project 흐름을 우선 유지하고, 글로벌 운영은 ai-ops skill 명령군이 담당한다.
- README의 로컬 테스트 절차는 npm publish 전 필수 수동 검증 기준으로 간주한다.
- 임시 검증용 console.log('A Skill loaded') 스크립트는 fixture/example 성격으로 유지하며, 실제 배포 패키지에 항상 포함할 필요는 없다.
