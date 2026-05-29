import { getCliVersion } from "@/shared/source-hash.js";
import { StudioSnapshotSchema } from "@/core/schemas/index.js";
import type { StudioSnapshot } from "@/core/schemas/index.js";
import { buildProjectSnapshot } from "./project-snapshot.js";
import { buildRuntimeSnapshot } from "./runtime-snapshot.js";
import { resolveDefaultCodexHomePath, resolveDefaultUserBasePath } from "./snapshot-shared.js";
import type { BuildStudioSnapshotParams } from "./snapshot-shared.js";

export type { BuildStudioSnapshotParams } from "./snapshot-shared.js";
export { normalizeStudioProjectIssue } from "./issue-normalization.js";

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
