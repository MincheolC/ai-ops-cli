import * as p from '@clack/prompts';
import type { ToolId } from '@/core/index.js';
import {
  readManifest,
  resolveManifestPath,
  loadAllRules,
  loadAllSkills,
  renderForTool,
  buildInstallPlan,
  buildSkillInstallPlan,
  buildManifest,
  writeManifest,
  computeSourceHash,
  computeDiff,
  getCliVersion,
} from '@/core/index.js';
import { resolveBasePath, resolveCompilerDataDir, resolveRulesDir, resolveSkillsDir } from '../lib/paths.js';
import { installFiles } from '../lib/install.js';
import { installSkillPackages } from '../lib/skill-install.js';
import { installClaudeSettings } from '../lib/claude-settings.js';
import { installGeminiSettings } from '../lib/gemini-settings.js';
import { installPrettierIgnore } from '../lib/prettier-ignore.js';

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
  const skillsDir = resolveSkillsDir();
  const sourceHash = computeSourceHash(resolveCompilerDataDir());
  const cliVersion = getCliVersion();

  const diffResult = computeDiff({
    previous: manifest,
    currentRules: manifest.installed_rules,
    currentSourceHash: sourceHash,
    currentCliVersion: cliVersion,
  });

  if (diffResult.status === 'up-to-date' && !opts.force) {
    p.log.info('변경 사항이 없습니다.');
    p.outro('ai-ops update 완료');
    return;
  }

  const s = p.spinner();
  s.start('규칙 갱신 중...');

  const allRules = loadAllRules(rulesDir);
  const allSkills = loadAllSkills(skillsDir);
  const meta = { sourceHash, generatedAt: new Date().toISOString() };
  const allInstalledFiles: string[] = [];
  const allAppended: string[] = [];
  const installedSkills = (manifest.installed_skills ?? []).map((entry) => {
    const skill = allSkills.find((candidate) => candidate.id === entry.id);
    if (!skill) {
      throw new Error(`Skill not found during update: ${entry.id}`);
    }
    const { packages, installedSkill } = buildSkillInstallPlan({
      skill,
      allRules,
      requestedTools: entry.tools as ToolId[],
      scope: 'project',
      sourceRuleIds: entry.source_rules,
    });
    installSkillPackages(basePath, packages);
    return installedSkill;
  });

  if (manifest.workspaces) {
    // 모노레포: workspaces 기반 재설치
    const workspaceEntries = Object.entries(manifest.workspaces);

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

  if (manifest.settings?.claude) {
    installClaudeSettings(basePath, manifest.settings.claude);
  }

  if (manifest.settings?.gemini) {
    installGeminiSettings(basePath, manifest.settings.gemini);
  }

  if (manifest.settings?.prettierignore) {
    installPrettierIgnore(basePath);
  }

  const newManifest = buildManifest({
    tools: manifest.tools,
    scope: manifest.scope,
    preset: manifest.preset,
    workspaces: manifest.workspaces,
    installedRules: manifest.installed_rules,
    installedFiles: allInstalledFiles.length > 0 ? allInstalledFiles : manifest.installed_files,
    installedSkills,
    appendedFiles: allAppended.length > 0 ? allAppended : manifest.appended_files,
    settings: manifest.settings
      ? {
          claude: manifest.settings.claude,
          gemini: manifest.settings.gemini,
          prettierignore: manifest.settings.prettierignore,
        }
      : undefined,
    cliVersion,
    sourceHash,
  });
  writeManifest(manifestPath, newManifest);

  s.stop('규칙 갱신 완료');
  p.outro('ai-ops update 완료');
};
