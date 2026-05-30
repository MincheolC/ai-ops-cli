import { INTEGRATION_COMPONENT_TYPE } from '@/core/schemas/index.js';
import type { InstalledIntegration, IntegrationComponent } from '@/core/schemas/index.js';
import { inspectCodexHook, resolveCodexHooksPath } from '../codex-hooks/core.js';
import type { CodexHookDefinition } from '../codex-hooks/core.js';
import {
  buildReceiptConfigComponents,
  ensureHookComponent,
  ensureSkillComponent,
  ensureSubagentComponent,
  hasInstalledCodexSkill,
  inspectSkillComponentSource,
  inspectSubagentComponentSource,
} from './components.js';
import { resolveCodexHomePath } from './definitions.js';
import type { IntegrationDefinition, IntegrationInstallOptions } from './definitions.js';

type IntegrationLifecycleMode = 'install' | 'update';

export const resolveHookDefinitionForComponent = (
  definition: IntegrationDefinition,
  hookComponentId: string,
): CodexHookDefinition => {
  const hookDefinition = definition.hookDefinitions.find((candidate) => candidate.id === hookComponentId);
  if (!hookDefinition) {
    throw new Error(`Unknown Codex hook component for integration: ${definition.id}:${hookComponentId}`);
  }
  return hookDefinition;
};

const findPreviousComponent = (params: {
  previous?: InstalledIntegration;
  type: IntegrationComponent['type'];
  id: string;
}): IntegrationComponent | undefined =>
  params.previous?.components.find((component) => component.type === params.type && component.id === params.id);

const shouldPreservePreExistingComponent = (params: {
  mode: IntegrationLifecycleMode;
  previousComponent?: IntegrationComponent;
}): boolean => params.mode === 'update' && params.previousComponent?.owned === false;

export const ensureIntegrationComponents = (params: {
  definition: IntegrationDefinition;
  previous?: InstalledIntegration;
  basePath: string;
  cliVersion: string;
  opts?: IntegrationInstallOptions;
  mode?: IntegrationLifecycleMode;
}): IntegrationComponent[] => {
  const mode = params.mode ?? 'install';
  const skillComponents = params.definition.skillComponents.map((component) => {
    const previousComponent = findPreviousComponent({
      previous: params.previous,
      type: INTEGRATION_COMPONENT_TYPE.SKILL,
      id: component.id,
    });
    if (shouldPreservePreExistingComponent({ mode, previousComponent })) {
      return previousComponent;
    }
    return ensureSkillComponent({
      basePath: params.basePath,
      cliVersion: params.cliVersion,
      skillId: component.id,
      tools: component.tools,
      previouslyOwned: previousComponent?.owned === true,
    });
  });

  const subagentComponents = params.definition.subagentComponents.map((component) => {
    const previousComponent = findPreviousComponent({
      previous: params.previous,
      type: INTEGRATION_COMPONENT_TYPE.SUBAGENT,
      id: component.id,
    });
    if (shouldPreservePreExistingComponent({ mode, previousComponent })) {
      return previousComponent;
    }
    return ensureSubagentComponent({
      basePath: params.basePath,
      cliVersion: params.cliVersion,
      subagentId: component.id,
      tools: component.tools,
      previouslyOwned: previousComponent?.owned === true,
    });
  });

  const hookComponents =
    params.definition.hookComponents.length === 0
      ? []
      : params.definition.hookComponents.map((component) => {
          const previousComponent = findPreviousComponent({
            previous: params.previous,
            type: INTEGRATION_COMPONENT_TYPE.CODEX_HOOK,
            id: component.id,
          });
          if (shouldPreservePreExistingComponent({ mode, previousComponent })) {
            return previousComponent;
          }
          return ensureHookComponent({
            hooksPath: resolveCodexHooksPath(resolveCodexHomePath()),
            hookId: component.id,
            definition: resolveHookDefinitionForComponent(params.definition, component.id),
            command: params.opts?.command,
            commandWindows: params.opts?.commandWindows,
            previouslyOwned: previousComponent?.owned === true,
          });
        });

  return [
    ...skillComponents,
    ...subagentComponents,
    ...hookComponents,
    ...buildReceiptConfigComponents(params.definition.receiptConfigComponents),
  ];
};

const formatInstalledFlag = (values: readonly boolean[]): string => {
  if (values.length === 0) {
    return 'n/a';
  }
  return values.every(Boolean) ? 'yes' : 'no';
};

