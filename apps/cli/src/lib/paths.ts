import { join } from 'node:path';
import { COMPILER_DATA_DIR } from '@/core/index.js';

export const resolveCompilerDataDir = (): string => COMPILER_DATA_DIR;

export const resolveRulesDir = (): string => join(COMPILER_DATA_DIR, 'rules');

export const resolveSkillsDir = (): string => join(COMPILER_DATA_DIR, 'skills');

export const resolveSubagentsDir = (): string => join(COMPILER_DATA_DIR, 'subagents');

export const resolvePacksDir = (): string => join(COMPILER_DATA_DIR, 'packs');

export const resolveReferenceSkillsDir = (): string => join(resolveSkillsDir(), 'reference-skills');

export const resolveTaskSkillsDir = (): string => join(resolveSkillsDir(), 'task-skills');

export const resolveSkillCatalogPath = (): string => join(resolveSkillsDir(), 'skill-registry.json');

export const resolvePresetsPath = (): string => join(COMPILER_DATA_DIR, 'presets.yaml');

// project-only 설치 기준 디렉토리
export const resolveBasePath = (): string => process.cwd();

export const resolveUserBasePath = (): string => {
  const userBasePath = process.env.AI_OPS_HOME ?? process.env.HOME;
  if (!userBasePath) {
    throw new Error('AI_OPS_HOME or HOME is required for global asset commands');
  }
  return userBasePath;
};
