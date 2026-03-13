import * as p from '@clack/prompts';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPT_CANCELLED, type PromptCancelled } from './prompt-control.js';

const PRETTIER_IGNORE_CONTENT = `# CLAUDE
.claude/rules/
**/CLAUDE.md

# GEMINI
**/GEMINI.md

# CODEX
**/AGENTS.md
**/AGENTS.override.md

.ai-ops-manifest.json`;

const SECTION_START = '# ai-ops:start';
const SECTION_END = '# ai-ops:end';

const wrapSection = (content: string): string => `${SECTION_START}\n${content}\n${SECTION_END}`;

const hasAiOpsSection = (content: string): boolean => content.includes(SECTION_START) && content.includes(SECTION_END);

const replaceSection = (content: string, newContent: string): string => {
  const lines = content.split('\n');
  const result: string[] = [];
  let inside = false;
  let replaced = false;

  for (const line of lines) {
    if (line.trim() === SECTION_START) {
      inside = true;
      result.push(wrapSection(newContent));
      replaced = true;
      continue;
    }
    if (line.trim() === SECTION_END) {
      inside = false;
      continue;
    }
    if (!inside) result.push(line);
  }

  if (!replaced) result.push(wrapSection(newContent));
  return result.join('\n');
};

const stripAiOpsSection = (content: string): string => {
  const lines = content.split('\n');
  const result: string[] = [];
  let inside = false;

  for (const line of lines) {
    if (line.trim() === SECTION_START) {
      inside = true;
      continue;
    }
    if (line.trim() === SECTION_END) {
      inside = false;
      continue;
    }
    if (!inside) result.push(line);
  }

  return result.join('\n');
};

export const promptPrettierIgnore = async (): Promise<boolean | PromptCancelled> => {
  const want = await p.confirm({
    message: '.prettierignore를 설치하시겠습니까? (VSCode Prettier 자동 포맷으로부터 AI 규칙 파일 보호)',
    initialValue: false,
  });
  if (p.isCancel(want)) return PROMPT_CANCELLED;
  return want;
};

export const installPrettierIgnore = (basePath: string): void => {
  const filePath = join(basePath, '.prettierignore');
  const section = wrapSection(PRETTIER_IGNORE_CONTENT);

  if (!existsSync(filePath)) {
    writeFileSync(filePath, section + '\n', 'utf-8');
    return;
  }

  const existing = readFileSync(filePath, 'utf-8');

  if (hasAiOpsSection(existing)) {
    writeFileSync(filePath, replaceSection(existing, PRETTIER_IGNORE_CONTENT), 'utf-8');
    return;
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  writeFileSync(filePath, existing + separator + section + '\n', 'utf-8');
};

export type PrettierIgnoreUninstallStatus = 'deleted' | 'cleaned' | 'notFound';

export const uninstallPrettierIgnore = (basePath: string): PrettierIgnoreUninstallStatus => {
  const filePath = join(basePath, '.prettierignore');
  if (!existsSync(filePath)) return 'notFound';

  const existing = readFileSync(filePath, 'utf-8');
  if (!hasAiOpsSection(existing)) return 'notFound';

  const stripped = stripAiOpsSection(existing).trim();
  if (stripped.length === 0) {
    rmSync(filePath, { force: true });
    return 'deleted';
  }

  writeFileSync(filePath, stripped + '\n', 'utf-8');
  return 'cleaned';
};
