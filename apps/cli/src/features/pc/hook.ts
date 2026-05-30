import { readGitHead, resolveGitRoot } from './status.js';
import { parseSuccessfulGitCommitPostToolUseHook } from '../codex-hooks/git-commit-hook.js';
import type { SuccessfulGitCommitPostToolUse } from '../codex-hooks/git-commit-hook.js';
import type { PcHandoffStatus, PcPostToolUseHookOutput } from './types.js';
import { getPcHandoffStatus } from './status.js';
import { pathContains } from './markdown.js';

// ----- hook output -----

const buildPcDonePrompt = (params: { status: PcHandoffStatus; head: string; gitRoot: string }): string =>
  [
    'A successful git commit just created a new HEAD commit.',
    '',
    'Run the `$pc:done` draft/apply workflow now to record the handoff for the active personal project context.',
    '',
    'Important guardrails:',
    '- Do not create or initialize a new pc context from this hook.',
    '- If `$pc:done` cannot match the prepared workspace, active workstream, or current repo scope, skip and briefly say why.',
    '- If the active workstream already records this HEAD as the last confirmed commit, skip without writing another handoff.',
    '- Do not modify the product repo for this hook.',
    '- Do not create temporary JS scripts or inline `node --input-type=module -e ...` editors for context files.',
    '- Use `ai-ops pc done draft --from-hook --cwd <project-git-root>`, then `ai-ops pc done fill --draft <draft-path> ... --apply`.',
    '- Prefer the fill command over editing the draft JSON directly so Codex does not need a patch-apply confirmation for the draft file.',
    '- `ai-ops pc done apply` may only update `~/.personal-project-contexts/` and commit that context repo.',
    '- Use the just-created HEAD commit as the newest evidence for completed work and the next first action.',
    '',
    `Draft command: ai-ops pc done draft --from-hook --cwd ${params.gitRoot}`,
    `Project git root: ${params.gitRoot}`,
    `HEAD: ${params.head}`,
    `pc context root: ${params.status.contextRoot}`,
    `pc workspace: ${params.status.workspaceId ?? 'unknown'} (${params.status.workspaceRoot ?? 'unknown'})`,
    `active workstream: ${params.status.activeWorkstreamId ?? 'unknown'}`,
    `current entry: ${params.status.currentEntryId ?? 'unknown'}`,
    `last confirmed commit: ${params.status.lastConfirmedCommitHash ?? 'none'}`,
  ].join('\n');

const buildPostToolUseOutput = (prompt: string): PcPostToolUseHookOutput => ({
  decision: 'block',
  reason: prompt,
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: prompt,
  },
});

export const evaluatePcSuccessfulGitCommitHook = (params: {
  gitCommitHook: SuccessfulGitCommitPostToolUse;
  contextRoot: string;
}): PcPostToolUseHookOutput | null => {
  const gitRoot = resolveGitRoot(params.gitCommitHook.cwd);
  if (!gitRoot) {
    return null;
  }
  if (pathContains(params.contextRoot, gitRoot)) {
    return null;
  }

  const head = readGitHead(gitRoot);
  if (!head) {
    return null;
  }

  const status = getPcHandoffStatus({
    cwd: params.gitCommitHook.cwd,
    contextRoot: params.contextRoot,
  });
  if (!status.ready) {
    return null;
  }
  if (status.lastConfirmedCommitHash === head) {
    return null;
  }

  return buildPostToolUseOutput(buildPcDonePrompt({ status, head, gitRoot }));
};

export const evaluatePcPostToolUseHook = (params: {
  hookInput: unknown;
  contextRoot: string;
}): PcPostToolUseHookOutput | null => {
  const gitCommitHook = parseSuccessfulGitCommitPostToolUseHook(params.hookInput);
  if (!gitCommitHook) {
    return null;
  }
  return evaluatePcSuccessfulGitCommitHook({
    gitCommitHook,
    contextRoot: params.contextRoot,
  });
};
