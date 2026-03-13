import * as p from '@clack/prompts';
import type { InstalledSkill, Preset, Rule, Skill, ToolId, WorkspaceMapping } from '@/core/index.js';
import {
  loadAllRules,
  loadAllSkills,
  loadPresets,
  resolvePresetRules,
  resolvePresetSkills,
  renderForTool,
  buildInstallPlan,
  buildSkillInstallPlan,
  buildManifest,
  computeSourceHash,
  getCliVersion,
  resolveManifestPath,
  writeManifest,
  readSkillRegistry,
  resolveSkillRegistryPath,
  writeSkillRegistry,
} from '@/core/index.js';
import {
  resolveBasePath,
  resolveCompilerDataDir,
  resolvePresetsPath,
  resolveRulesDir,
  resolveSkillsDir,
  resolveUserBasePath,
} from '../lib/paths.js';
import { listWorkspaceCandidates } from '../lib/workspace.js';
import { installFiles } from '../lib/install.js';
import { installSkillPackages } from '../lib/skill-install.js';
import { promptGeminiSettings, installGeminiSettings } from '../lib/gemini-settings.js';
import { promptClaudeSettings, installClaudeSettings } from '../lib/claude-settings.js';
import { promptPrettierIgnore, installPrettierIgnore } from '../lib/prettier-ignore.js';
import {
  findInstalledSkill,
  mergeSkillTools,
  subtractSkillTools,
  type SkillScope,
  upsertInstalledSkill,
} from '../lib/skill-state.js';

type SelectedSkillTarget = {
  skill: Skill;
  requestedTools: ToolId[];
};

type InstallablePresetSkill = SelectedSkillTarget & {
  globalTools: ToolId[];
};

type GlobalPresetSkill = {
  skill: Skill;
  availableTools: ToolId[];
};

type WorkspacePresetMapping = {
  workspace: string;
  preset: Preset;
  finalRules: Rule[];
  finalSkillTargets: SelectedSkillTarget[];
};

const TOOL_OPTIONS = [
  { value: 'claude-code' as ToolId, label: 'Claude Code' },
  { value: 'codex' as ToolId, label: 'Codex' },
  { value: 'gemini' as ToolId, label: 'Gemini CLI' },
];

const deduplicateRules = (rules: readonly Rule[]): Rule[] => {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    if (seen.has(rule.id)) return false;
    seen.add(rule.id);
    return true;
  });
};

const formatToolList = (toolIds: readonly ToolId[]): string => toolIds.join(', ');

const deduplicateSkillTargets = (targets: readonly SelectedSkillTarget[]): SelectedSkillTarget[] => {
  const merged = new Map<string, SelectedSkillTarget>();

  for (const target of targets) {
    const previous = merged.get(target.skill.id);
    if (!previous) {
      merged.set(target.skill.id, {
        skill: target.skill,
        requestedTools: [...target.requestedTools],
      });
      continue;
    }

    merged.set(target.skill.id, {
      skill: target.skill,
      requestedTools: mergeSkillTools({
        existing: previous.requestedTools,
        requested: target.requestedTools,
      }),
    });
  }

  return [...merged.values()].sort((a, b) => a.skill.id.localeCompare(b.skill.id));
};

const resolveSupportedRequestedTools = (skill: Skill, selectedTools: readonly ToolId[]): ToolId[] =>
  selectedTools.filter((toolId) => skill.supported_tools.includes(toolId));

