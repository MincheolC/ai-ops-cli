# Phase 3′: tool-output + renderer Context Optimization 확장

## Context

Phase 3에서 `tool-output.ts`는 도구별 출력 경로/모드만 정의하는 단순 상수로 구현됨.
`data/references/*/best-practices/context-optimization.md`의 전략이 반영되지 않음.

세 도구 모두 **네이티브 JIT 로딩**을 지원하며, 메커니즘이 다름:

| 도구        | Global 룰                                              | Domain 룰 JIT 메커니즘                                                    |
| ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Claude Code | `.claude/rules/{id}.md` (frontmatter 없음 → 항상 로딩) | `.claude/rules/{id}.md` + `paths:` frontmatter → 해당 glob 매칭 시만 로딩 |
| Codex       | 루트 `AGENTS.md`                                       | 하위 폴더 `AGENTS.override.md` → CWD 기반 JIT 로딩                        |
| Gemini      | 루트 `GEMINI.md`                                       | 하위 폴더 `GEMINI.md` → JIT scope (accessed file/dir ancestors)           |

---

## 변경 대상 파일

| 파일                             | 변경                                                            |
| -------------------------------- | --------------------------------------------------------------- |
| `src/tool-output.ts`             | `GLOBAL_CATEGORIES`, `CLAUDE_CODE_PATH_GLOBS`, 도구별 설정 확장 |
| `src/renderer.ts`                | 도구별 렌더링 함수 추가 (기존 함수 미변경)                      |
| `src/__tests__/renderer.test.ts` | 새 함수 테스트 + snapshot                                       |
| `docs/tui-flow-ai-init-plan.md`  | 모노레포 워크스페이스 디렉토리 선택 플로우 반영                 |

Rule Schema, Preset Schema 변경 **없음**.

---

## Step 1. `tool-output.ts` 확장

```ts
// global 성격의 category (항상 로딩)
export const GLOBAL_CATEGORIES = ['persona', 'communication', 'philosophy', 'convention', 'standard'] as const;

// Claude Code paths: frontmatter용 Rule ID → glob 매핑
// src/ 없이 루트를 src처럼 쓰는 React/Next.js 프로젝트 고려
// 매핑에 없는 domain 룰 → frontmatter 없이 항상 로딩 (안전 fallback)
export const CLAUDE_CODE_PATH_GLOBS: Readonly<Record<string, readonly string[]>> = {
  typescript: ['**/*.ts', '**/*.tsx'],
  'react-typescript': ['**/*.tsx', '**/*.jsx'],
  nextjs: ['**/app/**', 'next.config.*', '**/middleware.ts'],
  nestjs: ['**/*.module.ts', '**/*.controller.ts', '**/*.service.ts'],
  'nestjs-graphql': ['**/*.resolver.ts'],
  graphql: ['**/*.graphql', '**/*.gql'],
  'prisma-postgresql': ['prisma/**', '**/*.prisma'],
  'shadcn-ui': ['**/components/ui/**'],
  flutter: ['lib/**/*.dart'],
  python: ['**/*.py'],
  fastapi: ['**/routers/**', '**/main.py'],
  sqlalchemy: ['**/models/**/*.py', 'alembic/**'],
  'data-pipeline-python': ['**/pipelines/**', '**/etl/**'],
  'ai-llm-python': ['**/agents/**', '**/chains/**'],
  'libs-frontend-web': ['**/*.tsx', '**/*.ts'],
  'libs-frontend-app': ['lib/**/*.dart'],
  'libs-backend-ts': ['**/*.ts'],
  'libs-backend-python': ['**/*.py'],
};

// 도구별 설정
export const TOOL_OUTPUT_MAP = {
  'claude-code': {
    mode: 'multi-file' as const,
    rulesDir: '.claude/rules',
    fileExtension: '.md',
    contextStrategy: 'path-scoped' as const, // paths: frontmatter
  },
  codex: {
    mode: 'multi-file' as const, // ← single-file에서 변경
    rootFileName: 'AGENTS.md', // global 룰
    domainFileName: 'AGENTS.override.md', // domain 룰 (하위 폴더)
    contextStrategy: 'hierarchical' as const, // 루트 + 하위 폴더 JIT
  },
  gemini: {
    mode: 'multi-file' as const, // ← single-file에서 변경
    rootFileName: 'GEMINI.md', // global 룰
    domainFileName: 'GEMINI.md', // domain 룰 (하위 폴더)
    contextStrategy: 'hierarchical' as const, // 루트 + 하위 폴더 JIT
  },
} as const;
```

