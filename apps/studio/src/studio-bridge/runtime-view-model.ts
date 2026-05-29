import { isRecord, type StudioSnapshotEnvelope } from './studio-snapshot';

// ----- types -----

export const RUNTIME_COMPONENT_TYPES = ['skill', 'subagent', 'codex-hook', 'receipt-config'] as const;

export type RuntimeComponentType = (typeof RUNTIME_COMPONENT_TYPES)[number];

export const RUNTIME_SKILL_KINDS = ['reference', 'task'] as const;

export type RuntimeSkillKind = (typeof RUNTIME_SKILL_KINDS)[number];

export type RuntimeSourceState = {
  readonly path: string;
  readonly exists: boolean | null;
  readonly parsed: boolean | null;
  readonly generatedAt: string | null;
  readonly error: string | null;
};

export type RuntimeSourceSummaryState = 'ready' | 'missing' | 'invalid' | 'unavailable' | 'unknown';

export type RuntimeSourceSummary = {
  readonly id: 'integrations' | 'skills' | 'subagents' | 'hooks';
  readonly label: string;
  readonly state: RuntimeSourceSummaryState;
  readonly source: RuntimeSourceState;
};

export type RuntimeInstalledPathState = {
  readonly path: string;
  readonly exists: boolean;
};

export type RuntimeInstalledPathIssue = {
  readonly kind: 'skill' | 'subagent';
  readonly id: string;
  readonly path: string;
};

export type RuntimeComponentOwnership = 'owned' | 'pre-existing' | 'not-installed' | 'unknown';

export type RuntimeIntegrationComponentView = {
  readonly type: RuntimeComponentType;
  readonly id: string;
  readonly installed: boolean;
  readonly owned: boolean | null;
  readonly ownership: RuntimeComponentOwnership;
  readonly catalogId: string;
  readonly catalogTools: readonly string[];
  readonly installedTools: readonly string[];
  readonly catalogStoragePath: string | null;
  readonly installedStoragePath: string | null;
  readonly command: string | null;
};

export type RuntimeIntegrationView = {
  readonly id: string;
  readonly description: string;
  readonly installed: boolean;
  readonly installedAt: string | null;
  readonly updatedAt: string | null;
  readonly components: readonly RuntimeIntegrationComponentView[];
};

export type RuntimeSkillView = {
  readonly id: string;
  readonly kind: RuntimeSkillKind;
  readonly description: string;
  readonly supportedTools: readonly string[];
  readonly groups: readonly string[];
  readonly installed: boolean;
  readonly installedTools: readonly string[];
  readonly installedPaths: readonly RuntimeInstalledPathState[];
  readonly sourceHash: string | null;
};

export type RuntimeSkillGroup = {
  readonly kind: RuntimeSkillKind;
  readonly skills: readonly RuntimeSkillView[];
  readonly installed: number;
  readonly total: number;
};

export type RuntimeSubagentView = {
  readonly id: string;
  readonly description: string;
  readonly supportedTools: readonly string[];
  readonly installed: boolean;
  readonly installedTools: readonly string[];
  readonly installedPaths: readonly RuntimeInstalledPathState[];
  readonly sourceHash: string | null;
};

export type RuntimeHookView = {
  readonly id: string;
  readonly statusMessage: string;
  readonly hooksPath: string | null;
  readonly installed: boolean;
  readonly error: string | null;
  readonly trustReviewHint: string | null;
  readonly relatedIntegrationIds: readonly string[];
};

export type RuntimeCount = {
  readonly installed: number;
  readonly total: number;
};

export type RuntimeViewModel = {
  readonly available: boolean;
  readonly unavailableReason: string | null;
  readonly userBasePath: string | null;
  readonly codexHomePath: string | null;
  readonly manifests: {
    readonly integrations: RuntimeSourceState;
    readonly skills: RuntimeSourceState;
    readonly subagents: RuntimeSourceState;
    readonly hooks: RuntimeSourceState;
  };
  readonly manifestStates: readonly RuntimeSourceSummary[];
  readonly counts: {
    readonly integrations: RuntimeCount;
    readonly skills: RuntimeCount;
    readonly subagents: RuntimeCount;
    readonly hooks: RuntimeCount;
    readonly missingInstalledPaths: number;
  };
  readonly missingInstalledPaths: readonly RuntimeInstalledPathIssue[];
  readonly integrations: readonly RuntimeIntegrationView[];
  readonly skills: readonly RuntimeSkillView[];
  readonly skillGroups: readonly RuntimeSkillGroup[];
  readonly subagents: readonly RuntimeSubagentView[];
  readonly hooks: readonly RuntimeHookView[];
};

