# 📄 [최종 기획서] AI 컨텍스트 중앙화 CLI 도구 구축

## 💡 적용된 핵심 인사이트 (Core Insights Applied)

기획 단계에서 채택한 아티클의 핵심 인사이트 5가지와 그 적용 이유입니다.

- **U-shaped Attention Optimization:** AI 모델이 입력값의 처음과 끝에 집중하는 특성을 고려하여, `priority` 필드 기반 정렬 + `constraints`(금지 규칙)를 `guidelines`보다 상단에 배치하도록 컴파일러 템플릿을 설계합니다.
- **Anti-pattern-led Constraints:** "~해라"라는 긍정 지시문보다 "**~하지 마라**"라는 부정 지시문(Anti-patterns)이 AI의 환각(Hallucination)과 탈선을 막는 데 강력한 제동력을 가짐을 반영합니다. YAML 스키마에서 `constraints`(금지)와 `guidelines`(권장)를 명시적으로 분리합니다.
- **Deterministic Decision Tables:** AI의 자의적 판단을 줄이기 위해 업무 프로세스를 테이블 형태로 정의하여, 에이전트가 단계별로 실행해야 할 동작을 결정론적으로 제어합니다.
- **Internal Quality Gates:** 결과물을 내놓기 전 스스로 검수할 수 있는 **Self-Checklist**를 profile별 템플릿으로 정의하여 생성된 에셋 하단에 자동 삽입합니다.
- **Format-Function Strategy:** 데이터의 성격에 따라 **YAML**(계층적 설정), **Markdown**(서사적 가이드)으로 포맷을 분리하여 AI의 이해도를 최적화합니다.

## 1. 프로젝트 목적 (Objective)

개발 조직 내에서 파편화되어 관리되는 AI 에이전트(Claude Code, Gemini CLI, Codex 등)의 설정, 규칙, 명령어, 훅(Hook)을 단일 진실 공급원(SSOT)으로 중앙화합니다. 이를 NPM 패키지 형태의 CLI로 배포하여, 팀원 누구나 일관된 AI 페어 프로그래밍 환경을 손쉽게 구축(Scaffolding)할 수 있도록 지원합니다.

> **📌 핵심 컨셉**
>
> 플랫폼 종속적인 파일을 직접 관리하지 않고, **추상화된 메타데이터**를 SSOT로 관리하여 다중 AI 환경에 대응하는 **Asset Centralization(자산 중앙화)** 달성.

### **배경**

- 각 AI 모델(Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro 등)은 시스템 프롬프트를 해석하는 방식과 선호하는 포맷(XML 태그, Markdown 구조 등)이 지속적으로 변함.
- 각 AI 에이전트 도구(Claude Code, Gemini CLI, Codex 등)는 선호하는 프롬프트 파일 구조와 위치가 다름.
- 팀의 코딩 컨벤션, 언어 및 프레임워크의 정책 등을 중앙에서 통제하고 지속적으로 최신화할 필요가 있음.

## 2. 핵심 아키텍처 전략 (Core Architecture Strategy)

- **Prompt as Code (PaC):** 모든 AI 지시어와 규칙은 코드로서 버전 관리(VCS)되며 배포됩니다.
- **Pivot: Rule 중앙화(SSOT) + 네이티브 확장(WET):**
  - **Rule(지식/컨벤션):** YAML로 중앙 관리하며, 컴파일러가 이를 각 도구에 맞는 "지연 로딩 목차(Rule Registry)"로 렌더링합니다.
  - **Extensions(Hook/Skill/Command):** 복잡한 추상화 컴파일러 대신, 각 도구의 네이티브 문법에 맞는 원본 파일을 그대로 관리(WET)하고 CLI가 이를 복사(Scaffolding)합니다.
  - **사유:** 도구별로 상이한 동적 행위(Hook/Skill)를 하나의 스키마로 묶는 것은 '유지보수 지옥'을 유발하며, 각 도구의 강력한 네이티브 기능을 저해하기 때문입니다 (Simple Made Easy & WET > DRY).
