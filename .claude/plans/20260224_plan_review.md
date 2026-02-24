# 기획서 검토 결과: AI 컨텍스트 중앙화 CLI 도구

## Context

5대 핵심 인사이트와 프로젝트 목적을 기준으로, 핵심 아키텍처 전략 / 기능 요구사항 / 테스트 파이프라인 / 디렉토리 구조 / 기술 스택의 **설계 타당성**과 **실행 가능성**을 검토한다.

---

## A. 핵심 아키텍처 전략 검토

### A-1. "Prompt as Code (PaC)" - 적절

- SSOT + VCS 관리는 프로젝트 목적에 정확히 부합
- 팀 내 일관성 확보의 가장 실용적인 접근

### A-2. "AOT(Ahead-of-Time) 컴파일" - 전략 수정 필요

**타당한 부분:**

- 런타임에 API Key 의존성 제거한다는 목표 자체는 올바름
- 배포 시 정적 에셋만 포함한다는 방향도 맞음

**문제점:**

- **재현성 없음:** Gemini API는 `temperature: 0`에서도 non-deterministic. 동일 입력 -> 다른 출력이면 CI/CD 빌드 파이프라인에 넣을 수 없음
- **빌드에 네트워크/API 의존성:** 오프라인 빌드 불가, rate limit, 비용 예측 불가
- **디버깅 난이도:** LLM 출력이 예상과 다를 때 원인 추적이 극도로 어려움

**수정안: 2-Layer 컴파일 전략**

```
Layer 1 (Core, Deterministic): 템플릿 기반 컴파일러
  - YAML 파싱 -> Zod 검증 -> 도구별 config 생성
  - 항상 동일 입력 = 동일 출력 (snapshot 테스트 가능)
  - 이것만으로 MVP 완성 가능

Layer 2 (Enhancement, Optional): LLM 최적화
  - `ai-ops compile --optimize` 플래그로 opt-in
  - Layer 1 출력물을 LLM이 문구 다듬기/최적화
  - 결과는 human review 후 수동 커밋 (빌드 아티팩트가 아닌 소스 코드 취급)
```

### A-3. "Information Architecture 중심 설계" - 적절

- 정보 위계(Routing -> Modules -> Data) 설계 방향은 맞음
- 단, 이 위계가 실제 YAML 스키마에 어떻게 매핑되는지 기획서에서 **구체화가 필요** (아래 B-1에서 상세)

### A-4. "제로 의존성(Zero Dependencies)" - 적절

- Git + 로컬 파일 시스템만 사용하는 원칙은 이식성 확보에 좋음
- 단, LLM 컴파일(Layer 2)을 도입하면 이 원칙과 충돌. Layer 분리로 해결됨

---

## B. 기능 요구사항 검토

### B-1. 빌드타임 - SSOT 데이터 모델 누락 (가장 큰 갭)

기획서에서 `profiles`, `protocols`, `instructions` 3개 카테고리를 제시했으나 **YAML 스키마가 정의되지 않음**. 이게 전체 시스템의 입력인데, 구체적 데이터 모델 없이 컴파일러를 설계할 수 없음.

**필요한 의사결정:**

| 결정 사항                      | 옵션                                                                        | 영향                                        |
| ------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------- |
| protocols vs instructions 경계 | (a) 현행 3분류 유지 (b) `rules/` flat + `profiles/` 2분류로 단순화          | 팀원이 규칙 추가 시 어디에 넣을지 혼란 여부 |
| 규칙의 granularity             | (a) 파일 단위 (typescript.yaml) (b) 규칙 단위 (각 규칙이 하나의 YAML entry) | 컴파일러 병합 로직 복잡도                   |
| 도구별 매핑 방식               | (a) profile에서 include할 규칙 목록 지정 (b) 규칙에 target 태그 부착        | 새 AI 도구 추가 시 확장성                   |

**제안 스키마 (예시):**

```yaml
# rules/typescript.yaml
id: typescript-strict
category: language
tags: [typescript, strict-mode]
priority: 1  # 높을수록 상단 배치 (U-shaped attention 반영)
content:
  constraints:    # Anti-pattern-led: "하지 마라" 규칙
    - "DO NOT use `interface`. Use `type` only."
    - "DO NOT use `enum`. Use `as const` objects."
  guidelines:     # "해라" 규칙
    - "Use arrow functions for all declarations."
    - "Use `import type { ... }` for type imports."

# profiles/claude.yaml
id: claude-code
output:
  format: markdown
  files:
    - path: ".claude/CLAUDE.md"
      sections: [persona, constraints, guidelines]
    - path: ".claude/rules/{category}.md"
      split_by: category
include_rules: [typescript-strict, react-conventions, ...]
```

