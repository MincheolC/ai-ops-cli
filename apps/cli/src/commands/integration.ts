import * as p from '@clack/prompts';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type {
  InstalledIntegration,
  InstalledSkill,
  IntegrationCatalogComponent,
  IntegrationCatalogEntry,
  IntegrationComponent,
  IntegrationId,
  Skill,
} from '@/core/index.js';
import {
  buildCodexHookCommand,
  buildSkillInstallPlan,
  CONTEXT_PROMOTION_CODEX_HOOK,
  evaluatePcPostToolUseHook,
  findInstalledIntegration,
  getCliVersion,
  getPcHandoffStatus,
  INTEGRATION_COMPONENT_TYPE,
  INTEGRATION_ID,
  inspectCodexHook,
  installCodexHook,
  loadAllIntegrations,
  loadAllSkills,
  PC_CODEX_HOOK,
  readIntegrationManifest,
  readSkillRegistry,
  resolveCodexHooksPath,
  resolveIntegrationManifestPath,
  resolveCanonicalSkillId,
  resolveSkillRegistryPath,
  SKILL_TOOL,
  uninstallCodexHook,
  writeSkillRegistry,
  writeUserIntegrationState,
} from '@/core/index.js';
import type { CodexHookDefinition } from '@/core/index.js';
import { installSkillPackages, removeDirectories } from '../lib/skill-install.js';
import { findInstalledSkill, mergeSkillTools, removeInstalledSkill, upsertInstalledSkill } from '../lib/skill-state.js';
import { resolveBasePath, resolveIntegrationsDir, resolveSkillsDir, resolveUserBasePath } from '../lib/paths.js';

type IntegrationInstallOptions = {
  command?: string;
};

type IntegrationDefinition = IntegrationCatalogEntry & {
  skillComponent: Extract<IntegrationCatalogComponent, { type: typeof INTEGRATION_COMPONENT_TYPE.SKILL }>;
  hookComponent: Extract<IntegrationCatalogComponent, { type: typeof INTEGRATION_COMPONENT_TYPE.CODEX_HOOK }>;
  receiptConfigComponents: Extract<
    IntegrationCatalogComponent,
    { type: typeof INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG }
  >[];
  hookDefinition: CodexHookDefinition;
};

const CODEX_HOOK_DEFINITIONS = [CONTEXT_PROMOTION_CODEX_HOOK, PC_CODEX_HOOK] as const;

const resolveCodexHomePath = (): string => {
  const codexHome = process.env.CODEX_HOME;
  if (codexHome && codexHome.length > 0) {
    return codexHome;
  }
  const home = process.env.HOME;
  if (!home) {
    throw new Error('CODEX_HOME or HOME is required for Codex hook commands');
  }
  return `${home}/.codex`;
};

const resolvePersonalContextRoot = (): string => {
  const home = process.env.HOME;
  if (!home) {
    throw new Error('HOME is required for pc integration commands');
  }
  return `${home}/.personal-project-contexts`;
};

const resolveCodexHookDefinition = (hookId: IntegrationId): CodexHookDefinition => {
  const hookDefinition = CODEX_HOOK_DEFINITIONS.find((definition) => definition.id === hookId);
  if (!hookDefinition) {
    throw new Error(`Unknown Codex hook for integration: ${hookId}`);
  }
  return hookDefinition;
};

const resolveCatalogSkillComponent = (entry: IntegrationCatalogEntry): IntegrationDefinition['skillComponent'] => {
  const component = entry.components.find((candidate) => candidate.type === INTEGRATION_COMPONENT_TYPE.SKILL);
  if (!component || component.type !== INTEGRATION_COMPONENT_TYPE.SKILL) {
    throw new Error(`Integration catalog entry must declare a skill component: ${entry.id}`);
  }
  return component;
};

const resolveCatalogHookComponent = (entry: IntegrationCatalogEntry): IntegrationDefinition['hookComponent'] => {
  const component = entry.components.find((candidate) => candidate.type === INTEGRATION_COMPONENT_TYPE.CODEX_HOOK);
  if (!component || component.type !== INTEGRATION_COMPONENT_TYPE.CODEX_HOOK) {
    throw new Error(`Integration catalog entry must declare a codex-hook component: ${entry.id}`);
  }
  return component;
};

const resolveCatalogReceiptConfigComponents = (
  entry: IntegrationCatalogEntry,
): IntegrationDefinition['receiptConfigComponents'] =>
  entry.components.filter(
    (component): component is IntegrationDefinition['receiptConfigComponents'][number] =>
      component.type === INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG,
  );

const loadIntegrationDefinitions = (): IntegrationDefinition[] =>
  loadAllIntegrations(resolveIntegrationsDir()).map((entry) => {
    const hookComponent = resolveCatalogHookComponent(entry);
    return {
      ...entry,
      skillComponent: resolveCatalogSkillComponent(entry),
      hookComponent,
      receiptConfigComponents: resolveCatalogReceiptConfigComponents(entry),
      hookDefinition: resolveCodexHookDefinition(hookComponent.id),
    };
  });

