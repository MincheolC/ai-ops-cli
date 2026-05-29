import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { computeHash, getCliVersion } from "@/shared/source-hash.js";
import { ProjectLayerManifestSchema } from "@/core/schemas/index.js";
import type { ProjectLayerManifest, ProjectLayerPackRecord, ProjectLayerProjectFile, ProjectLayerTool } from "@/core/schemas/index.js";
import { hasAiOpsSection, hasLegacyHeader, replaceAiOpsSection, stripAiOpsSection, wrapWithSection } from "./managed-header.js";
import { computeProjectLayerSourceHash, loadProjectLayerTemplateSpecs } from "./templates.js";
import { parseProjectLayerDocument } from "./document.logic.js";
import { isCustomProjectRulePath } from "./custom-project-rules.js";
import { resolveProjectLayerFilePath } from "./path.util.js";
import { readProjectLayerManifest, refreshProjectLayerDerivedState, writeProjectLayerManifest } from "./state-io.js";
import { removeManagedProjectFile } from "./uninstall.logic.js";
import type { ManagedInstallResult, ProjectFileInstallResult, ProjectLayerInstallResult, ProjectLayerTemplateSpec } from "./types.js";

const installManagedFiles = (
  basePath: string,
  specs: readonly ProjectLayerTemplateSpec[],
  meta: { sourceHash: string; generatedAt: string },
): ManagedInstallResult => {
  const written: string[] = [];
  const appended: string[] = [];

  for (const spec of specs) {
    const absolutePath = resolveProjectLayerFilePath(basePath, spec.path);
    const wrappedContent = wrapWithSection(spec.content, meta);

    if (!existsSync(absolutePath)) {
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, wrappedContent + '\n', 'utf-8');
      written.push(spec.path);
      continue;
    }

    const existing = readFileSync(absolutePath, 'utf-8');
    if (hasAiOpsSection(existing)) {
      writeFileSync(absolutePath, replaceAiOpsSection(existing, wrappedContent), 'utf-8');
      const stripped = stripAiOpsSection(existing);
      (stripped.trim().length > 0 ? appended : written).push(spec.path);
      continue;
    }

    if (hasLegacyHeader(existing)) {
      writeFileSync(absolutePath, wrappedContent + '\n', 'utf-8');
      written.push(spec.path);
      continue;
    }

    writeFileSync(absolutePath, existing.trimEnd() + '\n\n' + wrappedContent + '\n', 'utf-8');
    appended.push(spec.path);
  }

  return { written, appended };
};

const installProjectFiles = (params: {
  basePath: string;
  specs: readonly ProjectLayerTemplateSpec[];
  previousProjectFiles?: readonly ProjectLayerProjectFile[];
}): ProjectFileInstallResult => {
  const records: ProjectLayerProjectFile[] = [];
  const created: string[] = [];
  const refreshed: string[] = [];
  const preserved: string[] = [];
  const previousByPath = new Map((params.previousProjectFiles ?? []).map((file) => [file.path, file]));

  for (const spec of params.specs) {
    const absolutePath = resolveProjectLayerFilePath(params.basePath, spec.path);
    const previous = previousByPath.get(spec.path);

    if (!existsSync(absolutePath)) {
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, spec.content + '\n', 'utf-8');
      created.push(spec.path);
      records.push({
        path: spec.path,
        templateHash: spec.contentHash,
        created: true,
      });
      continue;
    }

    const existingContent = readFileSync(absolutePath, 'utf-8').trimEnd();
    const existingHash = computeHash([existingContent]);

    if (previous?.created === true && existingHash === previous.templateHash) {
      if (existingHash !== spec.contentHash) {
        writeFileSync(absolutePath, spec.content + '\n', 'utf-8');
        refreshed.push(spec.path);
      } else {
        preserved.push(spec.path);
      }

      records.push({
        path: spec.path,
        templateHash: spec.contentHash,
        created: true,
      });
      continue;
    }

    preserved.push(spec.path);
    records.push({
      path: spec.path,
      templateHash: previous?.templateHash ?? spec.contentHash,
      created: previous?.created ?? false,
    });
  }

  const recordPaths = new Set(records.map((record) => record.path));
  for (const previous of params.previousProjectFiles ?? []) {
    if (recordPaths.has(previous.path) || isCustomProjectRulePath(previous.path)) {
      continue;
    }

    const absolutePath = resolveProjectLayerFilePath(params.basePath, previous.path);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const document = parseProjectLayerDocument(previous.path, readFileSync(absolutePath, 'utf-8'));
    if (document.owner !== 'project') {
      continue;
    }

    preserved.push(previous.path);
    records.push({
      path: previous.path,
      templateHash: previous.created ? previous.templateHash : document.contentHash,
      created: previous.created,
    });
    recordPaths.add(previous.path);
  }

  return { records, created, refreshed, preserved };
};