### Codex/Gemini Hierarchical 설계

Phase 5 TUI에서 모노레포 경로 선택:

```
# TUI 플로우 (Phase 5)
? 모노레포입니까? → Yes
? domain 룰을 설치할 워크스페이스를 선택하세요 (CWD 하위 디렉토리):
  ☑ apps/web        → preset: frontend-web
  ☑ services/api    → preset: backend-ts
  ☐ packages/shared
  ☐ 직접 입력...

# 결과 (Codex 예시)
project/
  AGENTS.md                      ← global 룰
  apps/web/AGENTS.override.md    ← frontend domain 룰
  services/api/AGENTS.override.md ← backend domain 룰

# 결과 (Gemini 예시)
project/
  GEMINI.md                      ← global 룰
  apps/web/GEMINI.md             ← frontend domain 룰
  services/api/GEMINI.md         ← backend domain 룰
```

- CWD 하위 디렉토리를 리스트로 보여주고 선택하게 함 (마지막 옵션: 직접 입력)
- 각 선택된 경로에 대해 프리셋 선택 → domain 룰 렌더링 → 해당 경로에 파일 설치
- Codex는 `AGENTS.override.md` 사용 (사용자의 기존 `AGENTS.md` 충돌 방지)

**Phase 3의 책임**: global/domain 콘텐츠 분리 렌더링만. 경로 결정은 Phase 5 CLI.
**Phase 5의 책임**: TUI에서 디렉토리 리스트 제공 + 경로별 프리셋 매핑 + 파일 배치.

---

## Step 2. `renderer.ts` 도구별 렌더링 함수 추가

기존 4개 함수 **미변경**. 아래 함수 추가 (모두 순수 함수):

```
isGlobalRule(rule): boolean
  — GLOBAL_CATEGORIES 기반 판별

partitionRules(rules): { global: Rule[]; domain: Rule[] }
  — global/domain 분리

renderFrontmatter(paths: readonly string[]): string
  — YAML frontmatter 블록 생성

renderClaudeCodeRule(rule): string
  — domain 룰: paths: frontmatter + renderRuleToMarkdown
  — global 룰 or 매핑 없음: renderRuleToMarkdown만

renderForTool(toolId, rules): ToolRenderResult
  — CLI 진입점. tagged union 반환:

    claude-code → {
      files: { fileName, content }[]   // 모든 룰 개별 파일
    }
    codex → {
      rootContent: string,             // global 룰 병합 (AGENTS.md)
      domainContent: string,           // domain 룰 병합 (AGENTS.override.md)
    }
    gemini → {
      rootContent: string,             // global 룰 병합 (GEMINI.md)
      domainContent: string,           // domain 룰 병합 (GEMINI.md)
    }
```

Codex/Gemini의 `domainContent`를 어느 하위 폴더에 배치할지는 Phase 5 CLI 책임.
Phase 3는 "global 렌더링 결과"와 "domain 렌더링 결과"를 분리 반환만 함.

---

## Step 3. `renderer.test.ts` 테스트 추가

| 케이스                                                                       |
| ---------------------------------------------------------------------------- |
| isGlobalRule: persona → true, language → false                               |
| partitionRules: 혼합 입력 → 정확한 분리                                      |
| partitionRules: 빈 배열 → 양쪽 빈 배열                                       |
| renderFrontmatter: glob 배열 → YAML frontmatter 문자열                       |
| renderClaudeCodeRule: domain 룰 (typescript) → frontmatter 포함              |
| renderClaudeCodeRule: global 룰 → frontmatter 없음                           |
| renderClaudeCodeRule: 매핑 없는 domain 룰 → frontmatter 없음 (안전 fallback) |
| renderForTool('claude-code'): files 배열, domain 파일에 frontmatter          |
| renderForTool('codex'): rootContent에 global만, domainContent에 domain만     |
| renderForTool('gemini'): rootContent에 global만, domainContent에 domain만    |
| Snapshot: renderForTool 도구별 출력                                          |

---

## Verification

```bash
cd packages/compiler
npx vitest run src/__tests__/renderer.test.ts   # 신규 테스트
npx vitest run                                   # 전체 regression
npm run build                                    # tsup ESM 빌드
```
