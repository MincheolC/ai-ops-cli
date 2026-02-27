# AI Scaffolding Monorepo 구현 계획

## Context

`docs/plan.md` 기획서를 기반으로 AI 컨텍스트 중앙화 CLI 도구를 구현한다.
현재 상태: 소스 코드 없음, 디렉토리 구조가 기획서 최종안(2패키지)과 불일치(4패키지), CommonJS 상태.
각 하위 스텝 단위로 plan → 작업을 반복하며, 충분히 탐구하면서 진행한다.

---

## Phase 1: 프로젝트 기반 재구성 (Infrastructure)

기존 4패키지 → 2패키지(compiler + cli) 전환, ESM 마이그레이션, 의존성 설치.

- **1-1.** 디렉토리 구조 전환 — `core-rules`, `llm-compiler`, `generated` 제거/rename → `packages/compiler/` 통합
- **1-2.** ESM 마이그레이션 — tsconfig.base.json: `module: NodeNext`, 각 패키지 tsconfig 정비
- **1-3.** package.json 정비 — 루트/compiler/cli의 name, type:module, exports, workspace deps
- **1-4.** 의존성 설치 — zod, yaml, commander, @clack/prompts, tsup, vitest
- **1-5.** ESLint 설정 교체 — Next.js 관련 제거, TS + Prettier만 유지
- **1-6.** .gitignore 업데이트 — dist/ 추가, next.js 관련 제거
- **1-7.** tsup 빌드 설정 — compiler/cli 각각 ESM 빌드 config

## Phase 2: SSOT 규칙 중앙화 및 네이티브 확장(Extensions) 구조화

복잡한 컴파일러(AST, 템플릿 변환) 대신, **지식(Rule)은 중앙화**하고 **행위(Skill, Hook 등)는 네이티브 파일 복사** 방식으로 단순화합니다. 이는 유지보수 비용을 낮추고 도구별 네이티브 기능을 100% 활용하기 위한 전략적 피벗입니다 (Simple Made Easy).

### 2-A. Zod 스키마 정의 (Rule & Registry)

- **2-A-1.** Rule YAML 스키마 — id, category, tags, priority, content(constraints/guidelines)
- **2-A-2.** Extensions Registry 스키마 — id, type(skill|hook|command), description, implementations(경로 매핑)
- **2-A-3.** Manifest 스키마 — scope, include_rules, extensions, sourceHash, generatedAt
- **2-A-4.** 스키마 barrel export + vitest 설정

### 2-B. Rule YAML 작성

기존 `.claude/rules/*.md` 컨벤션 YAML 구조화 + 주력 기술 스택 규칙 추가.

#### Rule 콘텐츠 작성 원칙

각 항목은 **하나의 레이어에만** 존재해야 한다. 레이어 간 내용이 중복되면 AI 모델에 불필요한 토큰을 소비하고, 모순이 생길 위험이 높아진다.

| 레이어           | 역할                        | 작성 기준                                                                                                                  |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `constraints`    | 절대 금지 (hard ban)        | AI가 자주 생성하는 **위험한 안티패턴**만. "DO NOT ..." 형식.                                                               |
| `guidelines`     | 권장 패턴 (best practice)   | AI가 자주 빠뜨리거나 잘못 적용하는 **긍정적 패턴**만. constraints와 대칭되지 않아야 함.                                    |
| `decision_table` | 분기 판단 (ambiguous cases) | AI가 **진짜 헷갈릴 수 있는 A vs B 선택**만. constraint/guideline으로 명확히 표현 가능한 것은 decision_table에 넣지 않는다. |

**체크리스트 (작성 후 자가 검증):**

1. 같은 주제가 2개 이상의 레이어에 등장하지 않는가?
2. AI 모델이 이미 잘 아는 내용(공식 문서에 명확히 나오는 기본 사용법)을 규칙으로 강제하고 있지 않은가?
3. 각 constraint는 실제로 AI가 위반할 가능성이 높은가?