- **Reference-driven Development:** `references/` 디렉토리에 각 AI 도구별 공식 문서 및 베스트 프랙티스를 수집하여, 네이티브 확장 기능(Extensions)을 하드코딩할 때의 공식 사양서(Source of Truth)로 활용합니다.
- **Information Architecture 중심 설계:** 단순 프롬프트 나열이 아닌, 정보의 위계(Routing → Modules → Data)를 설계하여 AI의 인지 부하를 최소화합니다.
- **제로 의존성(Zero Dependencies):** 외부 DB·API 없이 Git 저장소와 로컬 파일 시스템만으로 동작하여 이식성과 영속성을 확보합니다.

## 3. 기능 요구사항 (Functional Requirements)

### 3.1. SSOT 데이터 모델 (YAML Schema)

모든 생성기 입력의 전제인 Rule YAML 스키마를 정의합니다.

```yaml
# data/rules/typescript.yaml
id: typescript-strict
category: language
tags: [typescript, strict-mode]
priority: 80 # 0~100, 높을수록 상단 배치. tie-breaker: priority DESC → category ASC → id ASC
content:
  constraints: # Anti-pattern-led: "하지 마라" 규칙 (항상 guidelines보다 상단 배치)
    - 'DO NOT use `interface`. Use `type` only.'
    - 'DO NOT use `enum`. Use `as const` objects.'
  guidelines: # "해라" 규칙
    - 'Use arrow functions for all declarations.'
    - 'Use `import type { ... }` for type imports.'

# data/extensions-registry.yaml
extensions:
  - id: log-session
    type: custom-command
    description: '현재 작업 세션의 LLM 대화 로그를 Markdown으로 추출합니다.'
    implementations:
      claude: 'extensions/claude/commands/log-session.sh'
      gemini: 'extensions/gemini/skills/log-session/SKILL.md'
```

### 3.2. 빌드타임 (Build-Time): 파이프라인 및 에셋 생성

- **SSOT 규칙 파싱 및 검증:** `rules/`(기술 규칙) YAML을 Zod 스키마로 파싱 및 검증합니다.
- **Extensions Registry 매핑:** `extensions-registry.yaml`을 통해 전체 확장 기능(Skill/Hook/Command)의 목적과 각 도구별 네이티브 파일 경로를 관리합니다.
- **Rule Registry 렌더링:** 우선순위 기반으로 정렬된 Rule들을 바탕으로, AI 에이전트가 작업 전 어떤 규칙 파일을 읽어야 하는지 안내하는 Markdown 목차 블록을 생성합니다. (U-shaped attention 반영)
- **품질 게이트 삽입:** 각 도구별 루트 설정 파일 하단에 Self-Checklist 템플릿을 자동 추가합니다.
- **정적 자산 구조화:** 결과물과 네이티브 확장 파일들을 `generated/` 구조에 준비하여 NPM 패키징 준비를 마칩니다.

### 3.3. 런타임 (Run-Time): CLI 인터페이스

**기본 명령어:**

- `ai-ops init` — 대화형 TUI로 AI 도구 설정 설치
- `ai-ops update` — 최신 규칙으로 업데이트 (사용자 커스텀 수정사항 보존)
- `ai-ops diff` — 현재 설치된 규칙과 최신 규칙의 차이 확인

**CLI 기능:**

- **대화형 프롬프트 (Interactive TUI):** `@clack/prompts` 라이브러리를 활용하여 시각적으로 유려하고 직관적인 터미널 설치 경험 제공.
- **환경 자동 감지 (Auto-Detection):** CLI 구동 시 작업 디렉토리의 `package.json` 등을 스캔하여 언어 및 프레임워크(예: React, TypeScript)를 감지하고, 연관된 규칙 설치를 기본값으로 제안.
- **설치 스코프 라우팅 (Scope Routing):**
  - **Project (Local):** 현재 프로젝트 디렉토리 최상단에 설치
  - **Global:** 사용자 홈 디렉토리에 설치하여 전역 환경 구성
