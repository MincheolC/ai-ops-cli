import * as p from '@clack/prompts';
import type { ToolId } from '@/core/index.js';
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
  TOOL_OUTPUT_MAP,
} from '@/core/index.js';
import type { FileAction } from '@/core/index.js';
import { join } from 'node:path';
import { resolveBasePath, resolveRulesDir } from '../lib/paths.js';
import { installFiles } from '../lib/install.js';

export const updateCommand = async (opts: { force: boolean }): Promise<void> => {
  const basePath = resolveBasePath();
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
  const allInstalledFiles: string[] = [];
  const allAppended: string[] = [];

  if (manifest.workspaces) {
    // 모노레포: workspaces 기반 재설치
    const workspaceEntries = Object.entries(manifest.workspaces);

    for (const toolIdStr of manifest.tools) {
      const toolId = toolIdStr as ToolId;

      if (toolId === 'claude-code') {
        const allInstalledRuleSet = new Set(manifest.installed_rules);
        const rulesToInstall = allRules.filter((r) => allInstalledRuleSet.has(r.id));
        const workspaceMappings = Object.entries(manifest.workspaces!).map(([path, entry]) => ({
          path,
          ruleIds: entry.rules,
        }));
        const renderResult = renderForTool('claude-code', rulesToInstall, workspaceMappings);
        const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
        const r = installFiles(basePath, actions, meta);
        allInstalledFiles.push(...r.written);
        allAppended.push(...r.appended);
      } else {
        // codex/gemini: global → 루트, domain → 워크스페이스별
        const config = TOOL_OUTPUT_MAP[toolId];

        const allInstalledRuleSet = new Set(manifest.installed_rules);
        const allRulesToInstall = allRules.filter((r) => allInstalledRuleSet.has(r.id));
        const { global } = partitionRules(allRulesToInstall);

        if (global.length > 0) {
          const rootAction: FileAction = {
            relativePath: join(config.dir, config.rootFileName),
            content: wrapWithHeader(renderRulesToMarkdown(global), meta),
          };
          const r = installFiles(basePath, [rootAction], meta);
          allInstalledFiles.push(...r.written);
          allAppended.push(...r.appended);
        }

        for (const [ws, entry] of workspaceEntries) {
          const wsRuleSet = new Set(entry.rules);
          const wsRules = allRules.filter((r) => wsRuleSet.has(r.id));
          const { domain } = partitionRules(wsRules);
          if (domain.length === 0) continue;

          const domainAction: FileAction = {
            relativePath: join(ws, config.domainFileName),
            content: wrapWithHeader(renderRulesToMarkdown(domain), meta),
          };
          const r = installFiles(basePath, [domainAction], meta);
          allInstalledFiles.push(...r.written);
          allAppended.push(...r.appended);
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
      const r = installFiles(basePath, actions, meta);
      allInstalledFiles.push(...r.written);
      allAppended.push(...r.appended);
    }
  }

  const newManifest = buildManifest({
    tools: manifest.tools,
    scope: manifest.scope,
    preset: manifest.preset,
    workspaces: manifest.workspaces,
    installedRules: manifest.installed_rules,
    installedFiles: allInstalledFiles.length > 0 ? allInstalledFiles : manifest.installed_files,
    appendedFiles: allAppended.length > 0 ? allAppended : manifest.appended_files,
    sourceHash,
  });
  writeManifest(manifestPath, newManifest);

  s.stop('규칙 갱신 완료');
  p.outro('ai-ops update 완료');
};