const parseIntegrationId = (integrationId: string): IntegrationId => {
  const definition = loadIntegrationDefinitions().find((candidate) => candidate.id === integrationId);
  if (!definition) {
    throw new Error(`Unknown integration: ${integrationId}`);
  }
  return definition.id;
};

const resolveIntegrationDefinition = (integrationId: string): IntegrationDefinition => {
  const definition = loadIntegrationDefinitions().find((candidate) => candidate.id === integrationId);
  if (!definition) {
    throw new Error(`Unknown integration: ${integrationId}`);
  }
  return definition;
};

const reportIntegrationError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  p.log.error(message);
  process.exitCode = 1;
};

const readStdin = async (): Promise<string> =>
  new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      raw += chunk;
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });

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

const hasInstalledCodexSkill = (params: { basePath: string; skillId: string }): boolean => {
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

const ensureSkillComponent = (params: {
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

const ensureHookComponent = (params: {
  hooksPath: string;
  hookId: IntegrationId;
  definition: CodexHookDefinition;
  command?: string;
  previouslyOwned: boolean;
}): IntegrationComponent => {
  const command = buildCodexHookCommand({
    definition: params.definition,
    overrideCommand: params.command,
  });
  const installedBefore = inspectCodexHook({
    hooksPath: params.hooksPath,
    definition: params.definition,
  }).installed;
  const result = installCodexHook({
    hooksPath: params.hooksPath,
    definition: params.definition,
    command,
  });

  return {
    type: INTEGRATION_COMPONENT_TYPE.CODEX_HOOK,
    id: params.hookId,
    command,
    owned: params.previouslyOwned || result.changed || !installedBefore,
  };
};

const buildReceiptConfigComponents = (
  components: readonly IntegrationDefinition['receiptConfigComponents'][number][],
): IntegrationComponent[] =>
  components.map((component) => ({
    type: INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG,
    id: component.id,
    storagePath: component.storage_path,
    owned: false,
  }));

const componentWasOwned = (params: {
  previous?: InstalledIntegration;
  type: IntegrationComponent['type'];
  id: string;
}): boolean =>
  params.previous?.components.some(
    (component) => component.type === params.type && component.id === params.id && component.owned,
  ) ?? false;

const buildInstalledIntegration = (params: {
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

const removeOwnedSkill = (params: { basePath: string; cliVersion: string; skillId: string }): string[] => {
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

const formatComponentStatus = (component: IntegrationComponent): string => {
  const owner = component.owned ? 'owned' : 'pre-existing';
  if (component.type === INTEGRATION_COMPONENT_TYPE.SKILL) {
    return `skill:${component.id} (${owner})`;
  }
  if (component.type === INTEGRATION_COMPONENT_TYPE.CODEX_HOOK) {
    return `codex-hook:${component.id} (${owner})`;
  }
  return `receipt-config:${component.id} (${owner})`;
};

export const integrationListCommand = async (): Promise<void> => {
  p.intro('ai-ops integration list');
  try {
    const manifest = readIntegrationManifest(resolveIntegrationManifestPath(resolveUserBasePath()));
    const installed = new Set((manifest?.integrations ?? []).map((integration) => integration.id));
    const lines = loadIntegrationDefinitions().map((definition) => {
      const suffix = installed.has(definition.id) ? 'installed' : 'not installed';
      return `- ${definition.id} - ${suffix} - ${definition.description}`;
    });
    p.log.info(lines.join('\n'));
  } catch (error) {
    reportIntegrationError(error);
  }
  p.outro('ai-ops integration list 완료');
};

export const integrationInstallCommand = async (
  integrationId: string,
  opts: IntegrationInstallOptions = {},
): Promise<void> => {
  p.intro(`ai-ops integration install ${integrationId}`);
  try {
    const definition = resolveIntegrationDefinition(integrationId);
    const basePath = resolveUserBasePath();
    const cliVersion = getCliVersion();
    const manifestPath = resolveIntegrationManifestPath(basePath);
    const previous = findInstalledIntegration(readIntegrationManifest(manifestPath)?.integrations ?? [], definition.id);
    const skillComponent = ensureSkillComponent({
      basePath,
      cliVersion,
      skillId: definition.skillComponent.id,
      previouslyOwned: componentWasOwned({
        previous,
        type: INTEGRATION_COMPONENT_TYPE.SKILL,
        id: definition.skillComponent.id,
      }),
    });
    const hookComponent = ensureHookComponent({
      hooksPath: resolveCodexHooksPath(resolveCodexHomePath()),
      hookId: definition.hookComponent.id,
      definition: definition.hookDefinition,
      command: opts.command,
      previouslyOwned: componentWasOwned({
        previous,
        type: INTEGRATION_COMPONENT_TYPE.CODEX_HOOK,
        id: definition.hookComponent.id,
      }),
    });

    const installedIntegration = buildInstalledIntegration({
      definition,
      previous,
      components: [skillComponent, hookComponent, ...buildReceiptConfigComponents(definition.receiptConfigComponents)],
    });
    writeUserIntegrationState({
      manifestPath,
      cliVersion,
      nextIntegration: installedIntegration,
    });

    p.log.success(`integration 설치 완료: ${definition.id}`);
    p.log.info(installedIntegration.components.map(formatComponentStatus).join('\n'));
  } catch (error) {
    reportIntegrationError(error);
  }
  p.outro('ai-ops integration install 완료');
};

export const integrationStatusCommand = async (integrationId: string): Promise<void> => {
  p.intro(`ai-ops integration status ${integrationId}`);
  try {
    const definition = resolveIntegrationDefinition(integrationId);
    const basePath = resolveUserBasePath();
    const manifest = readIntegrationManifest(resolveIntegrationManifestPath(basePath));
    const installedIntegration = findInstalledIntegration(manifest?.integrations ?? [], definition.id);
    const hookStatus = inspectCodexHook({
      hooksPath: resolveCodexHooksPath(resolveCodexHomePath()),
      definition: definition.hookDefinition,
    });
    const lines = [
      `integration installed: ${installedIntegration ? 'yes' : 'no'}`,
      `skill installed: ${hasInstalledCodexSkill({ basePath, skillId: definition.skillComponent.id }) ? 'yes' : 'no'}`,
      `hook installed: ${hookStatus.installed ? 'yes' : 'no'}`,
      `hooks file: ${hookStatus.hooksPath}`,
    ];

    if (definition.id === INTEGRATION_ID.PC) {
      const pcStatus = getPcHandoffStatus({
        cwd: resolveBasePath(),
        contextRoot: resolvePersonalContextRoot(),
      });
      lines.push(
        `pc context ready: ${pcStatus.ready ? 'yes' : 'no'}`,
        `pc skip reason: ${pcStatus.skipReason ?? 'none'}`,
        `pc workspace: ${pcStatus.workspaceId ?? 'not found'}`,
        `pc active workstream: ${pcStatus.activeWorkstreamId ?? 'not found'}`,
        `pc last confirmed commit: ${pcStatus.lastConfirmedCommitHash ?? 'not found'}`,
      );
    }

    if (installedIntegration) {
      lines.push(`owned components: ${installedIntegration.components.map(formatComponentStatus).join(', ')}`);
    }

    p.log.info(lines.join('\n'));
  } catch (error) {
    reportIntegrationError(error);
  }
  p.outro('ai-ops integration status 완료');
};

export const integrationUninstallCommand = async (integrationId: string): Promise<void> => {
  p.intro(`ai-ops integration uninstall ${integrationId}`);
  try {
    const definition = resolveIntegrationDefinition(integrationId);
    const basePath = resolveUserBasePath();
    const cliVersion = getCliVersion();
    const manifestPath = resolveIntegrationManifestPath(basePath);
    const installedIntegration = findInstalledIntegration(
      readIntegrationManifest(manifestPath)?.integrations ?? [],
      definition.id,
    );

    if (!installedIntegration) {
      p.log.warn('설치된 integration manifest entry를 찾지 못했습니다.');
      p.outro('ai-ops integration uninstall 완료');
      return;
    }

    const removed: string[] = [];
    for (const component of installedIntegration.components) {
      if (!component.owned) {
        continue;
      }
      if (component.type === INTEGRATION_COMPONENT_TYPE.SKILL) {
        removed.push(...removeOwnedSkill({ basePath, cliVersion, skillId: component.id }));
      }
      if (component.type === INTEGRATION_COMPONENT_TYPE.CODEX_HOOK) {
        const result = uninstallCodexHook({
          hooksPath: resolveCodexHooksPath(resolveCodexHomePath()),
          definition: definition.hookDefinition,
        });
        if (result.removed) {
          removed.push(result.hooksPath);
        }
      }
    }

    writeUserIntegrationState({
      manifestPath,
      cliVersion,
      removeIntegrationId: definition.id,
    });
    p.log.success(removed.length > 0 ? `제거 완료: ${removed.join(', ')}` : '제거할 owned component 없음');
  } catch (error) {
    reportIntegrationError(error);
  }
  p.outro('ai-ops integration uninstall 완료');
};

export const integrationPostToolUseHookCommand = async (integrationId: string): Promise<void> => {
  try {
    const id = parseIntegrationId(integrationId);
    const raw = await readStdin();
    const hookInput = raw.trim().length > 0 ? JSON.parse(raw) : {};
    if (id !== INTEGRATION_ID.PC) {
      return;
    }

    const output = evaluatePcPostToolUseHook({
      hookInput,
      contextRoot: resolvePersonalContextRoot(),
    });
    if (output) {
      process.stdout.write(JSON.stringify(output) + '\n');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    process.stdout.write(
      JSON.stringify({
        systemMessage: `ai-ops integration hook skipped: ${message}`,
      }) + '\n',
    );
  }
};