- **선택적 설치 (Feature Toggles):** 사용자가 설치할 카테고리(규칙, 명령어, 스킬, 훅)를 다중 선택(Multi-select) 할 수 있는 체크박스 UI 제공.
- **Idempotent 설치 (멱등성):** 동일 명령을 여러 번 실행해도 안전. 기존 파일이 있을 경우 아래 전략을 따릅니다:
  - **Managed Block 방식 (권장):** 마커(`# --- ai-ops:start / # --- ai-ops:end`)로 구분된 블록만 갱신. 마커 외부의 사용자 커스텀 내용은 보존.
  - **백업 후 덮어쓰기:** 타임스탬프 기반 `.bak` 파일 생성 후 교체 (사용자가 선택 가능).

## 4. 테스트 자동화 파이프라인 (Automated Testing Strategy)

CLI 동작 안정성과 컴파일러 결정론성을 검증하기 위해 CI/CD에 단계별 테스트를 구축합니다.

### 4.1. 정적 및 스키마 유효성 검사 (Syntax & Schema Validation)

- Zod 스키마로 입력(YAML) + 생성된 Registry 정보 모두 검증.
- 각 AI 도구별 포맷 준수 여부 및 필수 섹션 존재 여부를 검증.

### 4.2. 결정론적 생성 테스트 (Deterministic Assertion)

- `vitest`의 snapshot 테스트로 동일 Rule 입력 → 동일 Registry 출력 보장.
- 확장 파일(Extensions)의 경우, Registry에 정의된 경로에 실제 파일이 존재하는지 정적 검증.

### 4.3. CLI 동작 통합 테스트 (CLI E2E Testing)

- `vitest`를 활용한 가상 파일 시스템 환경에서 CLI 명령어 실행 검증.
- Scaffolding 로직 검증: 선택한 확장 기능이 대상 프로젝트의 올바른 경로로 복사되는지 확인.
- Managed Block 방식의 멱등성 검증: 2회 실행 후 커스텀 블록 보존 여부 단언.

## 5. 레포지토리 및 디렉토리 구조 (Directory Architecture)

```
ai-scaffolding-monorepo/
├── packages/
│   └── compiler/                 # [SSOT + Scaffolder] 지식 중앙화 및 스캐폴딩 로직
│       ├── src/
│       │   ├── schemas/          # Rule 및 Extension Registry Zod 스키마
│       │   ├── generator.ts      # Rule Registry Markdown 생성 로직
│       │   └── scaffolder.ts     # 네이티브 확장 파일 복사 로직
│       ├── data/
│       │   ├── rules/            # 규칙 YAML (constraints + guidelines)
│       │   ├── extensions/       # 도구별 네이티브 확장 파일 (claude, gemini, codex)
│       │   ├── references/       # [Spec] AI 도구별 공식 문서 및 사양서 (Markdown)
│       │   └── extensions-registry.yaml  # 확장 기능 통합 매핑 문서 (SSOT)
│       └── generated/            # 생성된 결과물 및 배포용 자산
└── apps/
    └── cli/                      # [Runtime] @clack/prompts 기반 배포용 CLI
```

**구조 결정 근거:**

- 4패키지(core-rules / llm-compiler / generated / cli) → **2패키지(compiler + cli)**로 단순화.
- `core-rules`를 별도 패키지로 분리할 실질적 유스케이스 부재.
- `generated/`는 compiler 패키지 내부에 위치 → 빌드 결과의 소속 명확, git 커밋 대상.
- 나중에 분리 필요 시 그때 리팩토링 (WET > DRY 원칙).

## 6. CLI UX / 운영 실전 포인트

