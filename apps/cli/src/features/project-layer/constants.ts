import { join } from 'node:path';
import { COMPILER_DATA_DIR } from '@/shared/paths.js';
import type { ProjectLayerTool } from '@/core/schemas/index.js';

// ----- constants -----

export const PROJECT_LAYER_MANIFEST_RELATIVE_PATH = '.ai-ops/manifest.json';
export const PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH = '.ai-ops/context-layer.json';
export const CUSTOM_PROJECT_RULES_DIR = 'docs/agent/project-rules';

export const CONTEXT_LAYER_DATA_DIR = join(COMPILER_DATA_DIR, 'context-layer');

export const TOOL_ORDER = ['codex', 'gemini', 'claude-code'] as const satisfies readonly ProjectLayerTool[];

export const DEFAULT_TOOLS = TOOL_ORDER;

export const TEMPLATE_PATHS = [
  'AGENTS.md',
  'GEMINI.md',
  'CLAUDE.md',
  'docs/agent/workflow.md',
  'docs/agent/terminology.md',
  'docs/agent/rules/00-agent-baseline.md',
  'docs/agent/rules/routing-rules.md',
  'docs/agent/rules/doc-update-rules.md',
  'docs/agent/rules/stop-rules.md',
  'docs/agent/checks/impact-checklist.md',
  'docs/agent/maps/codebase-map.md',
  'docs/business/terminology.md',
  'docs/business/business-rules.md',
  'docs/docs-status.md',
] as const;

export const PROJECT_OWNED_PATHS = new Set<string>([
  'docs/docs-status.md',
  'docs/agent/maps/codebase-map.md',
  'docs/business/terminology.md',
  'docs/business/business-rules.md',
]);

export const RESERVED_DOCUMENT_WARNINGS = [
  '판단 근거로 사용하지 마세요',
  'Do not use this document as current decision-making evidence',
] as const;
