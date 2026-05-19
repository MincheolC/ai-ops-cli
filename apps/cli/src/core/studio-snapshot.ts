import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import {
  CONTEXT_PROMOTION_CODEX_HOOK,
  PC_CODEX_HOOK,
  inspectCodexHook,
  resolveCodexHooksPath,
} from './codex-hook.js';
import { findInstalledIntegration, readIntegrationManifest, resolveIntegrationManifestPath } from './integration-manifest-io.js';
import { loadAllIntegrations, loadAllSkills, loadAllSubagents } from './loader.js';
import { COMPILER_DATA_DIR } from './paths.js';
import {
  PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
  PROJECT_LAYER_MANIFEST_RELATIVE_PATH,
  auditProjectLayer,
  parseProjectLayerDocument,
  readProjectLayerManifest,
  resolveProjectLayerContextIndexPath,
  resolveProjectLayerFilePath,
  resolveProjectLayerManifestPath,
} from './project-layer.js';
import { readSkillRegistry, resolveCanonicalSkillId, resolveSkillRegistryPath } from './skill-registry-io.js';
import { getCliVersion } from './source-hash.js';
import { readSubagentManifest, resolveSubagentManifestPath } from './subagent-manifest-io.js';
import { StudioSnapshotSchema } from './schemas/index.js';
import {
  ProjectLayerContextIndexSchema,
  ProjectLayerDocumentStatusSchema,
} from './schemas/index.js';
import type {
  CodexHookDefinition,
  IntegrationCatalogComponent,
  IntegrationComponent,
  InstalledIntegration,
  InstalledSkill,
  InstalledSubagent,
  ProjectLayerContextDocument,
  ProjectLayerContextIndex,
  ProjectLayerManifest,
  Skill,
  StudioHookSnapshot,
  StudioInstalledPathState,
  StudioIntegrationComponentStatus,
  StudioIntegrationSnapshot,
  StudioProjectDocument,
  StudioProjectDocumentProvenance,
  StudioProjectSnapshot,
  StudioRuntimeSnapshot,
  StudioSnapshot,
  StudioSourceState,
  Subagent,
} from './schemas/index.js';

// ----- types -----

export type BuildStudioSnapshotParams = {
  basePath: string;
  userBasePath?: string | null;
  codexHomePath?: string | null;
  generatedAt?: string;
  cliVersion?: string;
};

type ProjectManifestReadResult = {
  source: StudioSourceState;
  manifest: ProjectLayerManifest | null;
};

type ProjectContextIndexReadResult = {
  source: StudioSourceState;
  contextIndex: ProjectLayerContextIndex | null;
};

type RuntimeReadResult<T> = {
  source: StudioSourceState;
  value: T | null;
};

// ----- constants -----

const INTEGRATIONS_DATA_DIR = join(COMPILER_DATA_DIR, 'integrations');
const SKILLS_DATA_DIR = join(COMPILER_DATA_DIR, 'skills');
const SUBAGENTS_DATA_DIR = join(COMPILER_DATA_DIR, 'subagents');

const DOCS_STATUS_RELATIVE_PATH = 'docs/docs-status.md';
const INTEGRATIONS_MANIFEST_FALLBACK_PATH = '.ai-ops/integrations-manifest.json';
const SKILLS_MANIFEST_FALLBACK_PATH = '.ai-ops/skills-manifest.json';
const SUBAGENTS_MANIFEST_FALLBACK_PATH = '.ai-ops/subagents-manifest.json';
const HOOKS_FALLBACK_PATH = '.codex/hooks.json';

const KNOWN_CODEX_HOOK_DEFINITIONS = [CONTEXT_PROMOTION_CODEX_HOOK, PC_CODEX_HOOK] as const;

const RecoverableContextDocumentSchema = z
  .object({
    status: ProjectLayerDocumentStatusSchema,
    layer: z.string().min(1),
    owner: z.string().min(1),
    read_when: z.array(z.string().min(1)),
    update_when: z.array(z.string().min(1)),
    path: z.string().min(1),
    contentHash: z.string().min(1),
  });

const RecoverableContextIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('context-layer-index'),
    documents: z.array(z.unknown()),
    generatedAt: z.string().min(1),
  });

// ----- shared helpers -----

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

const resolveDefaultUserBasePath = (): string | null => process.env.AI_OPS_HOME ?? process.env.HOME ?? null;

const resolveDefaultCodexHomePath = (): string | null => {
  if (process.env.CODEX_HOME && process.env.CODEX_HOME.length > 0) {
    return process.env.CODEX_HOME;
  }
  if (process.env.HOME && process.env.HOME.length > 0) {
    return join(process.env.HOME, '.codex');
  }
  return null;
};

const buildSourceState = (params: {
  path: string;
  exists: boolean;
  parsed: boolean;
  generatedAt?: string | null;
  error?: string | null;
}): StudioSourceState => ({
  path: params.path,
  exists: params.exists,
  parsed: params.parsed,
  generatedAt: params.generatedAt ?? null,
  error: params.error ?? null,
});

const createMissingSourceState = (path: string): StudioSourceState =>
  buildSourceState({ path, exists: false, parsed: false });

const createUnavailableSourceState = (params: { path: string; reason: string }): StudioSourceState =>
  buildSourceState({
    path: params.path,
    exists: false,
    parsed: false,
    error: params.reason,
  });

const hasErrors = (issues: readonly { level: string }[]): boolean => issues.some((issue) => issue.level === 'error');

const hasWarnings = (issues: readonly { level: string }[]): boolean => issues.some((issue) => issue.level === 'warning');

const getTrustWarning = (status: ProjectLayerContextDocument['status']): string | null => {
  if (status === 'Reserved') {
    return 'Reserved document is not current decision-making evidence.';
  }
  if (status === 'Draft') {
    return 'Draft document requires review before use as decision-making evidence.';
  }
  if (status === 'Archived') {
    return 'Archived document is historical record and should not guide current operation.';
  }
  return null;
};

// ----- project snapshot -----

const readProjectManifestSnapshot = (basePath: string): ProjectManifestReadResult => {
  const manifestPath = resolveProjectLayerManifestPath(basePath);
  if (!existsSync(manifestPath)) {
    return {
      source: createMissingSourceState(PROJECT_LAYER_MANIFEST_RELATIVE_PATH),
      manifest: null,
    };
  }

  try {
    const manifest = readProjectLayerManifest(basePath);
    return {
      source: buildSourceState({
        path: PROJECT_LAYER_MANIFEST_RELATIVE_PATH,
        exists: true,
        parsed: manifest !== null,
        generatedAt: manifest?.generatedAt ?? null,
      }),
      manifest,
    };
  } catch (error) {
    return {
      source: buildSourceState({
        path: PROJECT_LAYER_MANIFEST_RELATIVE_PATH,
        exists: true,
        parsed: false,
        error: getErrorMessage(error),
      }),
      manifest: null,
    };
  }
};

const readProjectContextIndexSnapshot = (basePath: string): ProjectContextIndexReadResult => {
  const contextIndexPath = resolveProjectLayerContextIndexPath(basePath);
  if (!existsSync(contextIndexPath)) {
    return {
      source: createMissingSourceState(PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH),
      contextIndex: null,
    };
  }

  try {
    const parsedJson: unknown = JSON.parse(readFileSync(contextIndexPath, 'utf-8'));
    const strictContextIndex = ProjectLayerContextIndexSchema.safeParse(parsedJson);
    if (strictContextIndex.success) {
      return {
        source: buildSourceState({
          path: PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
          exists: true,
          parsed: true,
          generatedAt: strictContextIndex.data.generatedAt,
        }),
        contextIndex: strictContextIndex.data,
      };
    }

    const recoverableContextIndex = RecoverableContextIndexSchema.safeParse(parsedJson);
    if (!recoverableContextIndex.success) {
      return {
        source: buildSourceState({
          path: PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
          exists: true,
          parsed: false,
          error: strictContextIndex.error.message,
        }),
        contextIndex: null,
      };
    }

    const documents = recoverableContextIndex.data.documents.flatMap((document): ProjectLayerContextDocument[] => {
      const parsedDocument = RecoverableContextDocumentSchema.safeParse(document);
      return parsedDocument.success ? [parsedDocument.data] : [];
    });

    return {
      source: buildSourceState({
        path: PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
        exists: true,
        parsed: false,
        generatedAt: recoverableContextIndex.data.generatedAt,
        error: strictContextIndex.error.message,
      }),
      contextIndex: {
        schemaVersion: 1,
        kind: 'context-layer-index',
        documents,
        generatedAt: recoverableContextIndex.data.generatedAt,
      },
    };
  } catch (error) {
    return {
      source: buildSourceState({
        path: PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
        exists: true,
        parsed: false,
        error: getErrorMessage(error),
      }),
      contextIndex: null,
    };
  }
};

