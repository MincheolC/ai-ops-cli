import * as p from '@clack/prompts';
import {
  INTEGRATION_COMPONENT_TYPE,
  INTEGRATION_ID,
} from '@/core/schemas/index.js';
import { getCliVersion } from '@/shared/source-hash.js';
import {
  inspectCodexHook,
  resolveCodexHooksPath,
  uninstallCodexHook,
} from '../codex-hooks/core.js';
import { evaluatePcPostToolUseHook, getPcHandoffStatus } from '../pc/core.js';
import {
  findInstalledIntegration,
  readIntegrationManifest,
  resolveIntegrationManifestPath,
  writeUserIntegrationState,
} from './manifest-io.js';
import { resolveBasePath, resolveUserBasePath } from '../../shared/command-paths.js';
import {
  buildInstalledIntegration,
  buildReceiptConfigComponents,
  componentWasOwned,
  ensureHookComponent,
  ensureSkillComponent,
  formatComponentStatus,
  hasInstalledCodexSkill,
  removeOwnedSkill,
} from './components.js';
import {
  loadIntegrationDefinitions,
  parseIntegrationId,
  resolveCodexHomePath,
  resolveIntegrationDefinition,
  resolvePersonalContextRoot,
} from './definitions.js';
import type { IntegrationInstallOptions } from './definitions.js';
import { readStdin, reportIntegrationError } from './stdio.js';

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