const buildProjectLayerManifest = (params: {
  tools: readonly ProjectLayerTool[];
  managedFiles: readonly string[];
  projectFiles: readonly ProjectLayerProjectFile[];
  packs: readonly ProjectLayerPackRecord[];
  sourceHash: string;
  cliVersion: string;
  generatedAt: string;
  settings?: Record<string, unknown>;
}): ProjectLayerManifest =>
  ProjectLayerManifestSchema.parse({
    schemaVersion: 1,
    kind: 'project-operating-layer',
    tools: [...params.tools],
    managed_files: params.managedFiles.map((path) => ({
      path,
      sourceHash: params.sourceHash,
    })),
    project_files: [...params.projectFiles],
    packs: [...params.packs],
    settings: params.settings ?? {},
    sourceHash: params.sourceHash,
    cliVersion: params.cliVersion,
    generatedAt: params.generatedAt,
  });

const retireUnselectedManagedFiles = (params: {
  basePath: string;
  previousManifest: ProjectLayerManifest | null;
  nextManagedPaths: readonly string[];
}): void => {
  if (!params.previousManifest) return;

  const nextManagedPathSet = new Set(params.nextManagedPaths);
  for (const file of params.previousManifest.managed_files) {
    if (!nextManagedPathSet.has(file.path)) {
      removeManagedProjectFile(params.basePath, file.path);
    }
  }
};

export const installProjectLayer = (params: {
  basePath: string;
  tools: readonly ProjectLayerTool[];
  previousManifest?: ProjectLayerManifest | null;
}): ProjectLayerInstallResult => {
  const previousManifest =
    params.previousManifest === undefined ? readProjectLayerManifest(params.basePath) : params.previousManifest;
  const specs = loadProjectLayerTemplateSpecs(params.tools);
  const sourceHash = computeProjectLayerSourceHash(specs);
  const generatedAt = new Date().toISOString();
  const managedSpecs = specs.filter((spec) => spec.ownership === 'managed');
  const projectSpecs = specs.filter((spec) => spec.ownership === 'project');
  const managedPaths = managedSpecs.map((spec) => spec.path);
  retireUnselectedManagedFiles({
    basePath: params.basePath,
    previousManifest,
    nextManagedPaths: managedPaths,
  });
  const managedResult = installManagedFiles(params.basePath, managedSpecs, { sourceHash, generatedAt });
  const projectResult = installProjectFiles({
    basePath: params.basePath,
    specs: projectSpecs,
    previousProjectFiles: previousManifest?.project_files,
  });
  const provisionalManifest = buildProjectLayerManifest({
    tools: params.tools,
    managedFiles: managedPaths,
    projectFiles: projectResult.records,
    packs: previousManifest?.packs ?? [],
    sourceHash,
    cliVersion: getCliVersion(),
    generatedAt,
    settings: previousManifest?.settings,
  });
  const { manifest, contextIndex } = refreshProjectLayerDerivedState({
    basePath: params.basePath,
    manifest: provisionalManifest,
    generatedAt,
  });

  writeProjectLayerManifest(params.basePath, manifest);

  return {
    manifest,
    contextIndex,
    written: managedResult.written,
    appended: managedResult.appended,
    createdProjectFiles: projectResult.created,
    refreshedProjectFiles: projectResult.refreshed,
    preservedProjectFiles: projectResult.preserved,
  };
};

export const updateProjectLayer = (params: {
  basePath: string;
  manifest: ProjectLayerManifest;
}): ProjectLayerInstallResult => {
  const specs = loadProjectLayerTemplateSpecs(params.manifest.tools);
  const sourceHash = computeProjectLayerSourceHash(specs);
  const generatedAt = new Date().toISOString();
  const managedSpecs = specs.filter((spec) => spec.ownership === 'managed');
  const projectSpecs = specs.filter((spec) => spec.ownership === 'project');
  const managedResult = installManagedFiles(params.basePath, managedSpecs, { sourceHash, generatedAt });
  const projectResult = installProjectFiles({
    basePath: params.basePath,
    specs: projectSpecs,
    previousProjectFiles: params.manifest.project_files,
  });
  const provisionalManifest = buildProjectLayerManifest({
    tools: params.manifest.tools,
    managedFiles: managedSpecs.map((spec) => spec.path),
    projectFiles: projectResult.records,
    packs: params.manifest.packs,
    sourceHash,
    cliVersion: getCliVersion(),
    generatedAt,
    settings: params.manifest.settings,
  });
  const { manifest, contextIndex } = refreshProjectLayerDerivedState({
    basePath: params.basePath,
    manifest: provisionalManifest,
    generatedAt,
  });

  writeProjectLayerManifest(params.basePath, manifest);

  return {
    manifest,
    contextIndex,
    written: managedResult.written,
    appended: managedResult.appended,
    createdProjectFiles: projectResult.created,
    refreshedProjectFiles: projectResult.refreshed,
    preservedProjectFiles: projectResult.preserved,
  };
};