- **2-B-1.** `data/rules/general.yaml` — 기존 general.md 기반 (역할, 커뮤니케이션, 핵심 철학)
- **2-B-2.** `data/rules/coding-convention.yaml` — 기존 coding-convention.md 기반 (네이밍, 구조)
- **2-B-3.** `data/rules/typescript.yaml` — 기존 typescript.md 기반 (type-only, no enum, etc.)
- **2-B-4.** `data/rules/nextjs.yaml` — Next.js App Router, RSC, route handler 등
- **2-B-5.** `data/rules/nestjs.yaml` — NestJS 모듈/서비스/컨트롤러 컨벤션
- **2-B-6.** `data/rules/prisma-postgresql.yaml` — Prisma 스키마 + PostgreSQL 최적화 (합본)
- **2-B-7.** `data/rules/react-ui.yaml` — React + Shadcn + TailwindCSS (합본, 프론트엔드 UI 레이어)
- **2-B-8.** `data/rules/flutter.yaml` — Flutter/Dart 컨벤션
- **2-B-9.** `data/rules/tech-stack.yaml` — 프로젝트 표준 라이브러리 선택 (category: stack, priority: 55)
- **2-B-10.** `data/rules/engineering-standards.yaml` — 횡단 엔지니어링 표준: 날짜(ISO8601 UTC), API envelope 등 (category: standard, priority: 70)
- **2-B-11.** `data/rules/graphql.yaml` — GraphQL 스키마 설계, 쿼리/뮤테이션 패턴 (category: api, priority: TBD)
- **2-B-12.** `data/rules/nestjs-graphql.yaml` — NestJS GraphQL code-first, resolver 패턴 (category: framework, priority: TBD)

### 2-C. AI 에이전트별 공식 문서 조사 & Reference 작성

각 에이전트의 rule, skill, hook, command 체계를 공식 문서에서 조사하여 `data/references/`에 정리합니다. 이는 `Phase 2-D`에서 네이티브 파일을 작성할 때의 공식 사양서 역할을 합니다.

- **2-C-1.** Claude Code 공식 문서 조사 — rule, skill, hook, command 체계 → `data/references/claude-code/*.md`
- **2-C-2.** Gemini CLI 공식 문서 조사 — rule, skill, hook, command 체계 → `data/references/gemini-cli/*.md`
- **2-C-3.** Codex CLI 공식 문서 조사 — rule, skill, hook, command 체계 → `data/references/codex/*.md`

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

## Phase 3: Core Generator & Scaffolder (Rule-only MVP)

Rule YAML을 읽어 대상 프로젝트에 Rule 파일들을 설치하는 단순한 핵심 로직. Extensions(hook/skill/command)는 Post-MVP.

- **3-1.** Rule 로더 & 정렬 — YAML 로딩 및 priority 순 정렬 (순수 함수)
- **3-2.** Rule 렌더러 — 정렬된 Rule들을 Markdown 파일로 렌더링 (tool별 출력 경로 매핑)
- **3-3.** 매니페스트(Manifest) 관리자 — 설치된 Rule 목록, sourceHash 기록 및 검증
- **3-4.** 패키지 엔트리포인트 export

## Phase 4: Managed Block 시스템 (Idempotent Install)

CLI의 파일 설치/업데이트 핵심 메커니즘.

- **4-1.** Managed Block 파서/라이터 — 마커 추출, 교체, 삽입 + 메타 헤더
- **4-2.** Managed Block 테스트 — 멱등성, 커스텀 보존
- **4-3.** Manifest 읽기/쓰기
- **4-4.** Diff 로직 — sourceHash 비교, 변경 규칙 목록
- **4-5.** Diff 테스트

## Phase 5: CLI 구현 (Rule TUI MVP)

compiler 패키지를 소비하는 @clack/prompts 기반 CLI. Rule 설치에 집중.

> **TUI 플로우 확정안** (`docs/tui-flow-ai-init-plan.md` 기준):
> 도구 선택 → 설치 항목 선택 → 모노레포 여부 → 워크스페이스 선택(또는 루트) → 워크스페이스별 preset 선택 → 규칙 세부조정(전체 선택 후 제외) → 설치
> 자동 환경 감지는 제거됨.

### 설계 결정 (구현 전 확정 필요)

- **5-D1.** Fine-tune step의 global rule 처리 방식 결정
  - Global rule (`role-persona`, `communication`, `code-philosophy`, `naming-convention`, `engineering-standards`)을 fine-tune UI에서 **잠금(locked, 항상 포함)** 처리할지, 제외도 허용할지
  - 잠금 시: `isGlobalRule()`로 필터링하여 locked 항목으로 별도 표시
  - 제외 허용 시: `domainContent`만 없어질 수 있으므로 Phase 5에서 빈 파일 생성 방지 처리 추가