const readDocsStatusSourceState = (basePath: string): StudioSourceState => {
  const docsStatusPath = resolveProjectLayerFilePath(basePath, DOCS_STATUS_RELATIVE_PATH);
  if (!existsSync(docsStatusPath)) {
    return createMissingSourceState(DOCS_STATUS_RELATIVE_PATH);
  }

  try {
    parseProjectLayerDocument(DOCS_STATUS_RELATIVE_PATH, readFileSync(docsStatusPath, 'utf-8'));
    return buildSourceState({
      path: DOCS_STATUS_RELATIVE_PATH,
      exists: true,
      parsed: true,
    });
  } catch (error) {
    return buildSourceState({
      path: DOCS_STATUS_RELATIVE_PATH,
      exists: true,
      parsed: false,
      error: getErrorMessage(error),
    });
  }
};

const buildDocumentProvenance = (
  manifest: ProjectLayerManifest | null,
  path: string,
): StudioProjectDocumentProvenance => {
  if (manifest?.managed_files.some((file) => file.path === path) === true) {
    return 'ai-ops-managed';
  }
  if (manifest?.project_files.some((file) => file.path === path) === true) {
    return 'project-owned';
  }
  if (manifest?.packs.some((pack) => pack.documents.some((document) => document.path === path)) === true) {
    return 'pack-document';
  }
  return 'context-only';
};

const buildDocumentReadError = (code: string, message: string): string => `${code}: ${message}`;

const buildProjectDocumentSnapshot = (params: {
  basePath: string;
  indexed: ProjectLayerContextDocument;
  provenance: StudioProjectDocumentProvenance;
}): StudioProjectDocument => {
  let absolutePath: string;
  try {
    absolutePath = resolveProjectLayerFilePath(params.basePath, params.indexed.path);
  } catch (error) {
    return {
      path: params.indexed.path,
      status: params.indexed.status,
      layer: params.indexed.layer,
      owner: params.indexed.owner,
      read_when: params.indexed.read_when,
      update_when: params.indexed.update_when,
      indexedContentHash: params.indexed.contentHash,
      currentContentHash: null,
      contentHashMatches: null,
      provenance: params.provenance,
      content: null,
      trustWarning: getTrustWarning(params.indexed.status),
      readError: buildDocumentReadError('unsafe-path', getErrorMessage(error)),
    };
  }

  if (!existsSync(absolutePath)) {
    return {
      path: params.indexed.path,
      status: params.indexed.status,
      layer: params.indexed.layer,
      owner: params.indexed.owner,
      read_when: params.indexed.read_when,
      update_when: params.indexed.update_when,
      indexedContentHash: params.indexed.contentHash,
      currentContentHash: null,
      contentHashMatches: null,
      provenance: params.provenance,
      content: null,
      trustWarning: getTrustWarning(params.indexed.status),
      readError: buildDocumentReadError('missing-file', `파일 없음: ${params.indexed.path}`),
    };
  }

  try {
    const document = parseProjectLayerDocument(params.indexed.path, readFileSync(absolutePath, 'utf-8'));
    return {
      path: params.indexed.path,
      status: params.indexed.status,
      layer: params.indexed.layer,
      owner: params.indexed.owner,
      read_when: params.indexed.read_when,
      update_when: params.indexed.update_when,
      indexedContentHash: params.indexed.contentHash,
      currentContentHash: document.contentHash,
      contentHashMatches: document.contentHash === params.indexed.contentHash,
      provenance: params.provenance,
      content: document.content,
      trustWarning: getTrustWarning(params.indexed.status),
      readError: null,
    };
  } catch (error) {
    return {
      path: params.indexed.path,
      status: params.indexed.status,
      layer: params.indexed.layer,
      owner: params.indexed.owner,
      read_when: params.indexed.read_when,
      update_when: params.indexed.update_when,
      indexedContentHash: params.indexed.contentHash,
      currentContentHash: null,
      contentHashMatches: null,
      provenance: params.provenance,
      content: null,
      trustWarning: getTrustWarning(params.indexed.status),
      readError: buildDocumentReadError('invalid-frontmatter', getErrorMessage(error)),
    };
  }
};

