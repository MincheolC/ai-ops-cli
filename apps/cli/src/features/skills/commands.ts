import * as p from '@clack/prompts';
import { rmSync } from 'node:fs';
import type { InstalledSkill, Skill, ToolId } from '@/core/schemas/index.js';
import { loadAllSkills } from '@/shared/catalog-loader.js';
import { getCliVersion } from '@/shared/source-hash.js';
import { buildSkillInstallPlan } from './renderer.js';
import { readSkillRegistry, resolveCanonicalSkillId, resolveSkillRegistryPath, writeSkillRegistry } from './registry-io.js';
import { resolveSkillsDir, resolveUserBasePath } from '../../shared/command-paths.js';
import {
  findInstalledSkill,
  mergeSkillTools,
  removeInstalledSkill,
  resolveRequestedTools,
  upsertInstalledSkill,
} from './state.js';
import { installSkillPackages, removeDirectories } from './install-files.js';

type SkillCommandOptions = {
  tool?: string[];
};

const loadCompilerInputs = (): {
  allSkills: ReturnType<typeof loadAllSkills>;
  cliVersion: string;
} => {
  return {
    allSkills: loadAllSkills(resolveSkillsDir()),
    cliVersion: getCliVersion(),
  };
};

const resolveSkillById = (skills: readonly Skill[], skillId: string): Skill => {
  const canonicalSkillId = resolveCanonicalSkillId(skillId);
  const skill = skills.find((candidate) => candidate.id === canonicalSkillId);
  if (!skill) {
    throw new Error(`Unknown skill: ${skillId}`);
  }
  return skill;
};

const writeUserSkillState = (params: {
  basePath: string;
  cliVersion: string;
  nextSkill?: InstalledSkill;
  removeSkillId?: string;
}): void => {
  const registryPath = resolveSkillRegistryPath(params.basePath);
  const previous = readSkillRegistry(registryPath);
  const skills = params.removeSkillId
    ? removeInstalledSkill(previous?.skills ?? [], params.removeSkillId)
    : params.nextSkill
      ? upsertInstalledSkill(previous?.skills ?? [], params.nextSkill)
      : (previous?.skills ?? []);

  if (skills.length === 0) {
    rmSync(registryPath, { force: true });
    return;
  }

  writeSkillRegistry(registryPath, {
    skills,
    cliVersion: params.cliVersion,
    generatedAt: new Date().toISOString(),
  });
};

const readInstalledSkills = (basePath: string): InstalledSkill[] => {
  return (readSkillRegistry(resolveSkillRegistryPath(basePath))?.skills ?? []).map((installedSkill) => ({
    ...installedSkill,
    id: resolveCanonicalSkillId(installedSkill.id),
  }));
};

const installSkill = (params: {
  skill: Skill;
  requestedTools: readonly ToolId[];
  basePath: string;
  cliVersion: string;
}): InstalledSkill => {
  const installedSkills = readInstalledSkills(params.basePath);
  const existingInstalledSkill = findInstalledSkill(installedSkills, params.skill.id);
  const nextRequestedTools = mergeSkillTools({
    existing: existingInstalledSkill?.tools,
    requested: params.requestedTools,
  });
  const { packages, installedSkill } = buildSkillInstallPlan({
    skill: params.skill,
    requestedTools: nextRequestedTools,
  });
  installSkillPackages(params.basePath, packages);

  writeUserSkillState({
    basePath: params.basePath,
    cliVersion: params.cliVersion,
    nextSkill: installedSkill,
  });

  return installedSkill;
};

export const skillListCommand = async (): Promise<void> => {
  const basePath = resolveUserBasePath();
  const { allSkills } = loadCompilerInputs();
  const installedSkills = readInstalledSkills(basePath);

  p.intro('ai-ops skill list');
  const sections = [
    { kind: 'reference' as const, title: 'reference skills' },
    { kind: 'task' as const, title: 'task skills' },
  ]
    .map(({ kind, title }) => {
      const lines = allSkills
        .filter((skill) => skill.kind === kind)
        .map((skill) => {
          const installed = findInstalledSkill(installedSkills, skill.id);
          const suffix = installed ? `installed for ${installed.tools.join(', ')}` : 'not installed';
          return `- ${skill.id} - ${suffix}`;
        });

      if (lines.length === 0) {
        return null;
      }

      return `${title}\n${lines.join('\n')}`;
    })
    .filter((section): section is string => section !== null);

  p.log.info(sections.join('\n\n'));
  p.outro('ai-ops skill list 완료');
};

