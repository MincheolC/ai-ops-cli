# Claude settings.local.json + Codex Plan Snapshot 추가

## Context

사용자가 `ai-ops init`에서 도구를 선택할 때, 도구별 추가 설정 파일을 자동으로 생성/설치하도록 확장한다.

- **Claude Code** 선택 시: `.claude/settings.local.json`에 plan 관련 설정 추가
- **Codex** 선택 시: 기존 `CODEX_PLAN_SECTION`을 더 구체적인 Plan Snapshot 내용으로 교체

## 변경 사항

### 1. Claude Code `settings.local.json` 설치

**새 파일**: `apps/cli/src/lib/claude-settings.ts`

gemini-settings.ts 패턴을 따라 생성:

```typescript
// installClaudeSettings(basePath): void
// - .claude/settings.local.json 경로에 파일 생성
// - 기존 파일이 있으면 deepMerge, 없으면 새로 생성
// - patch: { "model": "opusplan", "plansDirectory": "./.claude/plans" }
```

- `gemini-settings.ts`의 `deepMerge` 유틸을 재사용 (별도 추출 or 복사)
- 프롬프트 없이 자동 설치 (Gemini처럼 confirm 불필요 — 요청 사항에 프롬프트 언급 없음)

**수정 파일**: `apps/cli/src/commands/init.ts`

- 단계 4.5 근처에 claude-code 선택 시 `installClaudeSettings(basePath)` 호출 추가
- `allInstalledFiles`에 `.claude/settings.local.json` push

### 2. Codex Plan Snapshot 교체

**수정 파일**: `apps/cli/src/core/install-plan.ts`

기존 `CODEX_PLAN_SECTION` 상수를 교체:

```typescript
const CODEX_PLAN_SECTION =
  '\n\n---\n\n## Plan Snapshot\n\n' +
  'Before implementation, save the latest `<proposed_plan>` to `.codex/plans/YYYYMMDD_<topic>.md` (`<topic>` = kebab-case title, fallback `task`).\n' +
  'Ensure `.codex/plans` exists; if the filename exists, append `-v2`, `-v3`, ...\n' +
  'Do not start any mutating implementation step until this file is written.';
```

- 기존과 동일하게 rootContent에 append되는 방식 유지
- 상수 이름은 그대로 `CODEX_PLAN_SECTION` 유지 (외부 참조 없음)

## 상세 구현

### `apps/cli/src/lib/claude-settings.ts` (신규)

```
- deepMerge: gemini-settings.ts에서 동일 함수 복사 (Rule of Three 전이라 추출 보류)
- installClaudeSettings(basePath: string): void
  - settingsPath = join(basePath, '.claude', 'settings.local.json')
  - 기존 파일 있으면 JSON.parse → deepMerge, 없으면 빈 객체에서 시작
  - patch = { model: 'opusplan', plansDirectory: './.claude/plans' }
  - mkdirSync + writeFileSync
```

### `apps/cli/src/commands/init.ts` 수정

라인 25 근처에 import 추가:

```typescript
import { installClaudeSettings } from '../lib/claude-settings.js';
```

라인 250 근처 (geminiSettingValues 처리 바로 아래)에 추가:

```typescript
if ((selectedTools as ToolId[]).includes('claude-code')) {
  installClaudeSettings(basePath);
  allInstalledFiles.push('.claude/settings.local.json');
}
```

### `apps/cli/src/core/install-plan.ts` 수정

라인 8-9의 `CODEX_PLAN_SECTION` 상수 내용만 교체.

## 수정 파일 목록

| 파일                                  | 작업                           |
| ------------------------------------- | ------------------------------ |
| `apps/cli/src/lib/claude-settings.ts` | 신규 생성                      |
| `apps/cli/src/commands/init.ts`       | import + 설치 호출 추가        |
| `apps/cli/src/core/install-plan.ts`   | `CODEX_PLAN_SECTION` 내용 교체 |

## 검증

1. `pnpm build` — 타입 에러 없이 빌드 성공 확인
2. `pnpm test` — 기존 테스트 통과 확인 (install-plan 관련 스냅샷/문자열 비교 테스트가 있을 수 있음)
3. `CODEX_PLAN_SECTION` 변경으로 인한 테스트 실패 시 기대값 업데이트
