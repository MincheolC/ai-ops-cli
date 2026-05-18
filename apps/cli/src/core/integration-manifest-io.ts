import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { IntegrationManifestSchema } from './schemas/index.js';
import type { InstalledIntegration, IntegrationId, IntegrationManifest } from './schemas/index.js';

export const INTEGRATION_MANIFEST_FILENAME = 'integrations-manifest.json';

export const parseIntegrationManifest = (json: string): IntegrationManifest =>
  IntegrationManifestSchema.parse(JSON.parse(json));

export const serializeIntegrationManifest = (manifest: IntegrationManifest): string =>
  JSON.stringify(manifest, null, 2) + '\n';

export const resolveIntegrationManifestPath = (userBasePath: string): string =>
  join(userBasePath, '.ai-ops', INTEGRATION_MANIFEST_FILENAME);

export const readIntegrationManifest = (manifestPath: string): IntegrationManifest | null => {
  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf-8');
  } catch {
    return null;
  }

  return parseIntegrationManifest(raw);
};

export const writeIntegrationManifest = (manifestPath: string, manifest: IntegrationManifest): void => {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, serializeIntegrationManifest(manifest), 'utf-8');
};

export const findInstalledIntegration = (
  integrations: readonly InstalledIntegration[],
  integrationId: IntegrationId,
): InstalledIntegration | undefined => integrations.find((integration) => integration.id === integrationId);

export const upsertInstalledIntegration = (
  integrations: readonly InstalledIntegration[],
  nextIntegration: InstalledIntegration,
): InstalledIntegration[] => [
  ...integrations.filter((integration) => integration.id !== nextIntegration.id),
  nextIntegration,
];

export const removeInstalledIntegration = (
  integrations: readonly InstalledIntegration[],
  integrationId: IntegrationId,
): InstalledIntegration[] => integrations.filter((integration) => integration.id !== integrationId);

export const writeUserIntegrationState = (params: {
  manifestPath: string;
  cliVersion: string;
  nextIntegration?: InstalledIntegration;
  removeIntegrationId?: IntegrationId;
}): void => {
  const previous = readIntegrationManifest(params.manifestPath);
  const integrations = params.removeIntegrationId
    ? removeInstalledIntegration(previous?.integrations ?? [], params.removeIntegrationId)
    : params.nextIntegration
      ? upsertInstalledIntegration(previous?.integrations ?? [], params.nextIntegration)
      : (previous?.integrations ?? []);

  if (integrations.length === 0) {
    rmSync(params.manifestPath, { force: true });
    return;
  }

  writeIntegrationManifest(params.manifestPath, {
    schemaVersion: 1,
    kind: 'ai-ops-integrations-manifest',
    integrations,
    cliVersion: params.cliVersion,
    generatedAt: new Date().toISOString(),
  });
};
