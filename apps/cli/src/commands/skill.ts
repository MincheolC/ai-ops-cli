import * as p from '@clack/prompts';
import { rmSync } from 'node:fs';
import type { InstalledSkill, Skill, ToolId } from '@/core/index.js';
import {
  loadAllSkills,
  buildSkillInstallPlan,
  resolveManifestPath,
  readManifest,
  writeManifest,
  buildManifest,
  computeSourceHash,
  getCliVersion,
  readSkillRegistry,
  resolveSkillRegistryPath,
  writeSkillRegistry,
} from '@/core/index.js';
import { resolveBasePath, resolveCompilerDataDir, resolveSkillsDir, resolveUserBasePath } from '../lib/paths.js';
import {
  findInstalledSkill,
  removeInstalledSkill,
  resolveRequestedTools,
  resolveSkillScope,
  upsertInstalledSkill,
} from '../lib/skill-state.js';
import { installSkillPackages, removeDirectories } from '../lib/skill-install.js';

type SkillCommandOptions = {
  global?: boolean;
  project?: boolean;
  scope?: string;
  tool?: string[];
};

const resolveScopeContext = (opts: SkillCommandOptions): {
  scope: InstalledSkill['scope'];
  basePath: string;
} => {
  const scope = resolveSkillScope(opts);
  return {
    scope,
    basePath: scope === 'project' ? resolveBasePath() : resolveUserBasePath(),
  };
};

const loadCompilerInputs = (): {
  allSkills: ReturnType<typeof loadAllSkills>;
  sourceHash: string;
  cliVersion: string;
} => {
  const compilerDataDir = resolveCompilerDataDir();
  return {
    allSkills: loadAllSkills(resolveSkillsDir()),
    sourceHash: computeSourceHash(compilerDataDir),
    cliVersion: getCliVersion(),
  };
};

const resolveSkillById = (skills: readonly Skill[], skillId: string): Skill => {
  const skill = skills.find((candidate) => candidate.id === skillId);
  if (!skill) {
    throw new Error(`Unknown skill: ${skillId}`);
  }
  return skill;
};

const assertScopeAllowed = (skill: Skill, scope: InstalledSkill['scope']): void => {
  if (!skill.install_scopes.includes(scope)) {
    throw new Error(`Skill ${skill.id} does not support ${scope} scope`);
  }
};

const writeProjectSkillState = (params: {
  basePath: string;
  sourceHash: string;
  cliVersion: string;
  nextSkill?: InstalledSkill;
  removeSkillId?: string;
}): void => {
  const manifestPath = resolveManifestPath(params.basePath);
  const previous = readManifest(manifestPath);
  const installedSkills = params.removeSkillId
    ? removeInstalledSkill(previous?.installed_skills ?? [], params.removeSkillId)
    : params.nextSkill
      ? upsertInstalledSkill(previous?.installed_skills ?? [], params.nextSkill)
      : previous?.installed_skills ?? [];

  const nextTools =
    params.nextSkill !== undefined
      ? [...new Set([...(previous?.tools ?? []), ...params.nextSkill.tools])]
      : previous?.tools ?? [];

  const hasProjectState =
    (previous?.installed_rules.length ?? 0) > 0 ||
    (previous?.installed_files?.length ?? 0) > 0 ||
    (previous?.appended_files?.length ?? 0) > 0 ||
    installedSkills.length > 0 ||
    previous?.settings !== undefined;

  if (!hasProjectState) {
    rmSync(manifestPath, { force: true });
    return;
  }

  const manifest = buildManifest({
    tools: nextTools.length > 0 ? nextTools : params.nextSkill?.tools ?? ['codex'],
    scope: 'project',
    preset: previous?.preset,
    workspaces: previous?.workspaces,
    installedRules: previous?.installed_rules ?? [],
    installedFiles: previous?.installed_files,
    installedSkills,
    appendedFiles: previous?.appended_files,
    settings: previous?.settings,
    cliVersion: params.cliVersion,
    sourceHash: params.sourceHash,
  });

  writeManifest(manifestPath, manifest);
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
      : previous?.skills ?? [];

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

const readInstalledSkills = (scope: InstalledSkill['scope'], basePath: string): InstalledSkill[] => {
  if (scope === 'project') {
    return readManifest(resolveManifestPath(basePath))?.installed_skills ?? [];
  }

  return readSkillRegistry(resolveSkillRegistryPath(basePath))?.skills ?? [];
};

const installSkill = (params: {
  skill: Skill;
  requestedTools: readonly ToolId[];
  scope: InstalledSkill['scope'];
  basePath: string;
  cliVersion: string;
  sourceHash: string;
}): InstalledSkill => {
  const { packages, installedSkill } = buildSkillInstallPlan({
    skill: params.skill,
    requestedTools: params.requestedTools,
    scope: params.scope,
  });
  installSkillPackages(params.basePath, packages);

  if (params.scope === 'project') {
    writeProjectSkillState({
      basePath: params.basePath,
      sourceHash: params.sourceHash,
      cliVersion: params.cliVersion,
      nextSkill: installedSkill,
    });
  } else {
    writeUserSkillState({
      basePath: params.basePath,
      cliVersion: params.cliVersion,
      nextSkill: installedSkill,
    });
  }

  return installedSkill;
};

export const skillListCommand = async (opts: SkillCommandOptions): Promise<void> => {
  const { scope, basePath } = resolveScopeContext(opts);
  const { allSkills } = loadCompilerInputs();
  const installedSkills = readInstalledSkills(scope, basePath);

  p.intro(`ai-ops skill list (${scope})`);
  const lines = allSkills.map((skill) => {
    const installed = findInstalledSkill(installedSkills, skill.id);
    const suffix = installed ? `installed for ${installed.tools.join(', ')}` : 'not installed';
    return `- ${skill.id} [${skill.kind}] (${skill.install_scopes.join(', ')}) - ${suffix}`;
  });
  p.log.info(lines.join('\n'));
  p.outro('ai-ops skill list 완료');
};

export const skillInstallCommand = async (skillId: string, opts: SkillCommandOptions): Promise<void> => {
  const { scope, basePath } = resolveScopeContext(opts);
  const { allSkills, sourceHash, cliVersion } = loadCompilerInputs();
  const skill = resolveSkillById(allSkills, skillId);
  assertScopeAllowed(skill, scope);
  const requestedTools = resolveRequestedTools({ requested: opts.tool, supported: skill.supported_tools });

  p.intro(`ai-ops skill install ${skillId}`);
  const installedSkill = installSkill({
    skill,
    requestedTools,
    scope,
    basePath,
    cliVersion,
    sourceHash,
  });

  p.log.success(`설치 완료: ${installedSkill.id} (${installedSkill.installed_paths.join(', ')})`);
  p.outro('ai-ops skill install 완료');
};

export const skillDiffCommand = async (skillId: string | undefined, opts: SkillCommandOptions): Promise<void> => {
  const { scope, basePath } = resolveScopeContext(opts);
  const { allSkills } = loadCompilerInputs();
  const installedSkills = readInstalledSkills(scope, basePath);
  const targets = skillId ? installedSkills.filter((skill) => skill.id === skillId) : installedSkills;

  p.intro(`ai-ops skill diff (${scope})`);

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
      scope,
    });
    const changed = next.sourceHash !== installedSkill.sourceHash;
    return `- ${installedSkill.id}: ${changed ? 'changed' : 'up-to-date'} (${installedSkill.sourceHash} -> ${next.sourceHash})`;
  });

  p.log.info(lines.join('\n'));
  p.outro('ai-ops skill diff 완료');
};

