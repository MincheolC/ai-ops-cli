import { join } from 'node:path';
import { wrapWithHeader } from './managed-header.js';
import { TOOL_OUTPUT_MAP } from './tool-output.js';
import type { ToolId } from './tool-output.js';
import type { ToolRenderResult } from './renderer.js';

// Codex has no settings.json — plan directory convention must live in AGENTS.md
const CODEX_PLAN_SECTION =
  '\n\n---\n\n## Plan\n\nSave plans to `.codex/plans/<timestamp>-<topic>.md` when creating or updating plans in plan mode.';

export type FileAction = {
  relativePath: string;
  content: string;
};

export const buildInstallPlan = (params: {
  toolId: ToolId;
  renderResult: ToolRenderResult;
  meta: { sourceHash: string; generatedAt: string };
}): readonly FileAction[] => {
  const { toolId, renderResult, meta } = params;

  if (toolId === 'claude-code' && renderResult.tool === 'claude-code') {
    return renderResult.files.map(({ relativePath, content }) => ({
      relativePath,
      content: wrapWithHeader(content, meta),
    }));
  }

  if (
    (toolId === 'codex' && renderResult.tool === 'codex') ||
    (toolId === 'gemini' && renderResult.tool === 'gemini')
  ) {
    const config = TOOL_OUTPUT_MAP[toolId];
    const actions: FileAction[] = [];

    if (renderResult.rootContent) {
      const rootContent = toolId === 'codex' ? renderResult.rootContent + CODEX_PLAN_SECTION : renderResult.rootContent;
      actions.push({
        relativePath: join(config.dir, config.rootFileName),
        content: wrapWithHeader(rootContent, meta),
      });
    }

    if (renderResult.domainContent) {
      actions.push({
        relativePath: join(config.dir, config.domainFileName),
        content: wrapWithHeader(renderResult.domainContent, meta),
      });
    }

    return actions;
  }

  return [];
};
