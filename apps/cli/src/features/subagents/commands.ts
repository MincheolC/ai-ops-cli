import * as p from '@clack/prompts';
import { existsSync, rmSync } from 'node:fs';
import type { InstalledSubagent, Subagent, ToolId } from '@/core/schemas/index.js';
import { loadAllSubagents } from '@/shared/catalog-loader.js';
import { getCliVersion } from '@/shared/source-hash.js';
import { readSubagentManifest, resolveSubagentManifestPath, writeSubagentManifest } from './manifest-io.js';
import { buildSubagentInstallPlan } from './renderer.js';
import { resolveSubagentsDir, resolveUserBasePath } from '../../shared/command-paths.js';
import { installSubagentPackages, removeSubagentFiles } from './install-files.js';
import {
  findInstalledSubagent,
  mergeSubagentTools,
  removeInstalledSubagent,
  resolveInstalledSubagentPaths,
  resolveRequestedSubagentTools,
  upsertInstalledSubagent,
} from './state.js';

type SubagentCommandOptions = {
  tool?: string[];
};

const loadCompilerInputs = (): {
  allSubagents: ReturnType<typeof loadAllSubagents>;
  cliVersion: string;
} => {
  return {
    allSubagents: loadAllSubagents(resolveSubagentsDir()),
    cliVersion: getCliVersion(),
  };
};

const resolveSubagentById = (subagents: readonly Subagent[], subagentId: string): Subagent => {
  const subagent = subagents.find((candidate) => candidate.id === subagentId);
  if (!subagent) {
    throw new Error(`Unknown subagent: ${subagentId}`);
  }
  return subagent;
};

const writeUserSubagentState = (params: {
  basePath: string;
  cliVersion: string;
  nextSubagent?: InstalledSubagent;
  removeSubagentId?: string;
}): void => {
  const manifestPath = resolveSubagentManifestPath(params.basePath);
  const previous = readSubagentManifest(manifestPath);
  const subagents = params.removeSubagentId
    ? removeInstalledSubagent(previous?.subagents ?? [], params.removeSubagentId)
    : params.nextSubagent
      ? upsertInstalledSubagent(previous?.subagents ?? [], params.nextSubagent)
      : (previous?.subagents ?? []);

  if (subagents.length === 0) {
    rmSync(manifestPath, { force: true });
    return;
  }

  writeSubagentManifest(manifestPath, {
    subagents,
    cliVersion: params.cliVersion,
    generatedAt: new Date().toISOString(),
  });
};

const readInstalledSubagents = (basePath: string): InstalledSubagent[] =>
  readSubagentManifest(resolveSubagentManifestPath(basePath))?.subagents ?? [];

const warnMissingSkills = (requiredSkills: ReturnType<typeof buildSubagentInstallPlan>['requiredSkills']): void => {
  const missing = requiredSkills.filter((skill) => !existsSync(skill.path));
  if (missing.length === 0) {
    return;
  }

  p.log.warn(
    [
      '필요한 skill이 아직 설치되지 않았습니다. subagent 설치는 계속 진행합니다.',
      ...missing.map((skill) => `- ${skill.tool}:${skill.skillName} (${skill.path})`),
    ].join('\n'),
  );
};

const installSubagent = (params: {
  subagent: Subagent;
  requestedTools: readonly ToolId[];
  basePath: string;
  cliVersion: string;
}): InstalledSubagent => {
  const installedSubagents = readInstalledSubagents(params.basePath);
  const existingInstalledSubagent = findInstalledSubagent(installedSubagents, params.subagent.id);
  const nextRequestedTools = mergeSubagentTools({
    existing: existingInstalledSubagent?.tools,
    requested: params.requestedTools,
  });
  const { packages, installedSubagent, requiredSkills } = buildSubagentInstallPlan({
    subagent: params.subagent,
    requestedTools: nextRequestedTools,
    userBasePath: params.basePath,
  });
  installSubagentPackages(params.basePath, packages);
  warnMissingSkills(requiredSkills);

  writeUserSubagentState({
    basePath: params.basePath,
    cliVersion: params.cliVersion,
    nextSubagent: installedSubagent,
  });

  return installedSubagent;
};

export const subagentListCommand = async (): Promise<void> => {
  const basePath = resolveUserBasePath();
  const { allSubagents } = loadCompilerInputs();
  const installedSubagents = readInstalledSubagents(basePath);

  p.intro('ai-ops subagent list');
  const lines = allSubagents.map((subagent) => {
    const installed = findInstalledSubagent(installedSubagents, subagent.id);
    const suffix = installed ? `installed for ${installed.tools.join(', ')}` : 'not installed';
    return `- ${subagent.id} - ${suffix}`;
  });

  p.log.info(lines.join('\n'));
  p.outro('ai-ops subagent list 완료');
};

