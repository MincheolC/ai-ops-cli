import type { InstalledSubagent, ToolId } from '@/core/schemas/index.js';
import { SKILL_TOOL } from '@/core/schemas/index.js';
import { buildSubagentRelativePath } from '@/core/schemas/subagent-paths.js';

export const resolveRequestedSubagentTools = (params: {
  requested?: readonly string[];
  supported: readonly string[];
}): ToolId[] => {
  if (params.requested === undefined || params.requested.length === 0) {
    return [...params.supported] as ToolId[];
  }

  const supportedSet = new Set(params.supported);
  const invalid = params.requested.filter((tool) => !supportedSet.has(tool));
  if (invalid.length > 0) {
    throw new Error(`Unsupported tools requested: ${invalid.join(', ')}`);
  }

  return [...params.requested] as ToolId[];
};

const TOOL_ORDER = [SKILL_TOOL.CLAUDE_CODE, SKILL_TOOL.CODEX, SKILL_TOOL.GEMINI] as const;

export const mergeSubagentTools = (params: { existing?: readonly string[]; requested: readonly ToolId[] }): ToolId[] => {
  const merged = new Set([...(params.existing ?? []), ...params.requested]);
  return TOOL_ORDER.filter((tool) => merged.has(tool));
};

export const upsertInstalledSubagent = (
  installedSubagents: readonly InstalledSubagent[],
  nextSubagent: InstalledSubagent,
): InstalledSubagent[] => {
  const remaining = installedSubagents.filter((subagent) => subagent.id !== nextSubagent.id);
  return [...remaining, nextSubagent];
};

export const removeInstalledSubagent = (
  installedSubagents: readonly InstalledSubagent[],
  subagentId: string,
): InstalledSubagent[] => installedSubagents.filter((subagent) => subagent.id !== subagentId);

export const findInstalledSubagent = (
  installedSubagents: readonly InstalledSubagent[],
  subagentId: string,
): InstalledSubagent | undefined => installedSubagents.find((subagent) => subagent.id === subagentId);

export const resolveInstalledSubagentPaths = (installedSubagent: InstalledSubagent): string[] =>
  installedSubagent.tools.map((tool) => buildSubagentRelativePath(installedSubagent.id, tool));
