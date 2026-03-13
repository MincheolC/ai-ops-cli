import * as p from '@clack/prompts';
import type { ToolId } from '@/core/index.js';
import {
  readManifest,
  resolveManifestPath,
  loadAllRules,
  loadAllSkills,
  loadPresets,
  renderForTool,
  buildInstallPlan,
  buildSkillInstallPlan,
  buildManifest,
  writeManifest,
  computeSourceHash,
  computeDiff,
  getCliVersion,
  resolveManifestProjectSkills,
  resolveManifestRules,
} from '@/core/index.js';
import { resolveBasePath, resolveCompilerDataDir, resolvePresetsPath, resolveRulesDir, resolveSkillsDir } from '../lib/paths.js';
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
  const presetsPath = resolvePresetsPath();
  const sourceHash = computeSourceHash(resolveCompilerDataDir());
  const cliVersion = getCliVersion();
  const allRules = loadAllRules(rulesDir);
  const allSkills = loadAllSkills(skillsDir);
  const presets = loadPresets(presetsPath);
  const resolvedRules = resolveManifestRules({
    manifest,
    allRules,
    presets,
  });
  const resolvedSkills = resolveManifestProjectSkills({
    manifest,
    allSkills,
  });

  const diffResult = computeDiff({
    previous: manifest,
    currentRules: resolvedRules.installedRules.map((rule) => rule.id),
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

  const meta = { sourceHash, generatedAt: new Date().toISOString() };
  const allInstalledFiles: string[] = [];
  const allAppended: string[] = [];

  const installedSkills = resolvedSkills.map(({ skill, requestedTools }) => {
    const { packages, installedSkill } = buildSkillInstallPlan({
      skill,
      requestedTools,
      scope: 'project',
    });
    installSkillPackages(basePath, packages);
    return installedSkill;
  });

  if (manifest.workspaces) {
    // 모노레포: workspaces 기반 재설치
    const workspaceEntries = Object.entries(resolvedRules.workspaces ?? {});

    for (const toolIdStr of manifest.tools) {
      const toolId = toolIdStr as ToolId;
      const rulesToInstall = resolvedRules.installedRules;
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
    const rulesToInstall = resolvedRules.installedRules;

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
    workspaces: resolvedRules.workspaces,
    installedRules: resolvedRules.installedRules.map((rule) => rule.id),
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