const partitionPresetSkills = (params: {
  preset: Preset;
  allSkills: readonly Skill[];
  selectedTools: readonly ToolId[];
  globalInstalledSkills: readonly InstalledSkill[];
}): {
  globalSkills: GlobalPresetSkill[];
  installableSkills: InstallablePresetSkill[];
} => {
  const globalSkills: GlobalPresetSkill[] = [];
  const installableSkills: InstallablePresetSkill[] = [];

  for (const skill of resolvePresetSkills(params.preset, params.allSkills)) {
    if (skill.kind !== 'reference') {
      continue;
    }

    const supportedRequestedTools = resolveSupportedRequestedTools(skill, params.selectedTools);
    if (supportedRequestedTools.length === 0) {
      continue;
    }

    const installedGlobalSkill = findInstalledSkill(params.globalInstalledSkills, skill.id);
    const availableTools = installedGlobalSkill
      ? supportedRequestedTools.filter((toolId) => installedGlobalSkill.tools.includes(toolId))
      : [];
    const requestedTools = subtractSkillTools({
      requested: supportedRequestedTools,
      installed: availableTools,
    });

    if (requestedTools.length === 0) {
      globalSkills.push({
        skill,
        availableTools,
      });
      continue;
    }

    installableSkills.push({
      skill,
      requestedTools,
      globalTools: availableTools,
    });
  }

  return {
    globalSkills,
    installableSkills,
  };
};

const selectPresetAndFineTune = async (
  workspaceName: string,
  presets: readonly Preset[],
  allRules: readonly Rule[],
  allSkills: readonly Skill[],
  selectedTools: readonly ToolId[],
  globalInstalledSkills: readonly InstalledSkill[],
): Promise<WorkspacePresetMapping | null> => {
  const preset = await p.select<Preset>({
    message: `[${workspaceName}] 프리셋을 선택하세요`,
    options: presets.map((candidate) => ({
      value: candidate,
      label: candidate.id,
      hint: candidate.description,
    })),
  });
  if (p.isCancel(preset)) return null;

  const finalRules = resolvePresetRules(preset, allRules);
  if (finalRules.length > 0) {
    p.note(finalRules.map((rule) => `  ✓ ${rule.id}`).join('\n'), `[${workspaceName}] core rules (잠금)`);
  }

  const { globalSkills, installableSkills } = partitionPresetSkills({
    preset,
    allSkills,
    selectedTools,
    globalInstalledSkills,
  });

  if (globalSkills.length > 0) {
    const globalLines = globalSkills.map(
      ({ skill, availableTools }) => `  ✓ ${skill.id} (${formatToolList(availableTools)})`,
    );
    p.note(globalLines.join('\n'), `[${workspaceName}] already available globally`);
  }

  if (installableSkills.length === 0) {
    p.note('  새로 설치할 reference skill이 없습니다.', `[${workspaceName}] installable reference skills`);
    return {
      workspace: workspaceName,
      preset,
      finalRules,
      finalSkillTargets: [],
    };
  }

  const selectedSkillIds = await p.multiselect<string>({
    message: `[${workspaceName}] installable reference skills 선택`,
    options: installableSkills.map(({ skill, requestedTools, globalTools }) => ({
      value: skill.id,
      label: skill.id,
      hint:
        globalTools.length > 0
          ? `global: ${formatToolList(globalTools)} / install: ${formatToolList(requestedTools)}`
          : `${skill.description} / install: ${formatToolList(requestedTools)}`,
    })),
    initialValues: installableSkills.map(({ skill }) => skill.id),
    required: false,
  });
  if (p.isCancel(selectedSkillIds)) return null;

  const selectedSkillSet = new Set(selectedSkillIds as string[]);

  return {
    workspace: workspaceName,
    preset,
    finalRules,
    finalSkillTargets: installableSkills
      .filter(({ skill }) => selectedSkillSet.has(skill.id))
      .map(({ skill, requestedTools }) => ({
        skill,
        requestedTools,
      })),
  };
};

const selectInitSkillScope = async (): Promise<SkillScope | null> => {
  const scope = await p.select<SkillScope>({
    message: '선택된 skills를 어디에 설치할까요?',
    options: [
      { value: 'user', label: 'user (global)', hint: '기본값. 여러 프로젝트에서 재사용' },
      { value: 'project', label: 'project', hint: '현재 프로젝트에만 설치' },
    ],
  });
  return p.isCancel(scope) ? null : scope;
};