// ----- guards -----

const isRuntimeComponentType = (value: unknown): value is RuntimeComponentType =>
  typeof value === 'string' && RUNTIME_COMPONENT_TYPES.includes(value as RuntimeComponentType);

const isRuntimeSkillKind = (value: unknown): value is RuntimeSkillKind =>
  typeof value === 'string' && RUNTIME_SKILL_KINDS.includes(value as RuntimeSkillKind);

// ----- field readers -----

const getString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const getNullableString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' ? value : null;
};

const getBoolean = (record: Record<string, unknown>, key: string): boolean | null => {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
};

const getStringArray = (record: Record<string, unknown>, key: string): readonly string[] => {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
};

// ----- source state -----

const createUnknownSourceState = (path: string): RuntimeSourceState => ({
  path,
  exists: null,
  parsed: null,
  generatedAt: null,
  error: null,
});

const parseSourceState = (value: unknown, fallbackPath: string): RuntimeSourceState => {
  if (!isRecord(value)) {
    return createUnknownSourceState(fallbackPath);
  }

  return {
    path: getString(value, 'path') ?? fallbackPath,
    exists: getBoolean(value, 'exists'),
    parsed: getBoolean(value, 'parsed'),
    generatedAt: getNullableString(value, 'generatedAt'),
    error: getNullableString(value, 'error'),
  };
};

const getSourceSummaryState = (source: RuntimeSourceState): RuntimeSourceSummaryState => {
  if (source.exists === false && source.error !== null) {
    return 'unavailable';
  }
  if (source.exists === false) {
    return 'missing';
  }
  if (source.parsed === false) {
    return 'invalid';
  }
  if (source.exists === true && source.parsed === true) {
    return 'ready';
  }
  return 'unknown';
};

const buildManifestStates = (manifests: RuntimeViewModel['manifests']): readonly RuntimeSourceSummary[] => [
  {
    id: 'integrations',
    label: 'Integrations manifest',
    state: getSourceSummaryState(manifests.integrations),
    source: manifests.integrations,
  },
  {
    id: 'skills',
    label: 'Skills registry',
    state: getSourceSummaryState(manifests.skills),
    source: manifests.skills,
  },
  {
    id: 'subagents',
    label: 'Subagents manifest',
    state: getSourceSummaryState(manifests.subagents),
    source: manifests.subagents,
  },
  {
    id: 'hooks',
    label: 'Codex hooks',
    state: getSourceSummaryState(manifests.hooks),
    source: manifests.hooks,
  },
];

// ----- runtime item parsers -----

const parseInstalledPathState = (value: unknown): RuntimeInstalledPathState | null => {
  if (!isRecord(value)) {
    return null;
  }

  const path = getString(value, 'path');
  const exists = getBoolean(value, 'exists');
  if (path === null || exists === null) {
    return null;
  }

  return {
    path,
    exists,
  };
};

const parseInstalledPathStates = (value: unknown): readonly RuntimeInstalledPathState[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): RuntimeInstalledPathState[] => {
    const parsed = parseInstalledPathState(item);
    return parsed === null ? [] : [parsed];
  });
};

const resolveComponentOwnership = (params: {
  installed: boolean;
  owned: boolean | null;
}): RuntimeComponentOwnership => {
  if (!params.installed) {
    return 'not-installed';
  }
  if (params.owned === true) {
    return 'owned';
  }
  if (params.owned === false) {
    return 'pre-existing';
  }
  return 'unknown';
};

