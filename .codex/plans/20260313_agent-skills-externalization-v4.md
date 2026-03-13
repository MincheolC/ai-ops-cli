# Skill SSOT를 실제 Skill 디렉토리로 전환하는 수정 계획

## Summary

skill은 더 이상 apps/cli/data/skills/\*.yaml로 관리하지 않고, apps/cli/data/skills/<skill-id>/ 디렉토리 자체를 SSOT로 사용한다.

- 각 skill은 agentskills 표준 디렉토리 형태로 저장소 안에서 직접 작성한다.
- CLI는 skill 내용을 생성하지 않고, source 디렉토리를 대상 경로로 복사한다.
- reference skill은 SKILL.md를 얇게 유지하고, 실제 상세 규칙 본문은 항상 references/reference.md에 둔다.
- task skill은 절차 본문이 SKILL.md에 있다.
- apps/cli/data/skills/README.md를 추가해 용어, 작성 규칙, frontmatter 계약을 문서화한다.
- skill-load-check는 임시 검증용 task skill로 유지하되, 수동/자동 테스트 둘 다 가능하게 단순한 진입 설명과 script 실행 지시만 가진다.

## Key Changes

### 1. Skill SSOT 구조 변경

apps/cli/data/skills/ 구조를 아래처럼 고정한다.

apps/cli/data/skills/
README.md
<skill-id>/
SKILL.md
references/ # optional
assets/ # optional
scripts/ # optional

SKILL.md frontmatter에 skill 메타데이터를 둔다.

- 표준 필드: name, description
- CLI 전용 필드: kind, install_scopes, supported_tools, source_rules, allow_implicit_invocation

검증 규칙:

- 디렉토리명과 frontmatter name은 반드시 일치
- reference skill과 task skill 모두 이 구조를 사용
- YAML sidecar 파일은 두지 않음

### 2. Reference Skill 본문 규약 고정

reference skill은 아래 규칙으로 통일한다.

- SKILL.md
  - 얇은 진입 문서만 유지
  - 언제 이 skill을 써야 하는지
  - 어떤 reference 파일을 우선 읽어야 하는지
  - 이 skill이 제공하는 범위 요약
- 실제 상세 규칙 본문
  - 항상 references/reference.md에 둔다
- 금지
  - SKILL.md와 references/에 같은 상세 내용을 중복 작성
  - references/source-rules.md 같은 생성 파일 사용

즉, reference skill의 canonical content location은 항상 references/reference.md다.

### 3. Task Skill 본문 규약 고정

task skill은 아래 규칙으로 유지한다.

- 절차 본문은 SKILL.md에 둔다
- references/는 필요한 경우에만 보조 자료로 사용한다

skill-load-check는 임시 검증용 task skill로 아래처럼 고정한다.

- description
  - 사용자가 스킬 로드 테스트를 하고 싶어할 때 트리거됩니다.에 해당하는 영어 설명
- SKILL.md 본문
  - script를 실행한 결과를 반환하세요.에 해당하는 영어 지시
- scripts/loaded.js
  - console.log('A Skill loaded');

용도:

- 수동 테스트: 설치 후 직접 script 실행
- 자동 테스트: subprocess/e2e에서 설치 후 script 경로와 실행 결과 검증
- 추후 삭제 가능하므로 production feature로 강하게 결합하지 않음

### 4. apps/cli/data/skills/README.md 문서 추가

새 문서는 skill authoring contract의 단일 안내 문서로 둔다. 파일명은 오타 없이 README.md로 고정한다.

포함 내용:

- reference skill, task skill 용어 정의
- 각 skill 타입의 canonical content 위치
  - reference: references/reference.md
  - task: SKILL.md
- skill 디렉토리 구조 예시
- 생성/작성 규칙
  - directory name = frontmatter name
  - 어떤 경우에 references/, assets/, scripts/를 쓰는지
  - 무엇을 중복 작성하면 안 되는지
- frontmatter 필드 표
  - 필드명
  - 필수 여부
  - 타입/예시
  - 의미
  - CLI 사용 위치
- skill-load-check 같은 임시 검증용 skill 규칙
- reference skill과 rule YAML의 연결 방식(reference_skill_id, source_rules) 설명

문서 톤:

- 구현자/컨트리뷰터 대상
- 규약 중심
- 예시는 최소 1개 reference skill, 1개 task skill 디렉토리 스켈레톤 포함

