import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type {
  InstalledIntegration,
  InstalledSkill,
  IntegrationComponent,
  IntegrationId,
  Skill,
} from '@/core/schemas/index.js';
import { INTEGRATION_COMPONENT_TYPE, SKILL_TOOL } from '@/core/schemas/index.js';
import { loadAllSkills } from '@/shared/catalog-loader.js';
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
import { resolveSkillsDir } from '../../shared/command-paths.js';
import type { IntegrationDefinition } from './definitions.js';

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

export const hasInstalledCodexSkill = (params: { basePath: string; skillId: string }): boolean => {
  const installedSkill = findInstalledSkill(readInstalledSkills(params.basePath), params.skillId);
  return (
    installedSkill?.tools.includes(SKILL_TOOL.CODEX) === true &&
    existsSync(join(params.basePath, '.agents/skills', params.skillId, 'SKILL.md'))
  );
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
  previouslyOwned: boolean;
}): IntegrationComponent => {
  const skill = resolveSkillById(params.skillId);
  const installedSkills = readInstalledSkills(params.basePath);
  const existingInstalledSkill = findInstalledSkill(installedSkills, skill.id);
  const requestedTools = mergeSkillTools({
    existing: existingInstalledSkill?.tools,
    requested: [SKILL_TOOL.CODEX],
  });
  const { packages, installedSkill } = buildSkillInstallPlan({
    skill,
    requestedTools,
  });

  const alreadyCurrent =
    existingInstalledSkill?.sourceHash === installedSkill.sourceHash &&
    existingInstalledSkill.tools.includes(SKILL_TOOL.CODEX) &&
    existsSync(join(params.basePath, '.agents/skills', params.skillId, 'SKILL.md'));

  if (alreadyCurrent) {
    return {
      type: INTEGRATION_COMPONENT_TYPE.SKILL,
      id: params.skillId,
      tools: [SKILL_TOOL.CODEX],
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
    tools: [SKILL_TOOL.CODEX],
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

export const formatComponentStatus = (component: IntegrationComponent): string => {
  const owner = component.owned ? 'owned' : 'pre-existing';
  if (component.type === INTEGRATION_COMPONENT_TYPE.SKILL) {
    return `skill:${component.id} (${owner})`;
  }
  if (component.type === INTEGRATION_COMPONENT_TYPE.CODEX_HOOK) {
    return `codex-hook:${component.id} (${owner})`;
  }
  return `receipt-config:${component.id} (${owner})`;
};