export const skillUpdateCommand = async (skillId: string | undefined, opts: SkillCommandOptions): Promise<void> => {
  const { scope, basePath } = resolveScopeContext(opts);
  const { allSkills, sourceHash, cliVersion } = loadCompilerInputs();
  const installedSkills = readInstalledSkills(scope, basePath);
  const targets = skillId ? installedSkills.filter((skill) => skill.id === skillId) : installedSkills;

  p.intro(`ai-ops skill update (${scope})`);

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
      scope,
    });
    installSkillPackages(basePath, packages);
    return next;
  });

  if (scope === 'project') {
    const manifestPath = resolveManifestPath(basePath);
    const previous = readManifest(manifestPath);
    if (!previous) {
      p.log.error('project manifest가 없습니다.');
      process.exit(1);
    }
    const untouched = (previous.installed_skills ?? []).filter(
      (installedSkill) => !nextInstalledSkills.some((next) => next.id === installedSkill.id),
    );
    writeManifest(
      manifestPath,
      buildManifest({
        tools: previous.tools,
        scope: previous.scope,
        preset: previous.preset,
        workspaces: previous.workspaces,
        installedRules: previous.installed_rules,
        installedFiles: previous.installed_files,
        installedSkills: [...untouched, ...nextInstalledSkills],
        appendedFiles: previous.appended_files,
        settings: previous.settings,
        cliVersion,
        sourceHash,
      }),
    );
  } else {
    const registryPath = resolveSkillRegistryPath(basePath);
    const previous = readSkillRegistry(registryPath);
    const untouched = (previous?.skills ?? []).filter(
      (installedSkill) => !nextInstalledSkills.some((next) => next.id === installedSkill.id),
    );
    writeSkillRegistry(registryPath, {
      skills: [...untouched, ...nextInstalledSkills],
      cliVersion,
      generatedAt: new Date().toISOString(),
    });
  }

  p.log.success(`갱신 완료: ${nextInstalledSkills.map((skill) => skill.id).join(', ')}`);
  p.outro('ai-ops skill update 완료');
};

export const skillUninstallCommand = async (skillId: string, opts: SkillCommandOptions): Promise<void> => {
  const { scope, basePath } = resolveScopeContext(opts);
  const { sourceHash, cliVersion } = loadCompilerInputs();
  const installedSkills = readInstalledSkills(scope, basePath);
  const installedSkill = findInstalledSkill(installedSkills, skillId);

  p.intro(`ai-ops skill uninstall ${skillId}`);

  if (!installedSkill) {
    p.log.warn('설치된 skill을 찾지 못했습니다.');
    p.outro('ai-ops skill uninstall 완료');
    return;
  }

  const removed = removeDirectories(basePath, installedSkill.installed_paths);

  if (scope === 'project') {
    writeProjectSkillState({
      basePath,
      sourceHash,
      cliVersion,
      removeSkillId: skillId,
    });
  } else {
    writeUserSkillState({
      basePath,
      cliVersion,
      removeSkillId: skillId,
    });
  }

  p.log.success(`제거 완료: ${removed.join(', ')}`);
  p.outro('ai-ops skill uninstall 완료');
};
