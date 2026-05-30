import type { IntegrationCatalogComponent, IntegrationCatalogEntry, IntegrationId } from '@/core/schemas/index.js';
import { INTEGRATION_COMPONENT_TYPE } from '@/core/schemas/index.js';
import { loadAllIntegrations } from '@/shared/catalog-loader.js';
import { PC_CODEX_HOOK } from '../codex-hooks/core.js';
import type { CodexHookDefinition } from '../codex-hooks/core.js';
import { resolveIntegrationsDir } from '../../shared/command-paths.js';

export type IntegrationInstallOptions = {
  command?: string;
  commandWindows?: string;
};

type IntegrationSkillCatalogComponent = Extract<
  IntegrationCatalogComponent,
  { type: typeof INTEGRATION_COMPONENT_TYPE.SKILL }
>;
type IntegrationSubagentCatalogComponent = Extract<
  IntegrationCatalogComponent,
  { type: typeof INTEGRATION_COMPONENT_TYPE.SUBAGENT }
>;
type IntegrationHookCatalogComponent = Extract<
  IntegrationCatalogComponent,
  { type: typeof INTEGRATION_COMPONENT_TYPE.CODEX_HOOK }
>;
type IntegrationReceiptConfigCatalogComponent = Extract<
  IntegrationCatalogComponent,
  { type: typeof INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG }
>;

export type IntegrationDefinition = IntegrationCatalogEntry & {
  skillComponents: IntegrationSkillCatalogComponent[];
  subagentComponents: IntegrationSubagentCatalogComponent[];
  hookComponents: IntegrationHookCatalogComponent[];
  receiptConfigComponents: IntegrationReceiptConfigCatalogComponent[];
  hookDefinitions: CodexHookDefinition[];
};

export { resolvePersonalContextRoot } from '../../shared/command-paths.js';

const CODEX_HOOK_DEFINITIONS = [PC_CODEX_HOOK] as const;

export const resolveCodexHomePath = (): string => {
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

const resolveCodexHookDefinition = (hookId: IntegrationId): CodexHookDefinition => {
  const hookDefinition = CODEX_HOOK_DEFINITIONS.find((definition) => definition.id === hookId);
  if (!hookDefinition) {
    throw new Error(`Unknown Codex hook for integration: ${hookId}`);
  }
  return hookDefinition;
};

const resolveCatalogSkillComponents = (entry: IntegrationCatalogEntry): IntegrationDefinition['skillComponents'] =>
  entry.components.filter(
    (component): component is IntegrationDefinition['skillComponents'][number] =>
      component.type === INTEGRATION_COMPONENT_TYPE.SKILL,
  );

const resolveCatalogSubagentComponents = (entry: IntegrationCatalogEntry): IntegrationDefinition['subagentComponents'] =>
  entry.components.filter(
    (component): component is IntegrationDefinition['subagentComponents'][number] =>
      component.type === INTEGRATION_COMPONENT_TYPE.SUBAGENT,
  );

const resolveCatalogHookComponents = (entry: IntegrationCatalogEntry): IntegrationDefinition['hookComponents'] =>
  entry.components.filter(
    (component): component is IntegrationDefinition['hookComponents'][number] =>
      component.type === INTEGRATION_COMPONENT_TYPE.CODEX_HOOK,
  );

const resolveCatalogReceiptConfigComponents = (
  entry: IntegrationCatalogEntry,
): IntegrationDefinition['receiptConfigComponents'] =>
  entry.components.filter(
    (component): component is IntegrationDefinition['receiptConfigComponents'][number] =>
      component.type === INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG,
  );

export const loadIntegrationDefinitions = (): IntegrationDefinition[] =>
  loadAllIntegrations(resolveIntegrationsDir()).map((entry) => {
    const hookComponents = resolveCatalogHookComponents(entry);
    return {
      ...entry,
      skillComponents: resolveCatalogSkillComponents(entry),
      subagentComponents: resolveCatalogSubagentComponents(entry),
      hookComponents,
      receiptConfigComponents: resolveCatalogReceiptConfigComponents(entry),
      hookDefinitions: hookComponents.map((component) => resolveCodexHookDefinition(component.id)),
    };
  });

export const parseIntegrationId = (integrationId: string): IntegrationId => {
  const definition = loadIntegrationDefinitions().find((candidate) => candidate.id === integrationId);
  if (!definition) {
    throw new Error(`Unknown integration: ${integrationId}`);
  }
  return definition.id;
};

export const resolveIntegrationDefinition = (integrationId: string): IntegrationDefinition => {
  const definition = loadIntegrationDefinitions().find((candidate) => candidate.id === integrationId);
  if (!definition) {
    throw new Error(`Unknown integration: ${integrationId}`);
  }
  return definition;
};
