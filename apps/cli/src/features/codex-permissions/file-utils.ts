import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { CodexSafePermissionFileStatus } from "./types.js";

// ----- shared helpers -----

const isNodeFileNotFoundError = (error: unknown): boolean => {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }
  return error.code === 'ENOENT';
};

export const readTextFileOrEmpty = (filePath: string): string => {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return '';
    }
    throw error;
  }
};

export const writeTextFile = (filePath: string, content: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
};

export const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readJsonRecord = (filePath: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!isJsonRecord(parsed)) {
      throw new Error('hooks.json must contain a JSON object');
    }
    return parsed;
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return {};
    }
    throw error;
  }
};

export const getArray = (record: Record<string, unknown>, key: string): unknown[] => {
  const existing = record[key];
  return Array.isArray(existing) ? existing : [];
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const stripBlock = (content: string, start: string, end: string): string => {
  const pattern = new RegExp(`\\n?${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'g');
  return content.replace(pattern, '\n').replace(/\n{3,}/g, '\n\n').trimStart();
};

export const hasBlock = (content: string, start: string, end: string): boolean => {
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  return pattern.test(content);
};

export const replaceOrAppendBlock = (content: string, start: string, end: string, block: string): string => {
  const cleanBlock = block.endsWith('\n') ? block : `${block}\n`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'g');
  if (pattern.test(content)) {
    return content.replace(pattern, cleanBlock);
  }
  const separator = content.trim().length > 0 && !content.endsWith('\n') ? '\n\n' : content.length > 0 ? '\n' : '';
  return `${content}${separator}${cleanBlock}`;
};

export const quoteTomlString = (value: string): string => JSON.stringify(value);

export const readActiveStringAssignment = (content: string, key: string): string | null => {
  for (const line of content.split('\n')) {
    if (line.trimStart().startsWith('#')) {
      continue;
    }
    const match = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`).exec(line);
    if (match) {
      return match[1];
    }
  }
  return null;
};

export const hasActiveTable = (content: string, tableName: string): boolean => {
  const tablePattern = new RegExp(`^\\s*\\[${escapeRegExp(tableName)}\\]\\s*(?:#.*)?$`);
  return content.split('\n').some((line) => !line.trimStart().startsWith('#') && tablePattern.test(line));
};

export const hasActiveTablePrefix = (content: string, tablePrefix: string): boolean => {
  const tablePattern = new RegExp(`^\\s*\\[${escapeRegExp(tablePrefix)}(?:\\.|\\])`);
  return content.split('\n').some((line) => !line.trimStart().startsWith('#') && tablePattern.test(line));
};

export const findTableRange = (lines: readonly string[], tableName: string): { start: number; end: number } | null => {
  const tablePattern = new RegExp(`^\\s*\\[${escapeRegExp(tableName)}\\]\\s*(?:#.*)?$`);
  const start = lines.findIndex((line) => tablePattern.test(line));
  if (start < 0) {
    return null;
  }
  const nextTable = lines.findIndex((line, index) => index > start && /^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(line));
  return {
    start,
    end: nextTable < 0 ? lines.length : nextTable,
  };
};

export const buildFileStatus = (params: {
  path: string;
  installed: boolean;
  changed: boolean;
  conflict: string | null;
}): CodexSafePermissionFileStatus => ({
  path: params.path,
  installed: params.installed,
  changed: params.changed,
  conflict: params.conflict,
});