export const subagentInstallCommand = async (subagentId: string, opts: SubagentCommandOptions): Promise<void> => {
  const basePath = resolveUserBasePath();
  const { allSubagents, cliVersion } = loadCompilerInputs();
  const subagent = resolveSubagentById(allSubagents, subagentId);
  const requestedTools = resolveRequestedSubagentTools({ requested: opts.tool, supported: subagent.supported_tools });

  p.intro(`ai-ops subagent install ${subagentId}`);
  const installedSubagent = installSubagent({
    subagent,
    requestedTools,
    basePath,
    cliVersion,
  });

  p.log.success(`설치 완료: ${installedSubagent.id} (${installedSubagent.installed_paths.join(', ')})`);
  p.outro('ai-ops subagent install 완료');
};

export const subagentDiffCommand = async (subagentId: string | undefined): Promise<void> => {
  const basePath = resolveUserBasePath();
  const { allSubagents } = loadCompilerInputs();
  const installedSubagents = readInstalledSubagents(basePath);
  const targets = subagentId
    ? installedSubagents.filter((subagent) => subagent.id === subagentId)
    : installedSubagents;

  p.intro('ai-ops subagent diff');

  if (targets.length === 0) {
    p.log.warn('비교할 설치된 subagent가 없습니다.');
    p.outro('ai-ops subagent diff 완료');
    return;
  }

  const lines = targets.map((installedSubagent) => {
    const subagent = resolveSubagentById(allSubagents, installedSubagent.id);
    const { installedSubagent: next } = buildSubagentInstallPlan({
      subagent,
      requestedTools: installedSubagent.tools,
      userBasePath: basePath,
    });
    const changed = next.sourceHash !== installedSubagent.sourceHash;
    return `- ${installedSubagent.id}: ${changed ? 'changed' : 'up-to-date'} (${installedSubagent.sourceHash} -> ${next.sourceHash})`;
  });

  p.log.info(lines.join('\n'));
  p.outro('ai-ops subagent diff 완료');
};

export const subagentUpdateCommand = async (subagentId: string | undefined): Promise<void> => {
  const basePath = resolveUserBasePath();
  const { allSubagents, cliVersion } = loadCompilerInputs();
  const installedSubagents = readInstalledSubagents(basePath);
  const targets = subagentId
    ? installedSubagents.filter((subagent) => subagent.id === subagentId)
    : installedSubagents;

  p.intro('ai-ops subagent update');

  if (targets.length === 0) {
    p.log.warn('갱신할 설치된 subagent가 없습니다.');
    p.outro('ai-ops subagent update 완료');
    return;
  }

  const nextInstalledSubagents = targets.map((installedSubagent) => {
    const subagent = resolveSubagentById(allSubagents, installedSubagent.id);
    const { packages, installedSubagent: next, requiredSkills } = buildSubagentInstallPlan({
      subagent,
      requestedTools: installedSubagent.tools,
      userBasePath: basePath,
    });
    installSubagentPackages(basePath, packages);
    warnMissingSkills(requiredSkills);
    return next;
  });

  const manifestPath = resolveSubagentManifestPath(basePath);
  const previous = readSubagentManifest(manifestPath);
  const nextSubagentIds = new Set(nextInstalledSubagents.map((subagent) => subagent.id));
  const untouched = (previous?.subagents ?? []).filter((subagent) => !nextSubagentIds.has(subagent.id));
  writeSubagentManifest(manifestPath, {
    subagents: [...untouched, ...nextInstalledSubagents],
    cliVersion,
    generatedAt: new Date().toISOString(),
  });

  p.log.success(`갱신 완료: ${nextInstalledSubagents.map((subagent) => subagent.id).join(', ')}`);
  p.outro('ai-ops subagent update 완료');
};

export const subagentUninstallCommand = async (subagentId: string): Promise<void> => {
  const basePath = resolveUserBasePath();
  const cliVersion = getCliVersion();
  const installedSubagents = readInstalledSubagents(basePath);
  const installedSubagent = findInstalledSubagent(installedSubagents, subagentId);

  p.intro(`ai-ops subagent uninstall ${subagentId}`);

  if (!installedSubagent) {
    p.log.warn('설치된 subagent를 찾지 못했습니다.');
    p.outro('ai-ops subagent uninstall 완료');
    return;
  }

  const removed = removeSubagentFiles(basePath, resolveInstalledSubagentPaths(installedSubagent));

  writeUserSubagentState({
    basePath,
    cliVersion,
    removeSubagentId: subagentId,
  });

  p.log.success(`제거 완료: ${removed.join(', ')}`);
  p.outro('ai-ops subagent uninstall 완료');
};
