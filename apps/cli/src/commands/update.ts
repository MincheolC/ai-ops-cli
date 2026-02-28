import * as p from '@clack/prompts';
import type { ToolId } from '@ai-ops/compiler';
import {
  readManifest,
  resolveManifestPath,
  loadAllRules,
  renderForTool,
  buildInstallPlan,
  buildManifest,
  writeManifest,
  computeSourceHash,
  computeDiff,
  partitionRules,
  renderRulesToMarkdown,
  wrapWithHeader,
} from '@ai-ops/compiler';
import type { FileAction } from '@ai-ops/compiler';
import { join } from 'node:path';
import type { Scope } from '../lib/paths.js';
import { resolveBasePath, resolveRulesDir } from '../lib/paths.js';
import { installFiles } from '../lib/install.js';

export const updateCommand = async (opts: { scope: Scope; force: boolean }): Promise<void> => {
  const basePath = resolveBasePath(opts.scope);
  const manifestPath = resolveManifestPath(basePath);

  p.intro('ai-ops update');

  const manifest = readManifest(manifestPath);
  if (!manifest) {
    p.log.error('manifest가 없습니다. 먼저 ai-ops init을 실행하세요.');
    process.exit(1);
  }

  const rulesDir = resolveRulesDir();
  const sourceHash = computeSourceHash(rulesDir);

  const diffResult = computeDiff({
    previous: manifest,
    currentRules: manifest.installed_rules,
    currentSourceHash: sourceHash,
  });

  if (diffResult.status === 'up-to-date' && !opts.force) {
    p.log.info('변경 사항이 없습니다.');
    p.outro('ai-ops update 완료');
    return;
  }

  const s = p.spinner();
  s.start('규칙 갱신 중...');

  const allRules = loadAllRules(rulesDir);
  const meta = { sourceHash, generatedAt: new Date().toISOString() };

  if (manifest.workspaces) {
    // 모노레포: workspaces 기반 재설치
    const workspaceEntries = Object.entries(manifest.workspaces);

    for (const toolIdStr of manifest.tools) {
      const toolId = toolIdStr as ToolId;

      if (toolId === 'claude-code') {
        const allInstalledRuleSet = new Set(manifest.installed_rules);
        const rulesToInstall = allRules.filter((r) => allInstalledRuleSet.has(r.id));
        const renderResult = renderForTool('claude-code', rulesToInstall);
        const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
        installFiles(basePath, actions);
      } else {
        // codex/gemini: global → 루트, domain → 워크스페이스별
        const rootFileName = toolId === 'codex' ? 'AGENTS.md' : 'GEMINI.md';
        const domainFileName = toolId === 'codex' ? 'AGENTS.override.md' : 'GEMINI.md';

        const allInstalledRuleSet = new Set(manifest.installed_rules);
        const allRulesToInstall = allRules.filter((r) => allInstalledRuleSet.has(r.id));
        const { global } = partitionRules(allRulesToInstall);

        if (global.length > 0) {
          const rootAction: FileAction = {
            relativePath: rootFileName,
            content: wrapWithHeader(renderRulesToMarkdown(global), meta),
          };
          installFiles(basePath, [rootAction]);
        }

        for (const [ws, entry] of workspaceEntries) {
          const wsRuleSet = new Set(entry.rules);
          const wsRules = allRules.filter((r) => wsRuleSet.has(r.id));
          const { domain } = partitionRules(wsRules);
          if (domain.length === 0) continue;

          const domainAction: FileAction = {
            relativePath: join(ws, domainFileName),
            content: wrapWithHeader(renderRulesToMarkdown(domain), meta),
          };
          installFiles(basePath, [domainAction]);
        }
      }
    }
  } else {
    // 단일 프로젝트: installed_rules 기반 재설치
    const installedRuleSet = new Set(manifest.installed_rules);
    const rulesToInstall = allRules.filter((r) => installedRuleSet.has(r.id));

    for (const toolIdStr of manifest.tools) {
      const toolId = toolIdStr as ToolId;
      const renderResult = renderForTool(toolId, rulesToInstall);
      const actions = buildInstallPlan({ toolId, renderResult, meta });
      installFiles(basePath, actions);
    }
  }

  const newManifest = buildManifest({
    tools: manifest.tools,
    scope: manifest.scope,
    preset: manifest.preset,
    workspaces: manifest.workspaces,
    installedRules: manifest.installed_rules,
    sourceHash,
  });
  writeManifest(manifestPath, newManifest);

  s.stop('규칙 갱신 완료');
  p.outro('ai-ops update 완료');
};
