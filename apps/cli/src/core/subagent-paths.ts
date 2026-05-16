import { join } from 'node:path';
import type { ToolId } from './tool-output.js';

const SUBAGENT_TOOL_OUTPUTS: Readonly<Record<ToolId, { dir: string; extension: string }>> = {
  'claude-code': {
    dir: '.claude/agents',
    extension: '.md',
  },
  codex: {
    dir: '.codex/agents',
    extension: '.toml',
  },
  gemini: {
    dir: '.gemini/agents',
    extension: '.md',
  },
} as const;

export const buildSubagentRelativePath = (subagentId: string, toolId: ToolId): string => {
  const output = SUBAGENT_TOOL_OUTPUTS[toolId];
  return join(output.dir, `${subagentId}${output.extension}`);
};
