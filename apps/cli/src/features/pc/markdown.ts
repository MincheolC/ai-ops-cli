import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";

// ----- path and markdown helpers -----

export const normalizePath = (path: string): string => resolve(path.replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));

const realPathOrNull = (path: string): string | null => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

const realPathForContainment = (path: string): string | null => {
  const normalized = normalizePath(path);
  if (existsSync(normalized)) {
    return realPathOrNull(normalized);
  }

  let current = normalized;
  const missingSegments: string[] = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    missingSegments.unshift(basename(current));
    current = parent;
  }

  const realCurrent = realPathOrNull(current);
  return realCurrent ? resolve(realCurrent, ...missingSegments) : null;
};

const pathContainsNormalized = (parentPath: string, childPath: string): boolean =>
  childPath === parentPath || childPath.startsWith(`${parentPath}${sep}`);

export const pathContains = (parentPath: string, childPath: string): boolean => {
  const realParent = realPathForContainment(parentPath);
  const realChild = realPathForContainment(childPath);
  return realParent !== null && realChild !== null && pathContainsNormalized(realParent, realChild);
};

export const normalizeFieldValue = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0 || ['none', 'null', '-', '<empty>'].includes(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed.replace(/^`|`$/g, '');
};

export const extractSection = (content: string, headings: readonly string[]): string => {
  const headingPattern = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = new RegExp(`^##\\s+(?:${headingPattern})\\s*$`, 'mu').exec(content);
  if (!match) {
    return '';
  }
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = /^##\s+/mu.exec(rest);
  return nextHeading ? rest.slice(0, nextHeading.index) : rest;
};

export const parseListField = (content: string, labels: readonly string[]): string | null => {
  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`^-\\s+${escapedLabel}:\\s*(.+)$`, 'mu').exec(content);
    const value = normalizeFieldValue(match?.[1] ?? null);
    if (value) {
      return value;
    }
  }
  return null;
};

export const readTextFileOrNull = (filePath: string): string | null => {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
};

// ----- git helpers -----
