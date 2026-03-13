import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SkillRegistrySchema } from './schemas/index.js';
import type { SkillRegistry } from './schemas/index.js';

export const SKILL_REGISTRY_FILENAME = 'skills-manifest.json';

export const parseSkillRegistry = (json: string): SkillRegistry => SkillRegistrySchema.parse(JSON.parse(json));

export const serializeSkillRegistry = (registry: SkillRegistry): string => JSON.stringify(registry, null, 2) + '\n';

export const resolveSkillRegistryPath = (userBasePath: string): string =>
  join(userBasePath, '.ai-ops', SKILL_REGISTRY_FILENAME);

export const readSkillRegistry = (registryPath: string): SkillRegistry | null => {
  let raw: string;
  try {
    raw = readFileSync(registryPath, 'utf-8');
  } catch {
    return null;
  }

  return parseSkillRegistry(raw);
};

export const writeSkillRegistry = (registryPath: string, registry: SkillRegistry): void => {
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, serializeSkillRegistry(registry), 'utf-8');
};
