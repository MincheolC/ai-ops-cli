import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { COMPILER_DATA_DIR } from 'ai-ops-compiler';

export type Scope = 'project' | 'global';

export const resolveCompilerDataDir = (): string => COMPILER_DATA_DIR;

export const resolveRulesDir = (): string => join(COMPILER_DATA_DIR, 'rules');

export const resolvePresetsPath = (): string => join(COMPILER_DATA_DIR, 'presets.yaml');

// scope에 따른 설치 기준 디렉토리
export const resolveBasePath = (scope: Scope): string =>
  scope === 'global' ? resolve(homedir(), '.ai-ops') : process.cwd();