### B-2. 빌드타임 - "정적 RAG 기반 컨텍스트 병합"

**실체:** reference 문서를 컴파일 시 결합하는 것. 이건 템플릿 변수 치환 또는 markdown include 수준의 작업.

**수정안:** "Static RAG"라는 명칭 대신 **"Reference Injection"**으로 명명. 구현은:

- `references/` 디렉토리의 markdown 파일을 카테고리별로 읽기
- 컴파일 시 해당 도구의 profile에 정의된 위치에 삽입
- LLM 없이 가능한 deterministic 작업

### B-3. 빌드타임 - "U자형 주의력 배치"

**인사이트 자체는 유효하나 구현이 과잉:**

- "Lost in the Middle" 연구는 실제로 존재하지만, 규칙 파일이 수천 토큰 이하면 실질적 영향 미미
- **실용적 구현:** 규칙의 `priority` 필드 기반 정렬 + constraints(Anti-patterns)를 guidelines보다 상단 배치
- 별도 "U-shaped optimizer"를 만들 필요 없이, 컴파일 시 정렬 로직에 반영하면 충분

### B-4. 빌드타임 - "품질 게이트 삽입"

**인사이트(Internal Quality Gates)와 잘 맞음.** 단, 구현 명확화 필요:

- Self-Checklist는 어떤 형태? 각 도구가 해석 가능한 포맷이어야 함
- **제안:** 규칙 파일 하단에 `## Quality Checklist` 섹션으로 삽입. 내용은 profile별로 정의.

### B-5. 런타임 - CLI 기능 - 적절

- `@clack/prompts` 기반 TUI: 적절한 선택
- 환경 자동 감지: package.json 스캔으로 충분, 과하지 않음
- 스코프 라우팅 (Project/Global): 명확한 유스케이스
- 선택적 설치: 당연히 필요

**누락된 CLI 기능:**

- `ai-ops init` 시 기존 파일이 있을 때 **merge vs overwrite** 전략
- `ai-ops update` - 업데이트 시 사용자 커스텀 수정사항 보존 방법
- `ai-ops diff` - 현재 설치된 규칙과 최신 규칙의 차이 확인

---

## C. 테스트 자동화 파이프라인 검토

### C-1. 정적/스키마 유효성 검사 - 적절

- 생성된 에셋의 포맷 무결성 검증은 필수
- **보강:** Zod 스키마로 입력(YAML) + 출력(생성된 config) 모두 검증
- 각 AI 도구별 파싱 가능 여부 검증 추가 (예: CLAUDE.md 파일 크기 제한 등)

### C-2. promptfoo / LLM-as-a-Judge - 재고 필요

**문제:**

- LLM이 생성한 결과를 LLM이 검증하는 것은 circular validation
- non-deterministic한 평가 -> CI에서 flaky test 원인

**수정안:**

- Layer 1(템플릿 컴파일러) 결과는 **deterministic assertion**으로 검증 (snapshot 테스트)
- Layer 2(LLM 최적화) 결과는 **구조적 검증만** 수행:
  - 필수 섹션 존재 여부
  - 토큰 수 상한
  - Anti-pattern 키워드 포함 여부
  - 대상 도구의 포맷 준수
- promptfoo는 Phase 4 이후 **선택적 도입** (팀이 필요성을 느낄 때)

### C-3. CLI E2E 테스트 - 적절

- vitest + temp directory 접근 맞음
- child_process로 실 도구 구동은 "가능할 경우" 조건부로 된 것도 현실적

---

## D. 디렉토리 구조 검토

### 현재 기획안:

```
packages/core-rules/     # SSOT 원본
packages/llm-compiler/   # 컴파일러
packages/generated/      # 컴파일 결과
apps/cli/                # 배포용 CLI
```

### 문제점:

1. **`core-rules`를 별도 패키지로 분리할 실질적 이유 부재** - 다른 도구가 직접 참조하는 유스케이스가 기획에 없음
2. **`generated/`의 위상 불명확** - 빌드 아티팩트인지 소스 코드인지에 따라 .gitignore 여부, 패키지 구조가 달라짐
3. **4패키지는 premature abstraction** - "Simple Made Easy" 원칙에 위배

### 수정안:

