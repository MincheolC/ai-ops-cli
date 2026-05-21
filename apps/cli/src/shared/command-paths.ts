import { join } from 'node:path';
import { COMPILER_DATA_DIR } from './paths.js';

export const resolveCompilerDataDir = (): string => COMPILER_DATA_DIR;

export const resolveSkillsDir = (): string => join(COMPILER_DATA_DIR, 'skills');

export const resolveSubagentsDir = (): string => join(COMPILER_DATA_DIR, 'subagents');

export const resolvePacksDir = (): string => join(COMPILER_DATA_DIR, 'packs');

export const resolveIntegrationsDir = (): string => join(COMPILER_DATA_DIR, 'integrations');

export const resolveReferenceSkillsDir = (): string => join(resolveSkillsDir(), 'reference-skills');

export const resolveTaskSkillsDir = (): string => join(resolveSkillsDir(), 'task-skills');

export const resolveSkillCatalogPath = (): string => join(resolveSkillsDir(), 'skill-registry.json');

export const resolveIntegrationCatalogPath = (): string => join(resolveIntegrationsDir(), 'integration-registry.json');

// project-only 설치 기준 디렉토리
export const resolveBasePath = (): string => process.cwd();

export const resolveUserBasePath = (): string => {
  const userBasePath = process.env.AI_OPS_HOME ?? process.env.HOME;
  if (!userBasePath) {
    throw new Error('AI_OPS_HOME or HOME is required for user/global component commands');
  }
  return userBasePath;
};
