import { join } from 'node:path';
import { COMPILER_DATA_DIR } from '@/core/index.js';

export const resolveCompilerDataDir = (): string => COMPILER_DATA_DIR;

export const resolveRulesDir = (): string => join(COMPILER_DATA_DIR, 'rules');

export const resolvePresetsPath = (): string => join(COMPILER_DATA_DIR, 'presets.yaml');

// project-only 설치 기준 디렉토리
export const resolveBasePath = (): string => process.cwd();
