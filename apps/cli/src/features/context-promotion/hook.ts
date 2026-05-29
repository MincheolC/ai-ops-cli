import { getContextPromotionStatus } from './status.js';
import { parseSuccessfulGitCommitPostToolUseHook } from './tool-use-hook.js';
import type { SuccessfulGitCommitPostToolUse } from './tool-use-hook.js';
import type { ContextPromotionPostToolUseHookOutput, ContextPromotionProjectStatus } from './types.js';

// ----- hook guard -----

export const buildContextPromotionReviewPrompt = (status: ContextPromotionProjectStatus): string => {
  const projectRoot = status.gitRoot ?? status.cwd;
  const cdCommand = `cd ${JSON.stringify(projectRoot)}`;

  return [
    'Context Promotion Review should run for the completed work commit and review-loop learnings.',
    '',
    `Project root: ${projectRoot}`,
    'This project root is authoritative for this review.',
    '',
    'Use the `context-promotion-review` skill to review the just-created HEAD commit plus current conversation/review-loop learnings for reusable operating knowledge.',
    '',
    'Scope boundary:',
    `- Before inspecting files, anchor shell work in the project root above. If needed, run \`${cdCommand}\` first.`,
    '- Do not inspect other repositories, parent directories, or earlier conversation workspaces.',
    '- Do not search the web or external documentation for this review.',
    '- If `AGENTS.md`, `docs/agent/*`, `docs/docs-status.md`, or other context-layer files are absent, report them as absent; do not substitute files from another repo.',
    '- Use only the just-created `HEAD` commit, current conversation/review-loop learnings, post-commit worktree state, and files under the project root.',
    '',
    'Review requirements:',
    '- Do not amend, rewrite, or mix changes into the work commit.',
    '- Inspect the post-commit worktree state before deciding: run `git status --short`, `git diff --name-only`, `git diff --cached --name-only`, and `git ls-files --others --exclude-standard`.',
    '- Inspect the completed commit before deciding: run `git show --stat HEAD`, `git show --name-only HEAD`, and `git show HEAD` when detail is needed.',
    '- Cross-check existing `AGENTS.md`, `docs/agent/*`, `docs/docs-status.md`, and `.ai-ops/context-layer.json` first.',
    '- Treat `already-covered` as valid only when the Active context layer already has the same agent behavior rule; plans, tests, README, runbooks, and operator docs are evidence, not automatic coverage.',
    '- Check whether user corrections, repeated review findings, command routines, dirty worktree, untracked files, changeset pollution, or staging-scope hygiene produced a reusable `project-local` candidate.',
    '- Before `no-promotion`, briefly report near-miss or discarded candidates with reasons.',
    '- Classify candidates as `core`, `project-local`, `global`, `already-covered`, or `no-promotion`.',
    '- Ask the user before editing any file.',
    '- If promotion is approved, edit only the approved context/global files, then stop for user inspection without committing.',
    '- After approved updates or a no-promotion/already-covered decision, run `ai-ops context-promotion resolve --decision <promoted|no-promotion> --summary "<summary>"` with any approved `--scope` and `--target` values.',
    '- Re-run `ai-ops context-promotion status` and confirm a receipt exists for the current HEAD.',
    '',
    `Project: ${projectRoot}`,
    `HEAD: ${status.commitHash ?? 'unknown'}`,
    `Fingerprint: ${status.fingerprint ?? 'unknown'}`,
  ].join('\n');
};

const buildContextPromotionStatusFailurePrompt = (cwd: string, error: unknown): string => {
  const message = error instanceof Error ? error.message : 'unknown error';
  return [
    'Context Promotion Review could not inspect the completed work commit.',
    '',
    'The work command has already finished; do not amend or rewrite it for this hook.',
    'Do not search the web or inspect another repository to repair this hook review.',
    '',
    'Run `ai-ops context-promotion status` to inspect the failure, then decide whether a manual promotion review is needed.',
    '',
    `Project cwd: ${cwd}`,
    `Error: ${message}`,
  ].join('\n');
};

const buildPostToolUseOutput = (prompt: string): ContextPromotionPostToolUseHookOutput => ({
  decision: 'block',
  reason: prompt,
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: prompt,
  },
});

export const evaluateContextPromotionSuccessfulGitCommitHook = (params: {
  gitCommitHook: SuccessfulGitCommitPostToolUse;
  userBasePath: string;
}): ContextPromotionPostToolUseHookOutput | null => {
  let status: ContextPromotionProjectStatus;
  try {
    status = getContextPromotionStatus({
      cwd: params.gitCommitHook.cwd,
      userBasePath: params.userBasePath,
    });
  } catch (error) {
    return buildPostToolUseOutput(buildContextPromotionStatusFailurePrompt(params.gitCommitHook.cwd, error));
  }

  if (!status.hasContextLayer || status.receipt) {
    return null;
  }

  return buildPostToolUseOutput(buildContextPromotionReviewPrompt(status));
};

export const evaluateContextPromotionPostToolUseHook = (params: {
  hookInput: unknown;
  userBasePath: string;
}): ContextPromotionPostToolUseHookOutput | null => {
  const gitCommitHook = parseSuccessfulGitCommitPostToolUseHook(params.hookInput);
  if (!gitCommitHook) {
    return null;
  }
  return evaluateContextPromotionSuccessfulGitCommitHook({
    gitCommitHook,
    userBasePath: params.userBasePath,
  });
};
