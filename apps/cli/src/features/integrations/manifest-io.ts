import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { INTEGRATION_ID, InstalledIntegrationSchema, IntegrationManifestSchema } from '@/core/schemas/index.js';
import type { InstalledIntegration, IntegrationId, IntegrationManifest } from '@/core/schemas/index.js';

export const INTEGRATION_MANIFEST_FILENAME = 'integrations-manifest.json';

const RawIntegrationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('ai-ops-integrations-manifest'),
    integrations: z.array(z.unknown()),
    cliVersion: z.string().min(1),
    generatedAt: z.string().min(1),
  })
  .strict();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCurrentIntegrationId = (value: unknown): value is IntegrationId =>
  value === INTEGRATION_ID.CODE_REVIEW_GATE || value === INTEGRATION_ID.PC;

const parseCurrentInstalledIntegrations = (entries: readonly unknown[]): InstalledIntegration[] => {
  const integrations: InstalledIntegration[] = [];
  for (const entry of entries) {
    if (isRecord(entry) && typeof entry.id === 'string' && !isCurrentIntegrationId(entry.id)) {
      continue;
    }
    integrations.push(InstalledIntegrationSchema.parse(entry));
  }
  return integrations;
};

export const parseIntegrationManifest = (json: string): IntegrationManifest => {
  const parsed: unknown = JSON.parse(json);
  const current = IntegrationManifestSchema.safeParse(parsed);
  if (current.success) {
    return current.data;
  }

  const raw = RawIntegrationManifestSchema.parse(parsed);
  return {
    ...raw,
    integrations: parseCurrentInstalledIntegrations(raw.integrations),
  };
};

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