export const skillInstallCommand = async (skillId: string, opts: SkillCommandOptions): Promise<void> => {
  const basePath = resolveUserBasePath();
  const { allSkills, cliVersion } = loadCompilerInputs();
  const skill = resolveSkillById(allSkills, skillId);
  const requestedTools = resolveRequestedTools({ requested: opts.tool, supported: skill.supported_tools });

  p.intro(`ai-ops skill install ${skillId}`);
  const installedSkill = installSkill({
    skill,
    requestedTools,
    basePath,
    cliVersion,
  });

  p.log.success(`설치 완료: ${installedSkill.id} (${installedSkill.installed_paths.join(', ')})`);
  p.outro('ai-ops skill install 완료');
};

export const skillDiffCommand = async (skillId: string | undefined): Promise<void> => {
  const basePath = resolveUserBasePath();
  const { allSkills } = loadCompilerInputs();
  const installedSkills = readInstalledSkills(basePath);
  const targets = skillId ? installedSkills.filter((skill) => skill.id === skillId) : installedSkills;

  p.intro('ai-ops skill diff');

  if (targets.length === 0) {
    p.log.warn('비교할 설치된 skill이 없습니다.');
    p.outro('ai-ops skill diff 완료');
    return;
  }

  const lines = targets.map((installedSkill) => {
    const skill = resolveSkillById(allSkills, installedSkill.id);
    const { installedSkill: next } = buildSkillInstallPlan({
      skill,
      requestedTools: installedSkill.tools,
    });
    const changed = next.sourceHash !== installedSkill.sourceHash;
    return `- ${installedSkill.id}: ${changed ? 'changed' : 'up-to-date'} (${installedSkill.sourceHash} -> ${next.sourceHash})`;
  });

  p.log.info(lines.join('\n'));
  p.outro('ai-ops skill diff 완료');
};

export const skillUpdateCommand = async (skillId: string | undefined): Promise<void> => {
  const basePath = resolveUserBasePath();
  const { allSkills, cliVersion } = loadCompilerInputs();
  const installedSkills = readInstalledSkills(basePath);
  const targets = skillId ? installedSkills.filter((skill) => skill.id === skillId) : installedSkills;

  p.intro('ai-ops skill update');

  if (targets.length === 0) {
    p.log.warn('갱신할 설치된 skill이 없습니다.');
    p.outro('ai-ops skill update 완료');
    return;
  }

  const nextInstalledSkills = targets.map((installedSkill) => {
    const skill = resolveSkillById(allSkills, installedSkill.id);
    const { packages, installedSkill: next } = buildSkillInstallPlan({
      skill,
      requestedTools: installedSkill.tools,
    });
    installSkillPackages(basePath, packages);
    return next;
  });

  const registryPath = resolveSkillRegistryPath(basePath);
  const previous = readSkillRegistry(registryPath);
  const nextSkillIds = new Set(nextInstalledSkills.map((skill) => skill.id));
  const untouched = (previous?.skills ?? []).filter(
    (installedSkill) => !nextSkillIds.has(resolveCanonicalSkillId(installedSkill.id)),
  );
  writeSkillRegistry(registryPath, {
    skills: [...untouched, ...nextInstalledSkills],
    cliVersion,
    generatedAt: new Date().toISOString(),
  });

  p.log.success(`갱신 완료: ${nextInstalledSkills.map((skill) => skill.id).join(', ')}`);
  p.outro('ai-ops skill update 완료');
};

export const skillUninstallCommand = async (skillId: string): Promise<void> => {
  const basePath = resolveUserBasePath();
  const { cliVersion } = loadCompilerInputs();
  const installedSkills = readInstalledSkills(basePath);
  const installedSkill = findInstalledSkill(installedSkills, skillId);

  p.intro(`ai-ops skill uninstall ${skillId}`);

  if (!installedSkill) {
    p.log.warn('설치된 skill을 찾지 못했습니다.');
    p.outro('ai-ops skill uninstall 완료');
    return;
  }

  const removed = removeDirectories(basePath, installedSkill.installed_paths);

  writeUserSkillState({
    basePath,
    cliVersion,
    removeSkillId: skillId,
  });

  p.log.success(`제거 완료: ${removed.join(', ')}`);
  p.outro('ai-ops skill uninstall 완료');
};
