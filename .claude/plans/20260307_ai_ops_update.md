# `ai-ops update`에서 Settings 파일 재생성 + Claude multiselect

## Context

현재 `ai-ops update`는 rule 파일만 재생성하고, `.claude/settings.local.json`과 `.gemini/settings.json`은 무시한다. 패키지 버전업으로 ai-ops 설정 패치가 변경되어도 settings 파일이 갱신되지 않는 문제.

추가로 Claude settings도 Gemini처럼 사용자가 항목별로 선택할 수 있도록 `init` 프롬프트를 추가하고, manifest에 통합 구조로 저장하여 `update` 시 일관되게 재생성한다.

## 변경 사항

### 1. `claude-settings.ts` — multiselect 프롬프트 추가

**파일**: `apps/cli/src/lib/claude-settings.ts`

Gemini 패턴(`gemini-settings.ts`)을 따라 설정 그룹 + prompt + install 구조로 변경:

```typescript
const SETTING_GROUPS = [
  {
    value: 'model',
    label: 'Model — Plan 모드 모델',
    hint: 'model: opusplan — Plan 모드에서 Opus 모델 사용',
    patch: { model: 'opusplan' },
  },
  {
    value: 'plansDirectory',
    label: 'Plans Directory — 계획 파일 저장 경로',
    hint: 'plansDirectory: ./.claude/plans — 계획 파일을 .claude/plans에 저장',
    patch: { plansDirectory: './.claude/plans' },
  },
] as const;
```

- `promptClaudeSettings()` 추가 — Gemini와 동일한 confirm → multiselect 패턴
- `installClaudeSettings(basePath, selectedValues)` — 시그니처 변경, selectedValues 기반 패치 적용

### 2. Manifest 스키마에 통합 `settings` 필드 추가

**파일**: `apps/cli/src/core/schemas/manifest.schema.ts`

```typescript
const SettingsConfigSchema = z
  .object({
    claude: z.array(z.string().min(1)).optional(),
    gemini: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type SettingsConfig = z.infer<typeof SettingsConfigSchema>;
```

`ManifestSchema`에 optional 필드 추가:

```typescript
settings: SettingsConfigSchema.optional(),
```

### 3. `buildManifest` params 확장

**파일**: `apps/cli/src/core/source-hash.ts`

params에 추가:

```typescript
settings?: { claude?: readonly string[]; gemini?: readonly string[] };
```

body 변환:

```typescript
settings: params.settings
  ? {
      claude: params.settings.claude ? [...params.settings.claude] : undefined,
      gemini: params.settings.gemini ? [...params.settings.gemini] : undefined,
    }
  : undefined,
```

### 4. `init.ts` 수정

**파일**: `apps/cli/src/commands/init.ts`

import 변경:

```typescript
import { promptClaudeSettings, installClaudeSettings } from '../lib/claude-settings.js';
```

4.5 단계에 Claude 설정 프롬프트 추가 (Gemini 바로 아래):

```typescript
const claudeSettingValues: readonly string[] | null = (selectedTools as ToolId[]).includes('claude-code')
  ? await promptClaudeSettings()
  : null;
```

설치 블록:

```typescript
if (claudeSettingValues && claudeSettingValues.length > 0) {
  installClaudeSettings(basePath, claudeSettingValues);
  allInstalledFiles.push('.claude/settings.local.json');
}
```

`buildManifest` 호출에 settings 전달:

```typescript
settings:
  claudeSettingValues || geminiSettingValues
    ? {
        claude: claudeSettingValues ? [...claudeSettingValues] : undefined,
        gemini: geminiSettingValues ? [...geminiSettingValues] : undefined,
      }
    : undefined,
```

### 5. `update.ts`에 settings 재생성 로직 추가

**파일**: `apps/cli/src/commands/update.ts`

import 추가:

```typescript
import { installClaudeSettings } from '../lib/claude-settings.js';
import { installGeminiSettings } from '../lib/gemini-settings.js';
```

규칙 갱신 후, manifest 저장 전에 삽입:

```typescript
if (manifest.settings?.claude) {
  installClaudeSettings(basePath, manifest.settings.claude);
}

if (manifest.settings?.gemini) {
  installGeminiSettings(basePath, manifest.settings.gemini);
}
```

`buildManifest` 호출에 settings 전달:

```typescript
settings: manifest.settings
  ? {
      claude: manifest.settings.claude,
      gemini: manifest.settings.gemini,
    }
  : undefined,
```

### 6. 테스트 추가/수정

**파일**: `apps/cli/src/core/schemas/__tests__/manifest.schema.test.ts`

valid 케이스:

- `settings: { claude: ['model'], gemini: ['plan', 'ui'] }` 포함
- `settings` 생략 (레거시 호환)

invalid 케이스:

- `settings`에 unknown 필드 (`.strict()`)
- `claude`/`gemini` 배열에 빈 문자열

## 수정 파일 목록

| 파일                                                          | 작업                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| `apps/cli/src/lib/claude-settings.ts`                         | multiselect 프롬프트 + install 시그니처 변경             |
| `apps/cli/src/core/schemas/manifest.schema.ts`                | `SettingsConfigSchema` + optional 필드 추가              |
| `apps/cli/src/core/source-hash.ts`                            | `buildManifest` params에 `settings` 추가                 |
| `apps/cli/src/commands/init.ts`                               | Claude 프롬프트 추가 + `buildManifest`에 settings 전달   |
| `apps/cli/src/commands/update.ts`                             | import + settings 재생성 + `buildManifest` settings 전달 |
| `apps/cli/src/core/schemas/__tests__/manifest.schema.test.ts` | settings 관련 테스트 추가                                |

## 레거시 호환

- `settings`는 optional → 기존 manifest 파싱 영향 없음
- `manifest.settings?.claude`가 없으면 Claude settings 재생성 skip
- `ai-ops init` 재실행 시 `settings` 필드 기록, 이후 update 가능

## 검증

1. `npm run build` — 타입 에러 없이 빌드 성공
2. `npm test` — 기존 + 신규 테스트 전체 통과
3. 수동 검증: init → claude/gemini 선택 → settings 파일 확인 → update → 재생성 확인
