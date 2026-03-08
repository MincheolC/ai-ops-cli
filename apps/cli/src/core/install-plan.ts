import { join } from 'node:path';
import { wrapWithSection } from './managed-header.js';
import { TOOL_OUTPUT_MAP } from './tool-output.js';
import type { ToolId } from './tool-output.js';
import type { ToolRenderResult } from './renderer.js';

// Codex has no settings.json — plan directory convention must live in AGENTS.md
const CODEX_PLAN_BODY =
  '## Plan Snapshot (Plan mode only)\n\n' +
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

  if (toolId === 'codex' && renderResult.tool === 'codex') {
    const config = TOOL_OUTPUT_MAP['codex'];
    const actions: FileAction[] = [];

    // CODEX_PLAN_BODY is always written to root AGENTS.md regardless of whether global rules exist
    const rootContent = renderResult.rootContent
      ? renderResult.rootContent + '\n\n---\n\n' + CODEX_PLAN_BODY
      : CODEX_PLAN_BODY;

    actions.push({
      relativePath: join(config.dir, config.rootFileName),
      content: wrapWithSection(rootContent, meta),
    });

    if (renderResult.domainContent) {
      actions.push({
        relativePath: join(config.dir, config.domainFileName),
        content: wrapWithSection(renderResult.domainContent, meta),
      });
    }

    return actions;
  }

  if (toolId === 'gemini' && renderResult.tool === 'gemini') {
    const config = TOOL_OUTPUT_MAP['gemini'];
    const actions: FileAction[] = [];

    if (renderResult.rootContent) {
      actions.push({
        relativePath: join(config.dir, config.rootFileName),
        content: wrapWithSection(renderResult.rootContent, meta),
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
