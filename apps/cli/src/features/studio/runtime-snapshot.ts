import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMPILER_DATA_DIR } from '@/shared/paths.js';
import { loadAllIntegrations, loadAllSkills, loadAllSubagents } from '@/shared/catalog-loader.js';
import {
  CONTEXT_PROMOTION_CODEX_HOOK,
  PC_CODEX_HOOK,
  inspectCodexHook,
  resolveCodexHooksPath,
} from '../codex-hooks/core.js';
import type { CodexHookDefinition } from '../codex-hooks/core.js';
import {
  findInstalledIntegration,
  readIntegrationManifest,
  resolveIntegrationManifestPath,
} from '../integrations/manifest-io.js';
import { readSkillRegistry, resolveCanonicalSkillId, resolveSkillRegistryPath } from '../skills/registry-io.js';
import { readSubagentManifest, resolveSubagentManifestPath } from '../subagents/manifest-io.js';
import type {
  IntegrationCatalogComponent,
  IntegrationComponent,
  InstalledIntegration,
  InstalledSkill,
  InstalledSubagent,
  Skill,
  StudioHookSnapshot,
  StudioInstalledPathState,
  StudioIntegrationComponentStatus,
  StudioIntegrationSnapshot,
  StudioRuntimeSnapshot,
  StudioSourceState,
  Subagent,
} from '@/core/schemas/index.js';
import {
  buildSourceState,
  createMissingSourceState,
  createUnavailableSourceState,
  getErrorMessage,
} from './snapshot-shared.js';
import type { RuntimeReadResult } from './snapshot-shared.js';

// ----- constants -----

const INTEGRATIONS_DATA_DIR = join(COMPILER_DATA_DIR, 'integrations');
const SKILLS_DATA_DIR = join(COMPILER_DATA_DIR, 'skills');
const SUBAGENTS_DATA_DIR = join(COMPILER_DATA_DIR, 'subagents');

const INTEGRATIONS_MANIFEST_FALLBACK_PATH = '.ai-ops/integrations-manifest.json';
const SKILLS_MANIFEST_FALLBACK_PATH = '.ai-ops/skills-manifest.json';
const SUBAGENTS_MANIFEST_FALLBACK_PATH = '.ai-ops/subagents-manifest.json';
const HOOKS_FALLBACK_PATH = '.codex/hooks.json';

const KNOWN_CODEX_HOOK_DEFINITIONS = [CONTEXT_PROMOTION_CODEX_HOOK, PC_CODEX_HOOK] as const;

// ----- runtime snapshot -----

const readRuntimeManifest = <T>(params: {
  manifestPath: string | null;
  fallbackPath: string;
  unavailableReason: string | null;
  read: (manifestPath: string) => T | null;
  getGeneratedAt: (value: T) => string | null;
}): RuntimeReadResult<T> => {
  if (params.manifestPath === null) {
    return {
      source: createUnavailableSourceState({
        path: params.fallbackPath,
        reason: params.unavailableReason ?? 'Runtime home is unavailable.',
      }),
      value: null,
    };
  }

  if (!existsSync(params.manifestPath)) {
    return {
      source: createMissingSourceState(params.manifestPath),
      value: null,
    };
  }

  try {
    const value = params.read(params.manifestPath);
    return {
      source: buildSourceState({
        path: params.manifestPath,
        exists: true,
        parsed: value !== null,
        generatedAt: value === null ? null : params.getGeneratedAt(value),
      }),
      value,
    };
  } catch (error) {
    return {
      source: buildSourceState({
        path: params.manifestPath,
        exists: true,
        parsed: false,
        error: getErrorMessage(error),
      }),
      value: null,
    };
  }
};

const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readHooksSourceState = (codexHomePath: string | null, unavailableReason: string | null): StudioSourceState => {
  if (codexHomePath === null) {
    return createUnavailableSourceState({
      path: HOOKS_FALLBACK_PATH,
      reason: unavailableReason ?? 'CODEX_HOME or HOME is required for Codex hooks.',
    });
  }

  const hooksPath = resolveCodexHooksPath(codexHomePath);
  if (!existsSync(hooksPath)) {
    return createMissingSourceState(hooksPath);
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(hooksPath, 'utf-8'));
    if (!isJsonRecord(parsed)) {
      return buildSourceState({
        path: hooksPath,
        exists: true,
        parsed: false,
        error: 'hooks.json must contain a JSON object',
      });
    }
    return buildSourceState({
      path: hooksPath,
      exists: true,
      parsed: true,
    });
  } catch (error) {
    return buildSourceState({
      path: hooksPath,
      exists: true,
      parsed: false,
      error: getErrorMessage(error),
    });
  }
};