### 5. Loader / Renderer / Install 변경

loader 변경:

- YAML skill 파일 로드를 제거
- apps/cli/data/skills/<skill-id>/SKILL.md frontmatter를 읽어 skill index를 구성
- optional 디렉토리(references/assets/scripts)를 file tree로 수집
- compiler sourceHash는 rules + presets + skills directory tree 전체 기준으로 계산

renderer 변경:

- skill 내용을 재생성하지 않음
- source skill 디렉토리의 file tree를 install plan으로 변환
- .agents/skills/<skill-id> 또는 .claude/skills/<skill-id>로 복사만 수행

설치 규칙:

- Codex/Gemini는 .agents/skills/<skill-id> 하나를 공유
- Claude는 .claude/skills/<skill-id>에 별도 설치
- update는 루트 디렉토리 전체 교체
- uninstall은 루트 디렉토리 전체 제거

### 6. 현재 구현에서 바꿔야 할 부분

제거 또는 축소 대상:

- apps/cli/data/skills/\*.yaml
- YAML 기반 SkillSchema parse 경로
- loadAllSkills(skillsDir)의 YAML 로딩
- buildSkillBody() 기반 SKILL.md 생성
- references/source-rules.md 생성 로직
- inline script/content 정의 방식의 skill-load-check.yaml

새로 필요한 것:

- SKILL.md frontmatter parser
- skill directory walker
- file-copy 기반 skill install plan builder
- 실제 file content 기반 skill hash 계산
- reference skill에 references/reference.md 존재 여부 검증
- apps/cli/data/skills/README.md 존재 및 예시 최신성 유지

### 7. 명령 동작 유지 규칙

명령 표면은 유지한다.

- ai-ops init
  - selected rules의 reference_skill_id를 보고 reference skill 디렉토리를 project scope에 설치
- ai-ops skill install/update/diff/uninstall
  - 실제 skill 디렉토리 SSOT를 기준으로 user/project scope에 설치/비교/갱신/삭제

상태 추적은 유지한다.

- project: .ai-ops-manifest.json
- user/global: ~/.ai-ops/skills-manifest.json

installed_skills[].source_rules는 계속 유지 가능하지만, 본문 생성용이 아니라 “rule-skill 연결 추적” 용도로만 사용한다.

## Test Plan

1. loader 테스트

- apps/cli/data/skills/<skill-id>/SKILL.md frontmatter를 정상 파싱하는지
- directory name과 frontmatter name 불일치를 거부하는지
- reference skill에 references/reference.md가 없으면 실패하는지
- optional assets/scripts를 정확히 수집하는지

2. renderer/install 테스트

- source skill directory를 target path로 그대로 복사하는지
- Codex/Gemini는 .agents/skills, Claude는 .claude/skills로 분기되는지
- references/source-rules.md가 더 이상 생성되지 않는지

3. reference skill 통합 테스트

- init 시 selected rules의 reference_skill_id를 보고 project reference skill이 설치되는지
- 코어 instruction 파일에는 core_excerpt만 남고, 상세 본문은 references/reference.md에만 존재하는지

4. skill-load-check 테스트

- user scope install 후 scripts/loaded.js가 복사되는지
- project scope install 후 로컬 경로에 복사되는지
- script 실행 시 A Skill loaded가 출력되는지
- SKILL.md description/body가 discovery와 테스트 목적에 맞게 유지되는지

5. 문서 테스트

- apps/cli/data/skills/README.md의 frontmatter 표와 실제 parser contract가 일치하는지
- README 예시 skill 구조가 실제 fixture와 모순되지 않는지

6. subprocess/e2e 테스트

- ai-ops skill install skill-load-check --tool codex
- ai-ops skill install skill-load-check --project --tool codex
- ai-ops skill diff/update/uninstall
- AI_OPS_HOME 격리 환경에서 global registry 동작 검증

## Assumptions

- reference skill의 상세 본문 canonical 위치는 항상 references/reference.md다.
- task skill의 canonical 본문은 SKILL.md다.
- skill 내용은 생성하지 않고 source directory를 그대로 복사하는 것이 목표다.
- apps/cli/data/skills/README.md는 contributor-facing contract 문서다.
- skill-load-check는 임시 검증용 skill이며, 유지 여부는 후속 판단 대상이다.
