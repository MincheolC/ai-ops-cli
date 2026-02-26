export const TOOL_OUTPUT_MAP = {
  'claude-code': {
    mode: 'multi-file' as const,
    rulesDir: '.claude/rules',
    fileExtension: '.md',
  },
  codex: {
    mode: 'single-file' as const,
    fileName: 'AGENTS.md',
  },
  gemini: {
    mode: 'single-file' as const,
    fileName: 'GEMINI.md',
  },
} as const;

export type ToolId = keyof typeof TOOL_OUTPUT_MAP;