### 6.1. Idempotent 설치와 Managed Block

CLI는 반복 실행이 필연적입니다. `ai-ops init`을 여러 번 돌려도 안전해야 합니다.

**Managed Block 방식 (기본):**

```markdown
# CLAUDE.md

내가 직접 추가한 내용 (보존됨)

<!-- ai-ops:start -->
<!-- 이 블록은 ai-ops가 관리합니다. 직접 수정 시 다음 update에서 덮어씌워집니다. -->

... 생성된 규칙 ...

<!-- ai-ops:end -->

내가 직접 추가한 다른 내용 (보존됨)
```

- 마커 내부만 갱신, 외부 커스텀 내용은 항상 보존.
- 마커가 없는 기존 파일에 `init` 시: 파일 하단에 마커 블록 append.
- `--force` 플래그로 전체 파일 교체 가능 (타임스탬프 `.bak` 생성 후 진행).

**메타 헤더로 추적 가능성 확보:**

```markdown
<!-- ai-ops:start profile=claude-code sourceHash=a3f9c2 generatedAt=2026-02-24T10:00:00Z -->

...

<!-- ai-ops:end -->
```

`ai-ops diff`가 설치된 블록의 출처와 버전을 즉시 식별 가능. `sourceHash`는 SSOT data 파일들의 해시.

**설치 매니페스트 (`.ai-ops/manifest.json`):**

```json
{
  "profile": "claude-code",
  "scope": "project",
  "include_rules": ["typescript-strict", "react-conventions"],
  "sourceHash": "a3f9c2",
  "generatedAt": "2026-02-24T10:00:00Z"
}
```

`update`/`diff`가 "이전에 뭘 설치했는지"를 매번 묻지 않고 manifest에서 읽어 동작.

### 6.2. Project vs Global 스코프와 우선순위 계층

Claude Code는 user-level과 project-level 메모리가 공존하며, **더 구체적인(project-level) 지시가 우선**합니다.

**스코프 설계 원칙:**

- **Global (`~/.claude/`):** 모든 프로젝트에 공통 적용할 페르소나, 기본 통신 규칙.
- **Project (`./.claude/`):** 해당 프로젝트 전용 기술 규칙, 프레임워크 컨벤션. Global보다 우선.

**충돌 처리 전략:**

- `ai-ops init --scope=project` 시: project-level 규칙이 global보다 우선함을 명시적으로 안내.
- 동일 규칙이 global과 project 양쪽에 설치되어 있을 경우: project를 canonical로 간주, `ai-ops diff`로 확인 가능.
- `ai-ops update` 시 스코프별 독립 업데이트. Global 업데이트가 project 커스텀을 덮어쓰지 않음.

## 7. 기술 스택 (Tech Stack)

| 구분                    | 스택                          | 비고                                  |
| ----------------------- | ----------------------------- | ------------------------------------- |
| 언어 및 환경            | Node.js, TypeScript           | ESM 기반 (`"module": "NodeNext"`)     |
| CLI / TUI               | `commander`, `@clack/prompts` |                                       |
| 모노레포                | `npm workspaces`              | 2패키지 수준에서 충분                 |
| 스키마 검증             | `zod`                         | 핵심. YAML 입력 + 생성 결과 모두 검증 |
| YAML 파싱               | `yaml`                        |                                       |
| 빌드/실행               | `tsup`                        | ESM 번들링                            |
| 테스트                  | `vitest`                      | snapshot + E2E                        |
| LLM (Layer 2, Optional) | `@google/genai` (Gemini 2.5)  | `--optimize` 플래그 시에만 사용       |
| 평가 프레임워크         | `promptfoo`                   | MVP 제외, Phase 4 이후 검토           |

> **tsconfig:** `"module": "NodeNext"` + `"moduleResolution": "NodeNext"` 로 ESM 전환. `@clack/prompts`와 `commander` 최신 버전이 ESM-first임을 반영.
