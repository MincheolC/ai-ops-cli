import { ProjectLayerContextIndexSchema, ProjectLayerManifestSchema } from "@/core/schemas/index.js";
import type { ProjectLayerContextIndex, ProjectLayerManifest } from "@/core/schemas/index.js";

// ----- parsing and serialization -----

export const parseProjectLayerManifest = (json: string): ProjectLayerManifest =>
  ProjectLayerManifestSchema.parse(JSON.parse(json));

export const serializeProjectLayerManifest = (manifest: ProjectLayerManifest): string =>
  JSON.stringify(manifest, null, 2) + '\n';

export const parseProjectLayerContextIndex = (json: string): ProjectLayerContextIndex =>
  ProjectLayerContextIndexSchema.parse(JSON.parse(json));

export const serializeProjectLayerContextIndex = (contextIndex: ProjectLayerContextIndex): string =>
  JSON.stringify(contextIndex, null, 2) + '\n';
