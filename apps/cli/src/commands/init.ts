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
import { type SkillScope, upsertInstalledSkill } from '../lib/skill-state.js';

type WorkspacePresetMapping = {
  workspace: string;
  preset: Preset;
  finalRules: Rule[];
  finalSkills: Skill[];
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

const deduplicateSkills = (skills: readonly Skill[]): Skill[] => {
  const seen = new Set<string>();
  return skills.filter((skill) => {
    if (seen.has(skill.id)) return false;
    seen.add(skill.id);
    return true;
  });
};

const resolveSelectedSkills = (selectedSkillIds: readonly string[], allSkills: readonly Skill[]): Skill[] =>
  selectedSkillIds.map((skillId) => {
    const skill = allSkills.find((candidate) => candidate.id === skillId);
    if (!skill) {
      throw new Error(`Unknown skill selected during init: ${skillId}`);
    }
    return skill;
  });

const selectPresetAndFineTune = async (
  workspaceName: string,
  presets: readonly Preset[],
  allRules: readonly Rule[],
  allSkills: readonly Skill[],
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

  const recommendedSkills = resolvePresetSkills(preset, allSkills);
  const recommendedSkillIds = recommendedSkills.map((skill) => skill.id);
  const recommendedSkillSet = new Set(recommendedSkillIds);

  const selectedSkillIds = await p.multiselect<string>({
    message: `[${workspaceName}] recommended skills 선택`,
    options: allSkills.map((skill) => ({
      value: skill.id,
      label: skill.id,
      hint: recommendedSkillSet.has(skill.id) ? `recommended - ${skill.description}` : skill.description,
    })),
    initialValues: recommendedSkillIds,
    required: false,
  });
  if (p.isCancel(selectedSkillIds)) return null;

  return {
    workspace: workspaceName,
    preset,
    finalRules,
    finalSkills: resolveSelectedSkills(selectedSkillIds as string[], allSkills),
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

  const mappings: WorkspacePresetMapping[] = [];

  if (!isMonorepo) {
    const mapping = await selectPresetAndFineTune('.', presets, allRules, allSkills);
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
      const mapping = await selectPresetAndFineTune(workspace, presets, allRules, allSkills);
      if (!mapping) {
        p.cancel('취소됨');
        process.exit(0);
      }
      mappings.push(mapping);
    }
  }

  const selectedSkills = deduplicateSkills(mappings.flatMap((mapping) => mapping.finalSkills));
  const skillScope = selectedSkills.length > 0 ? await selectInitSkillScope() : null;
  if (selectedSkills.length > 0 && skillScope === null) {
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

  if (selectedSkills.length > 0 && skillScope !== null) {
    const skillBasePath = skillScope === 'project' ? basePath : userBasePath;
    const installedSkills = selectedSkills.map((skill) => {
      const { packages, installedSkill } = buildSkillInstallPlan({
        skill,
        requestedTools: selectedTools as ToolId[],
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
  p.log.success(`설치된 skills: ${selectedSkills.length}개${skillScope ? ` (${skillScope})` : ''}`);
  if (selectedSkills.length > 0 && skillScope === 'user') {
    p.log.info('global skill은 ai-ops uninstall 대상이 아닙니다. ai-ops skill uninstall으로 제거하세요.');
  }
  p.outro('ai-ops init 완료');
};