const resolveProjectState = (params: {
  manifest: ProjectManifestReadResult;
  contextIndex: ProjectContextIndexReadResult;
  docsStatus: StudioSourceState;
  documents: readonly StudioProjectDocument[];
  hasAuditErrors: boolean;
}): StudioProjectSnapshot['state'] => {
  const isUninitialized = !params.manifest.source.exists && !params.contextIndex.source.exists;
  if (isUninitialized) {
    return 'uninitialized';
  }

  const hasParseError =
    (params.manifest.source.exists && !params.manifest.source.parsed) ||
    (params.contextIndex.source.exists && !params.contextIndex.source.parsed) ||
    (params.docsStatus.exists && !params.docsStatus.parsed);
  const hasDocumentReadError = params.documents.some((document) => document.readError !== null);
  if (hasParseError || params.hasAuditErrors || hasDocumentReadError) {
    return 'degraded';
  }

  return 'ready';
};

const buildProjectSnapshot = (basePath: string): StudioProjectSnapshot => {
  const root = resolve(basePath);
  const manifest = readProjectManifestSnapshot(root);
  const contextIndex = readProjectContextIndexSnapshot(root);
  const docsStatus = readDocsStatusSourceState(root);
  const auditReport = auditProjectLayer(root);
  const documents =
    contextIndex.contextIndex?.documents.map((indexed) =>
      buildProjectDocumentSnapshot({
        basePath: root,
        indexed,
        provenance: buildDocumentProvenance(manifest.manifest, indexed.path),
      }),
    ) ?? [];
  const auditHasErrors = hasErrors(auditReport.issues);

  return {
    root,
    state: resolveProjectState({
      manifest,
      contextIndex,
      docsStatus,
      documents,
      hasAuditErrors: auditHasErrors,
    }),
    files: {
      manifest: manifest.source,
      contextIndex: contextIndex.source,
      docsStatus,
    },
    audit: {
      currentSourceHash: auditReport.currentSourceHash,
      hasErrors: auditHasErrors,
      hasWarnings: hasWarnings(auditReport.issues),
      issues: auditReport.issues,
    },
    documents,
  };
};

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
      component.type === catalogComponent.type && getInstalledComponentId(component) === getCatalogComponentId(catalogComponent),
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

const buildIntegrationSnapshots = (installedIntegrations: readonly InstalledIntegration[]): StudioIntegrationSnapshot[] => {
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
    };
  } catch (error) {
    return {
      id: params.definition.id,
      statusMessage: params.definition.statusMessage,
      hooksPath,
      installed: false,
      error: getErrorMessage(error),
    };
  }
};

const buildRuntimeSnapshot = (params: {
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

// ----- public API -----

export const buildStudioSnapshot = (params: BuildStudioSnapshotParams): StudioSnapshot => {
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const userBasePath = params.userBasePath === undefined ? resolveDefaultUserBasePath() : params.userBasePath;
  const codexHomePath = params.codexHomePath === undefined ? resolveDefaultCodexHomePath() : params.codexHomePath;

  return StudioSnapshotSchema.parse({
    schemaVersion: 1,
    kind: 'ai-ops-studio-snapshot',
    generatedAt,
    cliVersion: params.cliVersion ?? getCliVersion(),
    project: buildProjectSnapshot(params.basePath),
    runtime: buildRuntimeSnapshot({
      userBasePath,
      codexHomePath,
    }),
  });
};