```
ai-scaffolding-monorepo/
├── packages/
│   └── compiler/                 # 컴파일러 + SSOT 데이터 통합
│       ├── src/
│       │   ├── schemas/          # Zod 스키마 정의
│       │   ├── templates/        # 도구별 출력 템플릿
│       │   └── compiler.ts       # 컴파일 로직
│       ├── data/
│       │   ├── rules/            # 규칙 YAML (기존 instructions + protocols 통합)
│       │   ├── profiles/         # AI 도구별 출력 설정 YAML
│       │   └── references/       # 참고 문서 (markdown)
│       └── generated/            # 컴파일 결과물 (git 커밋 대상)
│           ├── claude/
│           ├── cursor/
│           ├── gemini/
│           └── codex/
├── apps/
│   └── cli/                      # @clack/prompts 기반 CLI
│       ├── src/
│       └── bin/
└── package.json
```

**이점:**

- 2패키지로 단순화 (compiler + cli)
- 데이터와 컴파일러가 같은 패키지 -> import 경로 단순
- `generated/`는 compiler 패키지 내부에 위치 -> 빌드 결과의 소속 명확
- 나중에 분리가 필요하면 그때 하면 됨 (WET > DRY 원칙)

---

## E. 기술 스택 검토

| 스택                 | 판정       | 코멘트                                                                                            |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| Node.js + TypeScript | 적절       | CLI 도구 표준                                                                                     |
| `commander`          | 적절       | 성숙한 CLI 프레임워크                                                                             |
| `@clack/prompts`     | 적절       | 시각적 TUI에 최적                                                                                 |
| `npm workspaces`     | 적절       | 2패키지 수준이면 충분                                                                             |
| `@google/genai`      | **조건부** | Layer 2에서만 사용. Layer 1은 LLM 없이 동작해야 함                                                |
| `vitest`             | 적절       | 빠르고 TypeScript 네이티브                                                                        |
| `promptfoo`          | **보류**   | MVP에서는 불필요. 필요성 검증 후 도입                                                             |
| YAML                 | 적절       | 계층적 설정 데이터에 적합                                                                         |
| JSONL                | **불필요** | 기획서에서 "누적 로그 및 메모리"용이라 했으나, 이 프로젝트에 누적 로그가 필요한 유스케이스 불명확 |

**추가 필요 스택:**

- `zod` - YAML 파싱 후 스키마 검증 (핵심)
- `js-yaml` 또는 `yaml` - YAML 파서
- `tsx` 또는 `tsup` - TypeScript 빌드/실행

**tsconfig 관련:**

- 현재 `module: CommonJS`인데, `@clack/prompts`와 `commander` 최신 버전은 ESM-first
- **ESM 전환 권장** (`"module": "Node16"` 또는 `"module": "NodeNext"`)

---

## F. 인사이트별 구현 매핑 점검

| 인사이트                      | 기획서 구현                  | 판정      | 수정 제안                                                          |
| ----------------------------- | ---------------------------- | --------- | ------------------------------------------------------------------ |
| U-shaped Attention            | 컴파일러가 상단 배치 강제    | 과잉      | `priority` 필드 기반 정렬 + constraints 우선으로 충분              |
| Anti-pattern-led Constraints  | 명시됨                       | 적절      | YAML 스키마에 `constraints` (금지) / `guidelines` (권장) 분리 반영 |
| Deterministic Decision Tables | protocols에 테이블 형태 정의 | 적절      | YAML 스키마에서 decision table 포맷 구체화 필요                    |
| Internal Quality Gates        | 에셋 하단에 Self-Checklist   | 적절      | profile별 checklist 템플릿 정의 필요                               |
| Format-Function Strategy      | YAML/Markdown/JSONL 이원화   | 부분 적절 | JSONL 유스케이스 불명확. YAML + Markdown 2개면 충분                |

---

## G. 최종 요약: 수정이 필요한 사항

### 필수 수정 (기획서에 반영해야 함)

1. **2-Layer 컴파일 전략으로 변경** - 템플릿(Core) + LLM(Optional Enhancement)
2. **YAML 입출력 스키마 정의 추가** - 구현의 전제 조건
3. **디렉토리 구조 단순화** - 4패키지 -> 2패키지
4. **protocols/instructions 구분 재정의** 또는 통합
5. **CLI의 merge/overwrite 전략 명시**

### 선택적 수정 (기획서 품질 향상)

6. promptfoo를 MVP 범위에서 제외, Phase 4로 이동
7. JSONL 유스케이스 구체화 또는 삭제
8. "Static RAG" -> "Reference Injection"으로 명칭 변경
9. ESM 기반 tsconfig 전환 명시