const getCatalogComponentId = (component: IntegrationCatalogComponent): string => component.id;

const getInstalledComponentId = (component: IntegrationComponent): string => component.id;

const findInstalledComponent = (
  integration: InstalledIntegration | undefined,
  catalogComponent: IntegrationCatalogComponent,
): IntegrationComponent | null =>
  integration?.components.find(
    (component) =>
      component.type === catalogComponent.type &&
      getInstalledComponentId(component) === getCatalogComponentId(catalogComponent),
  ) ?? null;

const buildIntegrationComponentStatus = (params: {
  catalogComponent: IntegrationCatalogComponent;
  installedComponent: IntegrationComponent | null;
}): StudioIntegrationComponentStatus => ({
  type: params.catalogComponent.type,
  id: getCatalogComponentId(params.catalogComponent),
  installed: params.installedComponent !== null,
  owned: params.installedComponent?.owned ?? null,
  catalog: params.catalogComponent,
  installedComponent: params.installedComponent,
});

const buildIntegrationSnapshots = (
  installedIntegrations: readonly InstalledIntegration[],
): StudioIntegrationSnapshot[] => {
  const catalog = loadAllIntegrations(INTEGRATIONS_DATA_DIR);
  return catalog.map((entry) => {
    const installedIntegration = findInstalledIntegration(installedIntegrations, entry.id);
    return {
      id: entry.id,
      description: entry.description,
      installed: installedIntegration !== undefined,
      installedAt: installedIntegration?.installedAt ?? null,
      updatedAt: installedIntegration?.updatedAt ?? null,
      components: entry.components.map((catalogComponent) =>
        buildIntegrationComponentStatus({
          catalogComponent,
          installedComponent: findInstalledComponent(installedIntegration, catalogComponent),
        }),
      ),
    };
  });
};

const buildInstalledPathStates = (params: {
  userBasePath: string | null;
  installedPaths: readonly string[];
}): StudioInstalledPathState[] => {
  if (params.userBasePath === null) {
    return params.installedPaths.map((path) => ({ path, exists: false }));
  }

  return params.installedPaths.map((path) => ({
    path,
    exists: existsSync(join(params.userBasePath ?? '', path)),
  }));
};

const buildInstalledSkillMap = (installedSkills: readonly InstalledSkill[]): Map<string, InstalledSkill> =>
  new Map(
    installedSkills.map((skill) => [
      resolveCanonicalSkillId(skill.id),
      {
        ...skill,
        id: resolveCanonicalSkillId(skill.id),
      },
    ]),
  );

const buildSkillSnapshots = (params: {
  userBasePath: string | null;
  installedSkills: readonly InstalledSkill[];
}): StudioRuntimeSnapshot['skills'] => {
  const installed = buildInstalledSkillMap(params.installedSkills);
  return loadAllSkills(SKILLS_DATA_DIR).map((skill: Skill) => {
    const installedSkill = installed.get(skill.id);
    return {
      id: skill.id,
      kind: skill.kind,
      description: skill.description,
      supported_tools: skill.supported_tools,
      groups: skill.groups,
      installed: installedSkill !== undefined,
      installedTools: installedSkill?.tools ?? [],
      installedPaths: buildInstalledPathStates({
        userBasePath: params.userBasePath,
        installedPaths: installedSkill?.installed_paths ?? [],
      }),
      sourceHash: installedSkill?.sourceHash ?? null,
    };
  });
};

const buildInstalledSubagentMap = (installedSubagents: readonly InstalledSubagent[]): Map<string, InstalledSubagent> =>
  new Map(installedSubagents.map((subagent) => [subagent.id, subagent]));

const buildSubagentSnapshots = (params: {
  userBasePath: string | null;
  installedSubagents: readonly InstalledSubagent[];
}): StudioRuntimeSnapshot['subagents'] => {
  const installed = buildInstalledSubagentMap(params.installedSubagents);
  return loadAllSubagents(SUBAGENTS_DATA_DIR).map((subagent: Subagent) => {
    const installedSubagent = installed.get(subagent.id);
    return {
      id: subagent.id,
      description: subagent.frontmatter.codex.parsed.description,
      supported_tools: subagent.supported_tools,
      installed: installedSubagent !== undefined,
      installedTools: installedSubagent?.tools ?? [],
      installedPaths: buildInstalledPathStates({
        userBasePath: params.userBasePath,
        installedPaths: installedSubagent?.installed_paths ?? [],
      }),
      sourceHash: installedSubagent?.sourceHash ?? null,
    };
  });
};

