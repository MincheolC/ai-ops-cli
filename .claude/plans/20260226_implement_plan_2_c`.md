# Phase 2-C′: 프리셋 전환 및 스키마 개편

## Context

Profile 개념을 폐기하고 프리셋 기반으로 전환하는 피봇 작업. `docs/tui-flow-ai-init-plan.md` 설계를 기반으로 스키마를 개편하되, `presets.yaml`의 Rule ID가 실제 `data/rules/` 파일명과 불일치하는 문제를 함께 수정한다.

MVP 전략: hook/skill/command는 후순위로 미루고, Rule 설치 TUI를 먼저 구현·배포하는 방향. 따라서 Manifest 스키마에서 `categories` 필드는 MVP에서는 불필요하므로 제외한다.

---

## Step 1. `presets.yaml` Rule ID 수정

**파일:** `packages/compiler/data/presets.yaml`

현재 참조와 실제 파일의 매핑:

| 현재 (잘못됨)       | 실제 파일명                                                    |
| ------------------- | -------------------------------------------------------------- |
| `general`           | `role-persona`, `communication`, `code-philosophy`             |
| `coding-convention` | `naming-convention`                                            |
| `react-ui`          | `react-typescript`, `shadcn-ui`                                |
| `tech-stack`        | 프리셋별 libs 파일 (`libs-frontend-web`, `libs-backend-ts` 등) |

수정 결과:

```yaml
frontend-web:
  description: '웹 프론트엔드 프로젝트를 위한 프리셋'
  rules:
    - role-persona
    - communication
    - code-philosophy
    - naming-convention
    - engineering-standards
    - typescript
    - react-typescript
    - shadcn-ui
    - nextjs
    - libs-frontend-web

frontend-app:
  description: '앱 프론트엔드 프로젝트를 위한 프리셋'
  rules:
    - role-persona
    - communication
    - code-philosophy
    - naming-convention
    - engineering-standards
    - flutter
    - libs-frontend-app

backend-ts:
  description: 'TypeScript 백엔드 프로젝트를 위한 프리셋'
  rules:
    - role-persona
    - communication
    - code-philosophy
    - naming-convention
    - engineering-standards
    - typescript
    - nestjs
    - prisma-postgresql
    - graphql
    - nestjs-graphql
    - libs-backend-ts

backend-python:
  description: 'Python 백엔드 프로젝트를 위한 프리셋'
  rules:
    - role-persona
    - communication
    - code-philosophy
    - naming-convention
    - engineering-standards
    - python
    - fastapi
    - sqlalchemy
    - libs-backend-python
```

## Step 2. Preset 스키마 생성 (Profile 교체)

**삭제:** `packages/compiler/src/schemas/profile.schema.ts`
**생성:** `packages/compiler/src/schemas/preset.schema.ts`

```typescript
export const PresetSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/)
      .min(1),
    description: z.string().min(1),
    rules: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type Preset = z.infer<typeof PresetSchema>;
```

## Step 3. Manifest 스키마 업데이트

**파일:** `packages/compiler/src/schemas/manifest.schema.ts`

변경 사항:

- `profile` → 제거
- `include_rules` → `installed_rules`로 rename
- 추가 필드: `tools` (선택한 AI 도구), `preset` (optional, 선택한 프리셋 id)
- MVP에서 `categories`는 제외 (rules만 먼저)

```typescript
export const ManifestSchema = z
  .object({
    tools: z.array(z.string().min(1)).min(1),
    scope: z.enum(['project', 'global']),
    preset: z.string().min(1).optional(),
    installed_rules: z.array(z.string().min(1)),
    sourceHash: z.string().regex(/^[a-f0-9]{6}$/, 'sourceHash must be 6 lowercase hex chars'),
    generatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
```

## Step 4. Barrel export 업데이트

**파일:** `packages/compiler/src/schemas/index.ts`

```typescript
export * from './rule.schema.js';
export * from './preset.schema.js';
export * from './manifest.schema.js';
```

## Step 5. 테스트 코드 수정

### 5-a. `profile.schema.test.ts` 삭제 → `preset.schema.test.ts` 생성

- valid: 전체 필드, kebab-case id
- invalid: 빈 rules, 잘못된 id 패턴, 빈 description, unknown 필드

### 5-b. `manifest.schema.test.ts` 업데이트

- `profile` → `tools`로 변경
- `include_rules` → `installed_rules`로 변경
- `preset` optional 필드 테스트 추가
- 기존 sourceHash/datetime/scope 테스트는 유지

## Step 6. `rule-data.test.ts`에서 presets.yaml 검증 추가

`presets.yaml`을 로딩하여 모든 프리셋의 `rules` 배열 내 ID가 `data/rules/` 디렉토리에 실제 존재하는 파일과 일치하는지 검증하는 테스트 추가.

---

## 수정 대상 파일 요약

| 파일                                                              | 작업              |
| ----------------------------------------------------------------- | ----------------- |
| `packages/compiler/data/presets.yaml`                             | Rule ID 수정      |
| `packages/compiler/src/schemas/profile.schema.ts`                 | 삭제              |
| `packages/compiler/src/schemas/preset.schema.ts`                  | 신규 생성         |
| `packages/compiler/src/schemas/manifest.schema.ts`                | 필드 변경         |
| `packages/compiler/src/schemas/index.ts`                          | export 변경       |
| `packages/compiler/src/schemas/__tests__/profile.schema.test.ts`  | 삭제              |
| `packages/compiler/src/schemas/__tests__/preset.schema.test.ts`   | 신규 생성         |
| `packages/compiler/src/schemas/__tests__/manifest.schema.test.ts` | 테스트 업데이트   |
| `packages/compiler/src/schemas/__tests__/rule-data.test.ts`       | presets 검증 추가 |

## Verification

```bash
npm run test -- packages/compiler/src/schemas
```

모든 스키마 테스트 통과 확인. 특히:

- Preset 스키마 valid/invalid 케이스
- Manifest 새 필드 구조 검증
- presets.yaml의 모든 rule ID가 실제 YAML 파일과 일치