const parseIntegrationComponent = (value: unknown): RuntimeIntegrationComponentView | null => {
  if (!isRecord(value)) {
    return null;
  }

  const type = value.type;
  const id = getString(value, 'id');
  if (!isRuntimeComponentType(type) || id === null) {
    return null;
  }

  const catalog = isRecord(value.catalog) ? value.catalog : {};
  const installedComponent = isRecord(value.installedComponent) ? value.installedComponent : {};
  const installed = getBoolean(value, 'installed') ?? false;
  const owned = getBoolean(value, 'owned');

  return {
    type,
    id,
    installed,
    owned,
    ownership: resolveComponentOwnership({ installed, owned }),
    catalogId: getString(catalog, 'id') ?? id,
    catalogTools: getStringArray(catalog, 'tools'),
    installedTools: getStringArray(installedComponent, 'tools'),
    catalogStoragePath: getNullableString(catalog, 'storage_path'),
    installedStoragePath: getNullableString(installedComponent, 'storagePath'),
    command: getNullableString(installedComponent, 'command'),
  };
};

const parseIntegration = (value: unknown): RuntimeIntegrationView | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id');
  const description = getString(value, 'description');
  if (id === null || description === null) {
    return null;
  }

  const components = Array.isArray(value.components)
    ? value.components.flatMap((component): RuntimeIntegrationComponentView[] => {
        const parsed = parseIntegrationComponent(component);
        return parsed === null ? [] : [parsed];
      })
    : [];

  return {
    id,
    description,
    installed: getBoolean(value, 'installed') ?? false,
    installedAt: getNullableString(value, 'installedAt'),
    updatedAt: getNullableString(value, 'updatedAt'),
    components,
  };
};

const parseIntegrations = (runtime: Record<string, unknown>): readonly RuntimeIntegrationView[] => {
  const integrations = runtime.integrations;
  if (!Array.isArray(integrations)) {
    return [];
  }

  return integrations.flatMap((integration): RuntimeIntegrationView[] => {
    const parsed = parseIntegration(integration);
    return parsed === null ? [] : [parsed];
  });
};

const parseSkill = (value: unknown): RuntimeSkillView | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id');
  const kind = value.kind;
  const description = getString(value, 'description');
  if (id === null || !isRuntimeSkillKind(kind) || description === null) {
    return null;
  }

  return {
    id,
    kind,
    description,
    supportedTools: getStringArray(value, 'supported_tools'),
    groups: getStringArray(value, 'groups'),
    installed: getBoolean(value, 'installed') ?? false,
    installedTools: getStringArray(value, 'installedTools'),
    installedPaths: parseInstalledPathStates(value.installedPaths),
    sourceHash: getNullableString(value, 'sourceHash'),
  };
};

const parseSkills = (runtime: Record<string, unknown>): readonly RuntimeSkillView[] => {
  const skills = runtime.skills;
  if (!Array.isArray(skills)) {
    return [];
  }

  return skills.flatMap((skill): RuntimeSkillView[] => {
    const parsed = parseSkill(skill);
    return parsed === null ? [] : [parsed];
  });
};

const parseSubagent = (value: unknown): RuntimeSubagentView | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id');
  const description = getString(value, 'description');
  if (id === null || description === null) {
    return null;
  }

  return {
    id,
    description,
    supportedTools: getStringArray(value, 'supported_tools'),
    installed: getBoolean(value, 'installed') ?? false,
    installedTools: getStringArray(value, 'installedTools'),
    installedPaths: parseInstalledPathStates(value.installedPaths),
    sourceHash: getNullableString(value, 'sourceHash'),
  };
};

const parseSubagents = (runtime: Record<string, unknown>): readonly RuntimeSubagentView[] => {
  const subagents = runtime.subagents;
  if (!Array.isArray(subagents)) {
    return [];
  }

  return subagents.flatMap((subagent): RuntimeSubagentView[] => {
    const parsed = parseSubagent(subagent);
    return parsed === null ? [] : [parsed];
  });
};

const findRelatedIntegrationIds = (
  integrations: readonly RuntimeIntegrationView[],
  hookId: string,
): readonly string[] =>
  integrations
    .filter((integration) =>
      integration.components.some((component) => component.type === 'codex-hook' && component.id === hookId),
    )
    .map((integration) => integration.id);

const parseHook = (value: unknown, integrations: readonly RuntimeIntegrationView[]): RuntimeHookView | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id');
  if (id === null) {
    return null;
  }

  return {
    id,
    statusMessage: getString(value, 'statusMessage') ?? id,
    hooksPath: getNullableString(value, 'hooksPath'),
    installed: getBoolean(value, 'installed') ?? false,
    error: getNullableString(value, 'error'),
    trustReviewHint: getNullableString(value, 'trustReviewHint'),
    relatedIntegrationIds: findRelatedIntegrationIds(integrations, id),
  };
};

