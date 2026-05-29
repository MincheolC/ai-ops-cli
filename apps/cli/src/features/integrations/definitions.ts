import type {
  IntegrationCatalogComponent,
  IntegrationCatalogEntry,
  IntegrationId,
} from '@/core/schemas/index.js';
import { INTEGRATION_COMPONENT_TYPE } from '@/core/schemas/index.js';
import { loadAllIntegrations } from '@/shared/catalog-loader.js';
import { CONTEXT_PROMOTION_CODEX_HOOK, PC_CODEX_HOOK } from '../codex-hooks/core.js';
import type { CodexHookDefinition } from '../codex-hooks/core.js';
import { resolveIntegrationsDir } from '../../shared/command-paths.js';

export type IntegrationInstallOptions = {
  command?: string;
};

export type IntegrationDefinition = IntegrationCatalogEntry & {
  skillComponent: Extract<IntegrationCatalogComponent, { type: typeof INTEGRATION_COMPONENT_TYPE.SKILL }>;
  hookComponent: Extract<IntegrationCatalogComponent, { type: typeof INTEGRATION_COMPONENT_TYPE.CODEX_HOOK }>;
  receiptConfigComponents: Extract<
    IntegrationCatalogComponent,
    { type: typeof INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG }
  >[];
  hookDefinition: CodexHookDefinition;
};

export { resolvePersonalContextRoot } from '../../shared/command-paths.js';

const CODEX_HOOK_DEFINITIONS = [CONTEXT_PROMOTION_CODEX_HOOK, PC_CODEX_HOOK] as const;

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

export const loadIntegrationDefinitions = (): IntegrationDefinition[] =>
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