const buildHookSnapshot = (params: {
  codexHomePath: string | null;
  definition: CodexHookDefinition;
  unavailableReason: string | null;
}): StudioHookSnapshot => {
  if (params.codexHomePath === null) {
    return {
      id: params.definition.id,
      statusMessage: params.definition.statusMessage,
      hooksPath: null,
      installed: false,
      error: params.unavailableReason ?? 'CODEX_HOME or HOME is required for Codex hooks.',
      trustReviewHint: null,
    };
  }

  const hooksPath = resolveCodexHooksPath(params.codexHomePath);
  try {
    const status = inspectCodexHook({
      hooksPath,
      definition: params.definition,
    });
    return {
      id: params.definition.id,
      statusMessage: params.definition.statusMessage,
      hooksPath: status.hooksPath,
      installed: status.installed,
      error: null,
      trustReviewHint: status.trustReviewHint,
    };
  } catch (error) {
    return {
      id: params.definition.id,
      statusMessage: params.definition.statusMessage,
      hooksPath,
      installed: false,
      error: getErrorMessage(error),
      trustReviewHint: null,
    };
  }
};

export const buildRuntimeSnapshot = (params: {
  userBasePath: string | null;
  codexHomePath: string | null;
}): StudioRuntimeSnapshot => {
  const userUnavailableReason =
    params.userBasePath === null ? 'AI_OPS_HOME or HOME is required for user/global runtime manifests.' : null;
  const codexUnavailableReason =
    params.codexHomePath === null ? 'CODEX_HOME or HOME is required for Codex hooks.' : null;
  const integrationManifest = readRuntimeManifest({
    manifestPath: params.userBasePath === null ? null : resolveIntegrationManifestPath(params.userBasePath),
    fallbackPath: INTEGRATIONS_MANIFEST_FALLBACK_PATH,
    unavailableReason: userUnavailableReason,
    read: readIntegrationManifest,
    getGeneratedAt: (manifest) => manifest.generatedAt,
  });
  const skillRegistry = readRuntimeManifest({
    manifestPath: params.userBasePath === null ? null : resolveSkillRegistryPath(params.userBasePath),
    fallbackPath: SKILLS_MANIFEST_FALLBACK_PATH,
    unavailableReason: userUnavailableReason,
    read: readSkillRegistry,
    getGeneratedAt: (registry) => registry.generatedAt,
  });
  const subagentManifest = readRuntimeManifest({
    manifestPath: params.userBasePath === null ? null : resolveSubagentManifestPath(params.userBasePath),
    fallbackPath: SUBAGENTS_MANIFEST_FALLBACK_PATH,
    unavailableReason: userUnavailableReason,
    read: readSubagentManifest,
    getGeneratedAt: (manifest) => manifest.generatedAt,
  });
  const hooks = readHooksSourceState(params.codexHomePath, codexUnavailableReason);
  const installedIntegrations = integrationManifest.value?.integrations ?? [];
  const installedSkills = skillRegistry.value?.skills ?? [];
  const installedSubagents = subagentManifest.value?.subagents ?? [];

  return {
    available: params.userBasePath !== null,
    unavailableReason: userUnavailableReason,
    userBasePath: params.userBasePath,
    codexHomePath: params.codexHomePath,
    manifests: {
      integrations: integrationManifest.source,
      skills: skillRegistry.source,
      subagents: subagentManifest.source,
      hooks,
    },
    integrations: buildIntegrationSnapshots(installedIntegrations),
    skills: buildSkillSnapshots({
      userBasePath: params.userBasePath,
      installedSkills,
    }),
    subagents: buildSubagentSnapshots({
      userBasePath: params.userBasePath,
      installedSubagents,
    }),
    hooks: KNOWN_CODEX_HOOK_DEFINITIONS.map((definition) =>
      buildHookSnapshot({
        codexHomePath: params.codexHomePath,
        definition,
        unavailableReason: codexUnavailableReason,
      }),
    ),
  };
};