- **5-D2.** 다중 워크스페이스 시 `renderForTool` 호출 패턴 결정
  - 현재 `renderForTool(toolId, rules)`는 global/domain을 내부에서 분리하므로 워크스페이스마다 호출하면 `rootContent`가 중복 생성됨
  - **권장**: 각 도구별로 `partitionRules` 한 번 → `renderRulesToMarkdown(global)`로 루트 파일 생성, 워크스페이스별로 `renderRulesToMarkdown(domainRules)`만 반복 호출
  - `renderForTool`은 단일 워크스페이스/비모노레포 케이스에만 사용

- **5-D3.** `domainContent`/domain files 비어있는 경우 처리
  - Fine-tune에서 domain rule을 전부 제외하면 codex/gemini는 `domainContent = ""`
  - 빈 `AGENTS.override.md`, `GEMINI.md` 생성 방지 로직 필요

### 구현

- **5-1.** CLI 엔트리포인트 + Commander 설정 (init/update/diff)
- ~~**5-2.** 환경 자동 감지 — package.json 스캔으로 언어/프레임워크 감지~~ (TUI 플로우 변경으로 제거)
- ~~**5-3.** 자동 감지 테스트~~ (제거)
- **5-2.** `ai-ops init` — Rule TUI 플로우 (확정안 기반, 5-D1~D3 결정 반영)
- **5-3.** `ai-ops update` — manifest 기반 갱신 + --force 옵션
- **5-4.** `ai-ops diff` — 설치된 vs 최신 비교 표시
- **5-5.** 스코프 라우팅 — project(cwd) / global(~) 경로 해석
- **5-6.** CLI E2E 테스트 — temp dir에서 init/update/멱등성 검증

## Phase 6: 빌드/배포 파이프라인 (MVP 배포)

- **6-1.** 루트 npm scripts 정비 (build/test/format)
- **6-2.** vitest workspace 설정
- **6-3.** CI 파이프라인 (GitHub Actions)
- **6-4.** npm publish (or npx 실행 가능 형태로 배포)

## Phase 7: Extensions (Post-MVP — hook/skill/command)

Rule MVP 배포 및 실사용 검증 후 진행.

- **7-1.** 2-C 작업 — AI 에이전트별 공식 문서 조사 (Claude Code / Gemini CLI / Codex)
- **7-2.** `data/extensions-registry.yaml` 작성 — 훅/스킬/커스텀 명령어 SSOT 매핑
- **7-3.** Claude Code 네이티브 파일 — `data/extensions/claude/` 하드코딩
- **7-4.** Gemini CLI 네이티브 파일 — `data/extensions/gemini/` 하드코딩
- **7-5.** Codex CLI 네이티브 파일 — `data/extensions/codex/` 하드코딩
- **7-6.** Scaffolder 엔진 — extensions-registry.yaml 참조, 대상 프로젝트로 복사
- **7-7.** `ai-ops init` TUI 확장 — 설치 카테고리 다중 선택(규칙/스킬/훅/커스텀 명령어)
- **7-8.** `--optimize` LLM 최적화 인터페이스 정의
- **7-9.** promptfoo 도입 검토

---

## 의존성 흐름

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

## 작업 방식

각 Phase(또는 의미 있는 하위 단위)마다 아래 루프를 반복:

1. **Plan** — plan mode로 하위 구현 계획을 세움
2. **Implement** — 승인된 계획에 맞춰 구현
3. **Review** — 구현된 내용을 사용자가 검토
4. **Commit** — 사용자가 수정 요청 또는 commit 지시
5. **Stop** — 하위 계획 완료 처리 후 작업 중단 (사용자의 다음 요청을 대기)

→ 1-5 루프 반복

## Verification

- 각 Phase 완료 시: `npm run test` 통과 확인
- Phase 3 완료 시: snapshot 테스트로 deterministic 출력 보장
- Phase 5 완료 시: temp dir에서 `ai-ops init` → 파일 생성 확인
- 전체 완료 시: `npm run build && npm run test && npm run compile` 성공