export const initCommand = async (): Promise<void> => {
  const basePath = resolveBasePath();
  const userBasePath = resolveUserBasePath();
  const rulesDir = resolveRulesDir();
  const skillsDir = resolveSkillsDir();

  p.intro('ai-ops init');

  const selectedTools = await p.multiselect<ToolId>({
    message: 'AI 도구를 선택하세요',
    options: TOOL_OPTIONS,
    required: true,
  });
  if (p.isCancel(selectedTools)) {
    p.cancel('취소됨');
    process.exit(0);
  }

  const isMonorepo = await p.confirm({
    message: '모노레포 프로젝트입니까?',
    initialValue: false,
  });
  if (p.isCancel(isMonorepo)) {
    p.cancel('취소됨');
    process.exit(0);
  }

  const allRules = loadAllRules(rulesDir);
  const allSkills = loadAllSkills(skillsDir);
  const presets = loadPresets(resolvePresetsPath());
  const sourceHash = computeSourceHash(resolveCompilerDataDir());
  const globalInstalledSkills = readSkillRegistry(resolveSkillRegistryPath(userBasePath))?.skills ?? [];

  const mappings: WorkspacePresetMapping[] = [];

  if (!isMonorepo) {
    const mapping = await selectPresetAndFineTune(
      '.',
      presets,
      allRules,
      allSkills,
      selectedTools as ToolId[],
      globalInstalledSkills,
    );
    if (!mapping) {
      p.cancel('취소됨');
      process.exit(0);
    }
    mappings.push(mapping);
  } else {
    const candidates = listWorkspaceCandidates(basePath);
    const selectedWorkspaces = await p.multiselect<string>({
      message: '워크스페이스를 선택하세요',
      options: candidates.map((candidate) => ({ value: candidate, label: candidate })),
      required: true,
    });
    if (p.isCancel(selectedWorkspaces)) {
      p.cancel('취소됨');
      process.exit(0);
    }

    for (const workspace of selectedWorkspaces as string[]) {
      const mapping = await selectPresetAndFineTune(
        workspace,
        presets,
        allRules,
        allSkills,
        selectedTools as ToolId[],
        globalInstalledSkills,
      );
      if (!mapping) {
        p.cancel('취소됨');
        process.exit(0);
      }
      mappings.push(mapping);
    }
  }

  const selectedSkillTargets = deduplicateSkillTargets(mappings.flatMap((mapping) => mapping.finalSkillTargets));
  const skillScope = selectedSkillTargets.length > 0 ? await selectInitSkillScope() : null;
  if (selectedSkillTargets.length > 0 && skillScope === null) {
    p.cancel('취소됨');
    process.exit(0);
  }

  const geminiSettingValues: readonly string[] | null = (selectedTools as ToolId[]).includes('gemini')
    ? await promptGeminiSettings()
    : null;

  const claudeSettingValues: readonly string[] | null = (selectedTools as ToolId[]).includes('claude-code')
    ? await promptClaudeSettings()
    : null;

  const wantPrettierIgnore = await promptPrettierIgnore();

  const s = p.spinner();
  s.start('규칙 설치 중...');

  const meta = { sourceHash, generatedAt: new Date().toISOString() };
  const allInstalledFiles: string[] = [];
  const allAppended: string[] = [];
  const selectedRuleIds = deduplicateRules(mappings.flatMap((mapping) => mapping.finalRules)).map((rule) => rule.id);

  let projectInstalledSkills: InstalledSkill[] = [];

  if (selectedSkillTargets.length > 0 && skillScope !== null) {
    const skillBasePath = skillScope === 'project' ? basePath : userBasePath;
    const installedSkills = selectedSkillTargets.map(({ skill, requestedTools }) => {
      const existingUserSkill = skillScope === 'user' ? findInstalledSkill(globalInstalledSkills, skill.id) : undefined;
      const nextRequestedTools =
        skillScope === 'user'
          ? mergeSkillTools({
              existing: existingUserSkill?.tools,
              requested: requestedTools,
            })
          : requestedTools;
      const { packages, installedSkill } = buildSkillInstallPlan({
        skill,
        requestedTools: nextRequestedTools,
        scope: skillScope,
      });
      installSkillPackages(skillBasePath, packages);
      return installedSkill;
    });

    if (skillScope === 'project') {
      projectInstalledSkills = installedSkills;
    } else {
      const registryPath = resolveSkillRegistryPath(skillBasePath);
      const previous = readSkillRegistry(registryPath);
      const nextSkills = installedSkills.reduce<InstalledSkill[]>(
        (acc, installedSkill) => upsertInstalledSkill(acc, installedSkill),
        previous?.skills ?? [],
      );
      writeSkillRegistry(registryPath, {
        skills: nextSkills,
        cliVersion: getCliVersion(),
        generatedAt: new Date().toISOString(),
      });
    }
  }

  for (const toolId of selectedTools as ToolId[]) {
    if (isMonorepo) {
      const allWorkspaceRules = deduplicateRules(mappings.flatMap((mapping) => mapping.finalRules));
      const workspaceMappings: WorkspaceMapping[] = mappings.map((mapping) => ({
        path: mapping.workspace,
        ruleIds: mapping.finalRules.map((rule) => rule.id),
      }));
      const renderResult = renderForTool(toolId, allWorkspaceRules, workspaceMappings);
      const actions = buildInstallPlan({ toolId, renderResult, meta });
      const result = installFiles(basePath, actions, meta);
      allInstalledFiles.push(...result.written);
      allAppended.push(...result.appended);
    } else {
      const renderResult = renderForTool(toolId, mappings[0].finalRules);
      const actions = buildInstallPlan({ toolId, renderResult, meta });
      const result = installFiles(basePath, actions, meta);
      allInstalledFiles.push(...result.written);
      allAppended.push(...result.appended);
    }
  }

  if (geminiSettingValues && geminiSettingValues.length > 0) {
    installGeminiSettings(basePath, geminiSettingValues);
  }

  if (claudeSettingValues && claudeSettingValues.length > 0) {
    installClaudeSettings(basePath, claudeSettingValues);
  }

  if (wantPrettierIgnore) {
    installPrettierIgnore(basePath);
  }

  s.stop('규칙 설치 완료');

  const workspacesRecord = isMonorepo
    ? Object.fromEntries(
        mappings.map((mapping) => [
          mapping.workspace,
          {
            preset: mapping.preset.id,
            rules: mapping.finalRules.map((rule) => rule.id),
          },
        ]),
      )
    : undefined;

  const manifest = buildManifest({
    tools: selectedTools as string[],
    scope: 'project',
    preset: !isMonorepo ? mappings[0].preset.id : undefined,
    workspaces: workspacesRecord,
    installedRules: selectedRuleIds,
    installedFiles: allInstalledFiles,
    installedSkills: projectInstalledSkills,
    appendedFiles: allAppended,
    settings:
      claudeSettingValues || geminiSettingValues || wantPrettierIgnore
        ? {
            claude: claudeSettingValues ? [...claudeSettingValues] : undefined,
            gemini: geminiSettingValues ? [...geminiSettingValues] : undefined,
            prettierignore: wantPrettierIgnore || undefined,
          }
        : undefined,
    cliVersion: getCliVersion(),
    sourceHash,
  });
  writeManifest(resolveManifestPath(basePath), manifest);

  if (allAppended.length > 0) {
    p.log.info(`기존 파일에 섹션 추가됨 (내용 보존):\n${allAppended.map((file) => `  ${file}`).join('\n')}`);
  }
  p.log.success(`설치된 core rules: ${selectedRuleIds.length}개`);
  p.log.success(`설치된 skills: ${selectedSkillTargets.length}개${skillScope ? ` (${skillScope})` : ''}`);
  if (selectedSkillTargets.length > 0 && skillScope === 'user') {
    p.log.info('global skill은 ai-ops uninstall 대상이 아닙니다. ai-ops skill uninstall으로 제거하세요.');
  }
  p.outro('ai-ops init 완료');
};