const parseHooks = (
  runtime: Record<string, unknown>,
  integrations: readonly RuntimeIntegrationView[],
): readonly RuntimeHookView[] => {
  const hooks = runtime.hooks;
  if (!Array.isArray(hooks)) {
    return [];
  }

  return hooks.flatMap((hook): RuntimeHookView[] => {
    const parsed = parseHook(hook, integrations);
    return parsed === null ? [] : [parsed];
  });
};

// ----- builders -----

const countInstalled = (items: readonly { readonly installed: boolean }[]): RuntimeCount => ({
  installed: items.filter((item) => item.installed).length,
  total: items.length,
});

const buildSkillGroups = (skills: readonly RuntimeSkillView[]): readonly RuntimeSkillGroup[] =>
  RUNTIME_SKILL_KINDS.map((kind) => {
    const groupSkills = skills.filter((skill) => skill.kind === kind);
    return {
      kind,
      skills: groupSkills,
      installed: groupSkills.filter((skill) => skill.installed).length,
      total: groupSkills.length,
    };
  });

const buildMissingInstalledPaths = (params: {
  skills: readonly RuntimeSkillView[];
  subagents: readonly RuntimeSubagentView[];
}): readonly RuntimeInstalledPathIssue[] => [
  ...params.skills.flatMap((skill): RuntimeInstalledPathIssue[] =>
    skill.installedPaths
      .filter((path) => !path.exists)
      .map((path) => ({
        kind: 'skill',
        id: skill.id,
        path: path.path,
      })),
  ),
  ...params.subagents.flatMap((subagent): RuntimeInstalledPathIssue[] =>
    subagent.installedPaths
      .filter((path) => !path.exists)
      .map((path) => ({
        kind: 'subagent',
        id: subagent.id,
        path: path.path,
      })),
  ),
];

const parseRuntimeManifests = (runtime: Record<string, unknown>): RuntimeViewModel['manifests'] => {
  const manifests = isRecord(runtime.manifests) ? runtime.manifests : {};

  return {
    integrations: parseSourceState(manifests.integrations, '.ai-ops/integrations-manifest.json'),
    skills: parseSourceState(manifests.skills, '.ai-ops/skills-manifest.json'),
    subagents: parseSourceState(manifests.subagents, '.ai-ops/subagents-manifest.json'),
    hooks: parseSourceState(manifests.hooks, '.codex/hooks.json'),
  };
};

// ----- public API -----

export const buildRuntimeViewModel = (snapshot: StudioSnapshotEnvelope): RuntimeViewModel => {
  const runtime = snapshot.runtime;
  const manifests = parseRuntimeManifests(runtime);
  const integrations = parseIntegrations(runtime);
  const skills = parseSkills(runtime);
  const subagents = parseSubagents(runtime);
  const hooks = parseHooks(runtime, integrations);
  const missingInstalledPaths = buildMissingInstalledPaths({ skills, subagents });

  return {
    available: getBoolean(runtime, 'available') ?? false,
    unavailableReason: getNullableString(runtime, 'unavailableReason'),
    userBasePath: getNullableString(runtime, 'userBasePath'),
    codexHomePath: getNullableString(runtime, 'codexHomePath'),
    manifests,
    manifestStates: buildManifestStates(manifests),
    counts: {
      integrations: countInstalled(integrations),
      skills: countInstalled(skills),
      subagents: countInstalled(subagents),
      hooks: countInstalled(hooks),
      missingInstalledPaths: missingInstalledPaths.length,
    },
    missingInstalledPaths,
    integrations,
    skills,
    skillGroups: buildSkillGroups(skills),
    subagents,
    hooks,
  };
};

export const selectRuntimeItem = <T extends { readonly id: string; readonly installed: boolean }>(
  items: readonly T[],
  selectedRuntimeItemId: string | null,
): T | null =>
  items.find((item) => item.id === selectedRuntimeItemId) ??
  items.find((item) => item.installed === true) ??
  items[0] ??
  null;
