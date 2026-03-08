# Refactor: update 커맨드의 codex/gemini 모노레포도 buildInstallPlan 통합

## Context

`init.ts`에서 `installHierarchicalMonorepo`를 제거하고 모든 도구를 `renderForTool → buildInstallPlan → installFiles` 파이프라인으로 통합했으나, `update.ts`에는 동일한 우회 패턴(83-115행)이 그대로 남아 있음.

- codex/gemini 모노레포 분기에서 직접 `partitionRules` + `wrapWithSection` + `FileAction` 구성
- `CODEX_PLAN_BODY` 누락 (codex 모노레포 update 시 Plan Snapshot 섹션 빠짐)

## Changes

### `apps/cli/src/commands/update.ts`

**모노레포 분기(64-116행)** 통합:

- claude-code만 별도 처리하던 if/else 제거
- 모든 toolId에서 동일한 파이프라인 사용:

```ts
for (const toolIdStr of manifest.tools) {
  const toolId = toolIdStr as ToolId;
  const allInstalledRuleSet = new Set(manifest.installed_rules);
  const rulesToInstall = allRules.filter((r) => allInstalledRuleSet.has(r.id));
  const workspaceMappings = workspaceEntries.map(([path, entry]) => ({
    path,
    ruleIds: entry.rules,
  }));
  const renderResult = renderForTool(toolId, rulesToInstall, workspaceMappings);
  const actions = buildInstallPlan({ toolId, renderResult, meta });
  const r = installFiles(basePath, actions, meta);
  allInstalledFiles.push(...r.written);
  allAppended.push(...r.appended);
}
```

**미사용 import 제거**: `partitionRules`, `renderRulesToMarkdown`, `wrapWithSection`, `TOOL_OUTPUT_MAP`, `join`, `FileAction`

## Files to modify

| File                              | Action                                  |
| --------------------------------- | --------------------------------------- |
| `apps/cli/src/commands/update.ts` | 모노레포 분기 통합 + 미사용 import 정리 |

## Verification

```bash
npm run build
npm test
```
