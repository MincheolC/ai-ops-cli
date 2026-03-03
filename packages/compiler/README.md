# @ai-ops/compiler

SSOT(Single Source of Truth) YAML 룰 파일을 읽어, 각 AI 도구(Claude Code, Codex, Gemini)에 맞는 Markdown 파일로 변환·설치하기 위한 **Pure 함수 라이브러리**.

CLI(`@ai-ops/cli`)가 이 패키지를 조합해 실제 파일 쓰기를 수행한다.

---

## Architecture

```
YAML rules + presets.yaml
         │
         ▼
      [loader]          YAML → Rule[] / Preset[]
         │  resolvePresetRules → excludeRules (TUI 세부조정)
         ▼
      [renderer]        Rule[] → 도구별 Markdown
         │
         ▼
   [install-plan]       Markdown → FileAction[] (경로 + 헤더 포함 컨텐츠)
         │
         ▼
    CLI file write      FileAction[] → 실제 파일 기록
         │
         ▼
   [manifest-io]        .ai-ops-manifest.json 저장
         │
    (next install)
         │
         ▼
       [diff]           이전 Manifest vs 현재 상태 → DiffResult
```

---

## `src/` 구조

```
src/
├── schemas/
│   ├── rule.schema.ts       Rule, RuleContent, DecisionTableEntry 타입 + Zod 스키마
│   ├── preset.schema.ts     Preset 타입 + Zod 스키마
│   └── manifest.schema.ts   Manifest 타입 + Zod 스키마 (설치 추적 메타데이터)
│
├── loader.ts                YAML 파일 읽기 → Rule[] / Preset[] 파싱
├── renderer.ts              Rule[] → 도구별 Markdown 렌더링
├── tool-output.ts           도구별 경로·전략 상수 (TOOL_OUTPUT_MAP, ToolId)
├── source-hash.ts           YAML 파일 내용 기반 sourceHash 계산 + Manifest 빌더
├── managed-header.ts        파일에 ai-ops 소유 헤더 삽입·판별·파싱·제거
├── manifest-io.ts           .ai-ops-manifest.json 직렬화·역직렬화 + 파일 I/O
├── diff.ts                  이전 Manifest vs 현재 상태 비교 → DiffResult
├── install-plan.ts          renderForTool 결과 → FileAction[] (설치 계획)
└── index.ts                 barrel export
```

---

## 주요 함수

### loader

| 함수                                   | 설명                                                                |
| -------------------------------------- | ------------------------------------------------------------------- |
| `loadAllRules(rulesDir)`               | 디렉토리의 모든 `.yaml` 룰 파일 로딩                                |
| `loadPresets(presetsPath)`             | `presets.yaml` → `Preset[]`                                         |
| `resolvePresetRules(preset, allRules)` | preset의 rule ID 목록 → `Rule[]` (priority 정렬)                    |
| `excludeRules(rules, excludeIds)`      | TUI 세부조정용. 사용자가 해제한 rule ID 제거 → 나머지 `Rule[]` 반환 |

### renderer

| 함수                           | 설명                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| `renderForTool(toolId, rules)` | 핵심 진입점. 도구별 `ToolRenderResult` 반환                |
| `renderClaudeCodeRule(rule)`   | 단일 Rule → Claude Code용 Markdown (path frontmatter 포함) |
| `renderRulesToMarkdown(rules)` | Rule[] → `---` separator 단일 Markdown                     |
| `partitionRules(rules)`        | `{ global, domain }` 분리                                  |

### source-hash

| 함수                          | 설명                                                      |
| ----------------------------- | --------------------------------------------------------- |
| `computeSourceHash(rulesDir)` | YAML 파일 내용 기반 SHA-256 → 6자리 hex. YAML 수정 감지용 |
| `buildManifest(params)`       | Manifest 객체 생성 (generatedAt = 현재 시각)              |

### managed-header

| 함수                            | 설명                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `wrapWithHeader(content, meta)` | `<!-- managed by ai-ops -->` 헤더 + sourceHash/generatedAt 메타 삽입 |
| `isManagedFile(content)`        | ai-ops가 소유한 파일인지 판별                                        |
| `parseManagedHeader(content)`   | 헤더에서 `{ sourceHash, generatedAt }` 추출                          |
| `stripManagedHeader(content)`   | 헤더 제거 → 순수 컨텐츠 반환                                         |

### manifest-io

| 함수                            | 설명                                        |
| ------------------------------- | ------------------------------------------- |
| `readManifest(path)`            | `.ai-ops-manifest.json` 읽기. 없으면 `null` |
| `writeManifest(path, manifest)` | 디렉토리 자동 생성 후 JSON 저장             |
| `parseManifest(json)`           | JSON string → Zod 검증된 `Manifest`         |
| `serializeManifest(manifest)`   | `Manifest` → pretty-print JSON string       |

### diff

| 함수                                                         | 설명                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `computeDiff({ previous, currentRules, currentSourceHash })` | Set 비교로 `added` / `removed` 계산, `sourceHash` 비교로 `sourceChanged` 판단 |

### install-plan

| 함수                                               | 설명                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `buildInstallPlan({ toolId, renderResult, meta })` | 렌더링 결과 → `FileAction[]`. 각 action에 managed header 포함. 빈 content는 자동 생략 |

---

## 도구별 출력 파일

| Tool          | 파일                                                             |
| ------------- | ---------------------------------------------------------------- |
| `claude-code` | `.claude/rules/{rule-id}.md` (룰당 1파일, path frontmatter 포함) |
| `codex`       | `AGENTS.md` (root/shared) + `AGENTS.override.md` (domain)        |
| `gemini`      | `GEMINI.md` (root/shared) + `GEMINI.md` (domain, 하위 폴더)      |
