import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type {
  InstalledIntegration,
  InstalledSkill,
  InstalledSubagent,
  IntegrationComponent,
  IntegrationId,
  Skill,
  Subagent,
  ToolId,
} from '@/core/schemas/index.js';
import { INTEGRATION_COMPONENT_TYPE, SKILL_TOOL } from '@/core/schemas/index.js';
import { loadAllSkills, loadAllSubagents } from '@/shared/catalog-loader.js';
import { inspectCodexHook, installCodexHook } from '../codex-hooks/core.js';
import type { CodexHookDefinition } from '../codex-hooks/core.js';
import { installSkillPackages, removeDirectories } from '../skills/install-files.js';
import {
  readSkillRegistry,
  resolveCanonicalSkillId,
  resolveSkillRegistryPath,
  writeSkillRegistry,
} from '../skills/registry-io.js';
import { buildSkillInstallPlan } from '../skills/renderer.js';
import { findInstalledSkill, mergeSkillTools, removeInstalledSkill, upsertInstalledSkill } from '../skills/state.js';
import { installSubagentPackages, removeSubagentFiles } from '../subagents/install-files.js';
import { readSubagentManifest, resolveSubagentManifestPath, writeSubagentManifest } from '../subagents/manifest-io.js';
import { buildSubagentInstallPlan } from '../subagents/renderer.js';
import {
  findInstalledSubagent,
  mergeSubagentTools,
  removeInstalledSubagent,
  resolveInstalledSubagentPaths,
  upsertInstalledSubagent,
} from '../subagents/state.js';
import { resolveSkillsDir, resolveSubagentsDir } from '../../shared/command-paths.js';
import type { IntegrationDefinition } from './definitions.js';

export type ComponentSourceStatus = {
  installed: boolean;
  current: boolean;
  installedSourceHash: string | null;
  catalogSourceHash: string;
  missingPaths: string[];
};

const readInstalledSkills = (basePath: string): InstalledSkill[] =>
  (readSkillRegistry(resolveSkillRegistryPath(basePath))?.skills ?? []).map((installedSkill) => ({
    ...installedSkill,
    id: resolveCanonicalSkillId(installedSkill.id),
  }));

const resolveSkillById = (skillId: string): Skill => {
  const skill = loadAllSkills(resolveSkillsDir()).find((candidate) => candidate.id === skillId);
  if (!skill) {
    throw new Error(`Unknown skill: ${skillId}`);
  }
  return skill;
};

const readInstalledSubagents = (basePath: string): InstalledSubagent[] =>
  readSubagentManifest(resolveSubagentManifestPath(basePath))?.subagents ?? [];

const resolveSubagentById = (subagentId: string): Subagent => {
  const subagent = loadAllSubagents(resolveSubagentsDir()).find((candidate) => candidate.id === subagentId);
  if (!subagent) {
    throw new Error(`Unknown subagent: ${subagentId}`);
  }
  return subagent;
};

const hasRequiredTools = (installedTools: readonly string[] | undefined, requiredTools: readonly ToolId[]): boolean =>
  requiredTools.every((tool) => installedTools?.includes(tool) === true);

const findMissingPaths = (basePath: string, relativePaths: readonly string[]): string[] =>
  relativePaths.filter((relativePath) => !existsSync(join(basePath, relativePath)));

export const hasInstalledCodexSkill = (params: { basePath: string; skillId: string }): boolean => {
  const installedSkill = findInstalledSkill(readInstalledSkills(params.basePath), params.skillId);
  return (
    installedSkill?.tools.includes(SKILL_TOOL.CODEX) === true &&
    existsSync(join(params.basePath, '.agents/skills', params.skillId, 'SKILL.md'))
  );
};

