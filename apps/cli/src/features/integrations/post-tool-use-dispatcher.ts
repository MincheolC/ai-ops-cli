import { INTEGRATION_ID } from '@/core/schemas/index.js';
import type { IntegrationId } from '@/core/schemas/index.js';
import { parseSuccessfulGitCommitPostToolUseHook } from '../codex-hooks/git-commit-hook.js';
import { evaluatePcSuccessfulGitCommitHook } from '../pc/hook.js';

type PostToolUseContinuationOutput = {
  decision: 'block';
  reason: string;
  hookSpecificOutput: {
    hookEventName: 'PostToolUse';
    additionalContext: string;
  };
};

type WorkflowResult = {
  workflow: IntegrationId;
  output: PostToolUseContinuationOutput;
};

const WORKFLOW_ORDER = [INTEGRATION_ID.PC] as const;

const isIntegrationWorkflow = (value: string): value is IntegrationId =>
  WORKFLOW_ORDER.includes(value as IntegrationId);

const normalizeWorkflows = (workflows: readonly string[]): IntegrationId[] => {
  const requested = new Set(workflows.filter(isIntegrationWorkflow));
  return WORKFLOW_ORDER.filter((workflow) => requested.has(workflow));
};

const parseWorkflowList = (workflows: string | undefined): IntegrationId[] => {
  const requested = (workflows ?? '')
    .split(',')
    .map((workflow) => workflow.trim())
    .filter((workflow) => workflow.length > 0);
  const unknown = requested.filter((workflow) => !isIntegrationWorkflow(workflow));
  if (unknown.length > 0) {
    throw new Error(`Unknown integration hook workflow: ${unknown.join(',')}`);
  }
  return normalizeWorkflows(requested);
};

const workflowLabel = (_workflow: IntegrationId): string => '$pc:done handoff';

const mergeWorkflowResults = (results: readonly WorkflowResult[]): PostToolUseContinuationOutput | null => {
  if (results.length === 0) {
    return null;
  }
  if (results.length === 1) {
    return results[0].output;
  }

  const prompt = [
    'Multiple ai-ops post-commit workflows need attention.',
    '',
    'Run these follow-ups in order. Complete the first before starting the next.',
    '',
    ...results.map((result, index) =>
      [`${index + 1}. ${workflowLabel(result.workflow)}`, '', result.output.reason].join('\n'),
    ),
  ].join('\n');

  return {
    decision: 'block',
    reason: prompt,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: prompt,
    },
  };
};

export const parseIntegrationPostToolUseWorkflows = (params: {
  legacyIntegrationId?: string;
  workflows?: string;
}): IntegrationId[] => {
  const requested = [
    ...parseWorkflowList(params.workflows),
    ...(params.legacyIntegrationId ? [params.legacyIntegrationId] : []),
  ];
  const workflows = normalizeWorkflows(requested);
  if (workflows.length === 0 && requested.length > 0) {
    throw new Error(`Unknown integration hook workflow: ${requested.join(',')}`);
  }
  return workflows;
};

export const evaluateIntegrationPostToolUseWorkflows = (params: {
  hookInput: unknown;
  workflows: readonly IntegrationId[];
  contextRoot?: string;
}): PostToolUseContinuationOutput | null => {
  const gitCommitHook = parseSuccessfulGitCommitPostToolUseHook(params.hookInput);
  if (!gitCommitHook) {
    return null;
  }

  const workflows = normalizeWorkflows(params.workflows);
  const results: WorkflowResult[] = [];
  if (workflows.includes(INTEGRATION_ID.PC)) {
    if (!params.contextRoot) {
      throw new Error('pc workflow requires a personal context root');
    }
    const output = evaluatePcSuccessfulGitCommitHook({
      gitCommitHook,
      contextRoot: params.contextRoot,
    });
    if (output) {
      results.push({ workflow: INTEGRATION_ID.PC, output });
    }
  }

  return mergeWorkflowResults(results);
};