const formatSourceStatus = (params: {
  label: string;
  status: ReturnType<typeof inspectSkillComponentSource>;
}): string => {
  const state = !params.status.installed ? 'missing' : params.status.current ? 'up-to-date' : 'changed';
  const missing =
    params.status.missingPaths.length > 0 ? `; missing paths: ${params.status.missingPaths.join(', ')}` : '';
  return `- ${params.label}: ${state} (${params.status.installedSourceHash ?? 'none'} -> ${
    params.status.catalogSourceHash
  })${missing}`;
};

export const buildIntegrationComponentStatusLines = (params: {
  definition: IntegrationDefinition;
  basePath: string;
}): string[] => {
  const skillStatuses = params.definition.skillComponents.map((component) =>
    inspectSkillComponentSource({ basePath: params.basePath, skillId: component.id, tools: component.tools }),
  );
  const subagentStatuses = params.definition.subagentComponents.map((component) =>
    inspectSubagentComponentSource({ basePath: params.basePath, subagentId: component.id, tools: component.tools }),
  );
  const hookStatuses =
    params.definition.hookComponents.length === 0
      ? []
      : params.definition.hookComponents.map((component) =>
          inspectCodexHook({
            hooksPath: resolveCodexHooksPath(resolveCodexHomePath()),
            definition: resolveHookDefinitionForComponent(params.definition, component.id),
          }),
        );

  const lines = [
    `skill installed: ${formatInstalledFlag(skillStatuses.map((status) => status.installed))}`,
    `subagent installed: ${formatInstalledFlag(subagentStatuses.map((status) => status.installed))}`,
    `hook installed: ${formatInstalledFlag(hookStatuses.map((status) => status.installed))}`,
  ];
  lines.push(
    ...params.definition.skillComponents.map(
      (component) =>
        `skill:${component.id} installed: ${
          hasInstalledCodexSkill({ basePath: params.basePath, skillId: component.id }) ? 'yes' : 'no'
        }`,
    ),
  );
  lines.push(
    ...params.definition.subagentComponents.map((component, index) => {
      const status = subagentStatuses[index];
      return `subagent:${component.id} installed: ${status?.installed === true ? 'yes' : 'no'}`;
    }),
  );
  if (hookStatuses.length > 0) {
    lines.push(
      ...hookStatuses.map((status, index) => {
        const component = params.definition.hookComponents[index];
        return `hook:${component?.id ?? 'unknown'} installed: ${status.installed ? 'yes' : 'no'}`;
      }),
      `hooks file: ${hookStatuses[0]?.hooksPath ?? 'n/a'}`,
      `hook trust: ${hookStatuses.map((status) => status.trustReviewHint).filter(Boolean).join(', ') || 'n/a'}`,
    );
  } else {
    lines.push('hooks file: n/a', 'hook trust: n/a');
  }

  return lines;
};

export const buildIntegrationDiffLines = (params: {
  definition: IntegrationDefinition;
  basePath: string;
  installedIntegration?: InstalledIntegration;
}): string[] => {
  const lines = [`integration installed: ${params.installedIntegration ? 'yes' : 'no'}`];
  lines.push(
    ...params.definition.skillComponents.map((component) =>
      formatSourceStatus({
        label: `skill:${component.id}`,
        status: inspectSkillComponentSource({ basePath: params.basePath, skillId: component.id, tools: component.tools }),
      }),
    ),
  );
  lines.push(
    ...params.definition.subagentComponents.map((component) =>
      formatSourceStatus({
        label: `subagent:${component.id}`,
        status: inspectSubagentComponentSource({
          basePath: params.basePath,
          subagentId: component.id,
          tools: component.tools,
        }),
      }),
    ),
  );

  if (params.definition.hookComponents.length > 0) {
    lines.push(
      ...params.definition.hookComponents.map((component) => {
        const status = inspectCodexHook({
          hooksPath: resolveCodexHooksPath(resolveCodexHomePath()),
          definition: resolveHookDefinitionForComponent(params.definition, component.id),
        });
        return `- codex-hook:${component.id}: ${status.installed ? 'installed' : 'missing'}`;
      }),
    );
  }

  lines.push(
    ...params.definition.receiptConfigComponents.map((component) => {
      const installed = params.installedIntegration?.components.some(
        (installedComponent) =>
          installedComponent.type === INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG && installedComponent.id === component.id,
      );
      return `- receipt-config:${component.id}: ${installed ? 'configured' : 'missing'}`;
    }),
  );
  return lines;
};
