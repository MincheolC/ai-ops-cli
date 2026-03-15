# Refactor: codex/gemini 모노레포 설치를 buildInstallPlan으로 통합

## Context

`installHierarchicalMonorepo`가 `buildInstallPlan`을 우회하고 직접 `FileAction`을 구성하면서:

1. `CODEX_PLAN_BODY` 누락 버그 발생 (이전 플랜에서 핫픽스 완료)
2. root 파일 생성 로직이 `buildInstallPlan`과 `installHierarchicalMonorepo` 두 곳에 중복

**근본 원인**: claude-code는 `renderForTool`이 `workspaceMappings`를 인식하여 monorepo에서도 `buildInstallPlan`을 사용하지만, codex/gemini의 `renderForTool` 분기는 `workspaceMappings`를 무시.

**목표**: codex/gemini도 claude-code와 동일하게 `renderForTool` → `buildInstallPlan` 파이프라인을 모노레포에서도 사용. `installHierarchicalMonorepo` 제거.

## Changes

### 1. `apps/cli/src/core/renderer.ts` — 타입 + renderForTool 확장

**타입 변경**: `domainContent: string` → `domainFiles: { workspacePath: string; content: string }[]`

```ts
type CodexRenderResult = {
  tool: 'codex';
  rootContent: string;
  domainFiles: { workspacePath: string; content: string }[];
};

type GeminiRenderResult = {
  tool: 'gemini';
  rootContent: string;
  domainFiles: { workspacePath: string; content: string }[];
};
```

**renderForTool codex/gemini 분기 확장** (159-168행):

- `workspaceMappings` 없음 (single-repo): `domainFiles: [{ workspacePath: '.', content: domainMarkdown }]` (domainMarkdown이 비어있으면 빈 배열)
- `workspaceMappings` 있음 (monorepo): workspace별로 domain 룰 필터 → `domainFiles` 배열 생성

### 2. `apps/cli/src/core/install-plan.ts` — buildInstallPlan 수정

**codex 분기** (33-55행): `domainFiles` 순회하며 workspace별 domain FileAction 생성

```ts
// root: rootContent + CODEX_PLAN_BODY (기존과 동일)
// domain: domainFiles.map(df => ({
//   relativePath: join(df.workspacePath, config.domainFileName),
//   content: wrapWithSection(df.content, meta),
// }))
```

- `CODEX_PLAN_BODY` export 유지

**gemini 분기** (57-76행): 동일 패턴으로 `domainFiles` 순회

### 3. `apps/cli/src/commands/init.ts` — installHierarchicalMonorepo 제거

**installHierarchicalMonorepo 함수 삭제** (101-138행)

**monorepo 분기 (242-251행)** 통합:

```ts
// 기존: toolId === 'claude-code'만 buildInstallPlan 사용
// 변경: 모든 toolId에서 동일 파이프라인
const allRules = deduplicateRules(mappings.flatMap((m) => m.finalRules));
const workspaceMappings: WorkspaceMapping[] = mappings.map((m) => ({
  path: m.workspace,
  ruleIds: m.finalRules.map((r) => r.id),
}));
const renderResult = renderForTool(toolId, allRules, workspaceMappings);
const actions = buildInstallPlan({ toolId, renderResult, meta });
const r = installFiles(basePath, actions, meta);
```

`installClaudeCodeMonorepo`도 이 통합 로직과 동일하므로 함께 인라인하거나 유지 가능. 최소 변경을 위해 `installClaudeCodeMonorepo`는 유지하고 codex/gemini 분기만 수정.

**CODEX_PLAN_BODY import 제거** (더이상 init.ts에서 직접 사용 안 함)

### 4. `apps/cli/src/core/__tests__/install-plan.test.ts` — 테스트 업데이트

기존 테스트의 `domainContent` → `domainFiles` 타입으로 전환:

- `domainContent: '# Domain'` → `domainFiles: [{ workspacePath: '.', content: '# Domain' }]`
- `domainContent: ''` → `domainFiles: []`
- 모노레포 케이스 추가: `domainFiles`에 여러 workspace 엔트리

## Files to modify

| File                                               | Action                                      |
| -------------------------------------------------- | ------------------------------------------- |
| `apps/cli/src/core/renderer.ts`                    | 타입 변경 + renderForTool 확장              |
| `apps/cli/src/core/install-plan.ts`                | buildInstallPlan domainFiles 순회           |
| `apps/cli/src/commands/init.ts`                    | installHierarchicalMonorepo 삭제, 통합 흐름 |
| `apps/cli/src/core/__tests__/install-plan.test.ts` | 타입 변경 반영 + 모노레포 케이스            |

## Verification

```bash
npm run build
npm test
```

수동 테스트:

1. 단일 프로젝트: `ai-ops init` → codex → root AGENTS.md에 Plan Snapshot 존재
2. 모노레포: `ai-ops init` → codex → root AGENTS.md에 Plan Snapshot 존재, workspace별 AGENTS.override.md 생성
