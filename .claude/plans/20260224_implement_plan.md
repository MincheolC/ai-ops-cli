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

## Phase 2: SSOT 데이터 모델 (Schemas + Data)

컴파일러의 입출력 계약 확정 + 실제 SSOT 데이터 구축.

### 2-A. Zod 스키마 정의 & 테스트

- **2-A-1.** Rule YAML Zod 스키마 — id, category, tags, priority, content(constraints/guidelines/decision_table)
- **2-A-2.** Profile YAML Zod 스키마 — id, output(format/files), include_rules, quality_gate
- **2-A-3.** Manifest 스키마 — profile, scope, include_rules, sourceHash, generatedAt
- **2-A-4.** 스키마 barrel export + vitest 설정
- **2-A-5.** 스키마 유효성 테스트 — valid/invalid 케이스

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

### 2-C. AI 에이전트별 공식 문서 조사 & Reference 작성

각 에이전트의 rule, skill, hook, command 체계를 공식 문서에서 조사하여 `data/references/`에 정리.

- **2-C-1.** Claude Code 공식 문서 조사 — rule, skill, hook, command 체계 → `data/references/claude-code.md`
- **2-C-2.** Gemini CLI 공식 문서 조사 — rule, skill, hook, command 체계 → `data/references/gemini-cli.md`
- **2-C-3.** Codex CLI 공식 문서 조사 — rule, skill, hook, command 체계 → `data/references/codex-cli.md`

### 2-D. Profile YAML 작성

2-C 조사 결과를 기반으로 각 에이전트의 실제 파일 위치/포맷/섹션 구조를 반영.

- **2-D-1.** `data/profiles/claude.yaml` — .claude/CLAUDE.md, .claude/rules/\*.md 등
- **2-D-2.** `data/profiles/gemini.yaml` — 조사된 Gemini CLI 설정 파일 구조 반영
- **2-D-3.** `data/profiles/codex.yaml` — 조사된 Codex CLI 설정 파일 구조 반영

## Phase 3: 컴파일러 핵심 로직 (Layer 1 Deterministic Compiler)

순수 함수 기반 컴파일 파이프라인. 각 함수 독립 테스트 가능.

- **3-1.** YAML 로더 — rules/profiles/references 파일 로딩 + Zod 검증
- **3-2.** YAML 로더 테스트
- **3-3.** 우선순위 정렬 로직 — priority DESC → category ASC → id ASC (순수 함수)
- **3-4.** 정렬 로직 테스트
- **3-5.** 컨텐츠 렌더러 — constraints-first, reference injection, U-shaped attention
- **3-6.** 렌더러 테스트
- **3-7.** 템플릿 엔진 — claude/gemini/codex 프로필별 출력 구조
- **3-8.** 품질 게이트 삽입 — self-checklist 하단 자동 추가
- **3-9.** 소스 해시 생성 — deterministic SHA-256 → 6자 hex
- **3-10.** 컴파일러 오케스트레이터 — thin shell이 순수 함수들 조합
- **3-11.** 스냅샷 테스트 — 동일 입력 = 동일 출력 보장
- **3-12.** 패키지 엔트리포인트 export

## Phase 4: Managed Block 시스템 (Idempotent Install)

CLI의 파일 설치/업데이트 핵심 메커니즘.

- **4-1.** Managed Block 파서/라이터 — 마커 추출, 교체, 삽입 + 메타 헤더
- **4-2.** Managed Block 테스트 — 멱등성, 커스텀 보존
- **4-3.** Manifest 읽기/쓰기
- **4-4.** Diff 로직 — sourceHash 비교, 변경 규칙 목록
- **4-5.** Diff 테스트

## Phase 5: CLI 구현 (Runtime TUI)

compiler 패키지를 소비하는 @clack/prompts 기반 CLI.

- **5-1.** CLI 엔트리포인트 + Commander 설정 (init/update/diff)
- **5-2.** 환경 자동 감지 — package.json 스캔으로 언어/프레임워크 감지
- **5-3.** 자동 감지 테스트
- **5-4.** `ai-ops init` — TUI 플로우 (감지 → scope → profile → rules 선택 → 설치)
- **5-5.** `ai-ops update` — manifest 기반 갱신 + --force 옵션
- **5-6.** `ai-ops diff` — 설치된 vs 최신 비교 표시
- **5-7.** 스코프 라우팅 — project(cwd) / global(~) 경로 해석
- **5-8.** CLI E2E 테스트 — temp dir에서 init/update/멱등성 검증

## Phase 6: 빌드/배포 파이프라인

- **6-1.** 루트 npm scripts 정비 (build/test/compile/format)
- **6-2.** generated/ 초기 결과물 생성 + 커밋
- **6-3.** vitest workspace 설정
- **6-4.** CI 파이프라인 (GitHub Actions)

## Phase 7: Layer 2 (Optional, Post-MVP)

- **7-1.** `--optimize` LLM 최적화 인터페이스 정의
- **7-2.** promptfoo 도입 검토

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