export const inspectSkillComponentSource = (params: {
  basePath: string;
  skillId: string;
  tools: readonly ToolId[];
}): ComponentSourceStatus => {
  const skill = resolveSkillById(params.skillId);
  const installedSkill = findInstalledSkill(readInstalledSkills(params.basePath), skill.id);
  const requestedTools = mergeSkillTools({
    existing: installedSkill?.tools,
    requested: params.tools,
  });
  const { installedSkill: next } = buildSkillInstallPlan({
    skill,
    requestedTools,
  });
  const missingPaths = findMissingPaths(params.basePath, next.installed_paths);
  const installed = Boolean(installedSkill && hasRequiredTools(installedSkill.tools, params.tools));

  return {
    installed,
    current: installed && installedSkill?.sourceHash === next.sourceHash && missingPaths.length === 0,
    installedSourceHash: installedSkill?.sourceHash ?? null,
    catalogSourceHash: next.sourceHash,
    missingPaths,
  };
};

export const inspectSubagentComponentSource = (params: {
  basePath: string;
  subagentId: string;
  tools: readonly ToolId[];
}): ComponentSourceStatus => {
  const subagent = resolveSubagentById(params.subagentId);
  const installedSubagent = findInstalledSubagent(readInstalledSubagents(params.basePath), subagent.id);
  const requestedTools = mergeSubagentTools({
    existing: installedSubagent?.tools,
    requested: params.tools,
  });
  const { installedSubagent: next } = buildSubagentInstallPlan({
    subagent,
    requestedTools,
    userBasePath: params.basePath,
  });
  const missingPaths = findMissingPaths(params.basePath, next.installed_paths);
  const installed = Boolean(installedSubagent && hasRequiredTools(installedSubagent.tools, params.tools));

  return {
    installed,
    current: installed && installedSubagent?.sourceHash === next.sourceHash && missingPaths.length === 0,
    installedSourceHash: installedSubagent?.sourceHash ?? null,
    catalogSourceHash: next.sourceHash,
    missingPaths,
  };
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

export const ensureSkillComponent = (params: {
  basePath: string;
  cliVersion: string;
  skillId: string;
  tools: readonly ToolId[];
  previouslyOwned: boolean;
}): IntegrationComponent => {
  const skill = resolveSkillById(params.skillId);
  const installedSkills = readInstalledSkills(params.basePath);
  const existingInstalledSkill = findInstalledSkill(installedSkills, skill.id);
  const requestedTools = mergeSkillTools({
    existing: existingInstalledSkill?.tools,
    requested: params.tools,
  });
  const { packages, installedSkill } = buildSkillInstallPlan({
    skill,
    requestedTools,
  });
  const missingPaths = findMissingPaths(params.basePath, installedSkill.installed_paths);

  const alreadyCurrent =
    existingInstalledSkill !== undefined &&
    existingInstalledSkill?.sourceHash === installedSkill.sourceHash &&
    hasRequiredTools(existingInstalledSkill.tools, params.tools) &&
    missingPaths.length === 0;

  if (alreadyCurrent) {
    return {
      type: INTEGRATION_COMPONENT_TYPE.SKILL,
      id: params.skillId,
      tools: [...params.tools],
      owned: params.previouslyOwned,
    };
  }

  installSkillPackages(params.basePath, packages);
  writeUserSkillState({
    basePath: params.basePath,
    cliVersion: params.cliVersion,
    nextSkill: installedSkill,
  });

  return {
    type: INTEGRATION_COMPONENT_TYPE.SKILL,
    id: params.skillId,
    tools: [...params.tools],
    owned: true,
  };
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

export const ensureSubagentComponent = (params: {
  basePath: string;
  cliVersion: string;
  subagentId: string;
  tools: readonly ToolId[];
  previouslyOwned: boolean;
}): IntegrationComponent => {
  const subagent = resolveSubagentById(params.subagentId);
  const installedSubagents = readInstalledSubagents(params.basePath);
  const existingInstalledSubagent = findInstalledSubagent(installedSubagents, subagent.id);
  const requestedTools = mergeSubagentTools({
    existing: existingInstalledSubagent?.tools,
    requested: params.tools,
  });
  const { packages, installedSubagent } = buildSubagentInstallPlan({
    subagent,
    requestedTools,
    userBasePath: params.basePath,
  });
  const missingPaths = findMissingPaths(params.basePath, installedSubagent.installed_paths);

  const alreadyCurrent =
    existingInstalledSubagent !== undefined &&
    existingInstalledSubagent?.sourceHash === installedSubagent.sourceHash &&
    hasRequiredTools(existingInstalledSubagent.tools, params.tools) &&
    missingPaths.length === 0;

  if (alreadyCurrent) {
    return {
      type: INTEGRATION_COMPONENT_TYPE.SUBAGENT,
      id: params.subagentId,
      tools: [...params.tools],
      owned: params.previouslyOwned,
    };
  }

  installSubagentPackages(params.basePath, packages);
  writeUserSubagentState({
    basePath: params.basePath,
    cliVersion: params.cliVersion,
    nextSubagent: installedSubagent,
  });

  return {
    type: INTEGRATION_COMPONENT_TYPE.SUBAGENT,
    id: params.subagentId,
    tools: [...params.tools],
    owned: true,
  };
};

export const ensureHookComponent = (params: {
  hooksPath: string;
  hookId: IntegrationId;
  definition: CodexHookDefinition;
  command?: string;
  commandWindows?: string;
  previouslyOwned: boolean;
}): IntegrationComponent => {
  const installedBefore = inspectCodexHook({
    hooksPath: params.hooksPath,
    definition: params.definition,
  }).installed;
  const result = installCodexHook({
    hooksPath: params.hooksPath,
    definition: params.definition,
    command: params.command,
    commandWindows: params.commandWindows,
  });

  return {
    type: INTEGRATION_COMPONENT_TYPE.CODEX_HOOK,
    id: params.hookId,
    command: result.command,
    commandWindows: result.commandWindows ?? undefined,
    owned: params.previouslyOwned || result.changed || !installedBefore,
  };
};

export const buildReceiptConfigComponents = (
  components: readonly IntegrationDefinition['receiptConfigComponents'][number][],
): IntegrationComponent[] =>
  components.map((component) => ({
    type: INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG,
    id: component.id,
    storagePath: component.storage_path,
    owned: false,
  }));

export const componentWasOwned = (params: {
  previous?: InstalledIntegration;
  type: IntegrationComponent['type'];
  id: string;
}): boolean =>
  params.previous?.components.some(
    (component) => component.type === params.type && component.id === params.id && component.owned,
  ) ?? false;

export const buildInstalledIntegration = (params: {
  definition: IntegrationDefinition;
  previous?: InstalledIntegration;
  components: readonly IntegrationComponent[];
}): InstalledIntegration => {
  const now = new Date().toISOString();
  return {
    id: params.definition.id,
    components: [...params.components],
    installedAt: params.previous?.installedAt ?? now,
    updatedAt: now,
  };
};

export const removeOwnedSkill = (params: { basePath: string; cliVersion: string; skillId: string }): string[] => {
  const installedSkill = findInstalledSkill(readInstalledSkills(params.basePath), params.skillId);
  if (!installedSkill) {
    return [];
  }

  const removed = removeDirectories(params.basePath, installedSkill.installed_paths);
  writeUserSkillState({
    basePath: params.basePath,
    cliVersion: params.cliVersion,
    removeSkillId: params.skillId,
  });
  return removed;
};

export const removeOwnedSubagent = (params: { basePath: string; cliVersion: string; subagentId: string }): string[] => {
  const installedSubagent = findInstalledSubagent(readInstalledSubagents(params.basePath), params.subagentId);
  if (!installedSubagent) {
    return [];
  }

  const removed = removeSubagentFiles(params.basePath, resolveInstalledSubagentPaths(installedSubagent));
  writeUserSubagentState({
    basePath: params.basePath,
    cliVersion: params.cliVersion,
    removeSubagentId: params.subagentId,
  });
  return removed;
};

export const formatComponentStatus = (component: IntegrationComponent): string => {
  const owner = component.owned ? 'owned' : 'pre-existing';
  if (component.type === INTEGRATION_COMPONENT_TYPE.SKILL) {
    return `skill:${component.id} (${owner})`;
  }
  if (component.type === INTEGRATION_COMPONENT_TYPE.SUBAGENT) {
    return `subagent:${component.id} (${owner})`;
  }
  if (component.type === INTEGRATION_COMPONENT_TYPE.CODEX_HOOK) {
    return `codex-hook:${component.id} (${owner})`;
  }
  return `receipt-config:${component.id} (${owner})`;
};
