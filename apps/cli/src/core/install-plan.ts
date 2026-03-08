import { join } from 'node:path';
import { wrapWithSection } from './managed-header.js';
import { TOOL_OUTPUT_MAP } from './tool-output.js';
import type { ToolId } from './tool-output.js';
import type { ToolRenderResult } from './renderer.js';

// Codex has no settings.json — plan directory convention must live in AGENTS.md
const CODEX_PLAN_SECTION =
  '\n\n---\n\n## Plan Snapshot (Plan mode only)\n\n' +
  '- This rule applies only when `collaboration_mode=Plan`.\n' +
  '- Before implementation (file edits/creates, installs, commits), save the latest plan content to `.codex/plans/YYYYMMDD_<topic>.md`.\n' +
  '- In `Default` mode, do not automatically create or update plan files.';

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
      content: wrapWithSection(content, meta),
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
        content: wrapWithSection(rootContent, meta),
      });
    }

    if (renderResult.domainContent) {
      actions.push({
        relativePath: join(config.dir, config.domainFileName),
        content: wrapWithSection(renderResult.domainContent, meta),
      });
    }

    return actions;
  }

  return [];
};
