import { join } from 'node:path';
import { COMPILER_DATA_DIR } from '@/core/index.js';

export const resolveCompilerDataDir = (): string => COMPILER_DATA_DIR;

export const resolveRulesDir = (): string => join(COMPILER_DATA_DIR, 'rules');

export const resolveSkillsDir = (): string => join(COMPILER_DATA_DIR, 'skills');

export const resolvePresetsPath = (): string => join(COMPILER_DATA_DIR, 'presets.yaml');

// project-only 설치 기준 디렉토리
export const resolveBasePath = (): string => process.cwd();

export const resolveUserBasePath = (): string => process.env.AI_OPS_HOME ?? process.env.HOME ?? process.cwd();
