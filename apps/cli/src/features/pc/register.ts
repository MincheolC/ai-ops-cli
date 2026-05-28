import type { Command } from 'commander';
import { pcDoneApplyCommand, pcDoneDraftCommand, pcStatusCommand } from './commands.js';

const PC_HELP_TEXT = `

Workflow:
  $pc:todo is the read-only context reload skill path.
  $pc:done uses this CLI protocol for handoff writes:

    1. ai-ops pc done draft --cwd <product-repo>
    2. AI fills the generated JSON draft.
    3. ai-ops pc done apply --draft <draft-path>

  The CLI never calls an LLM. Codex supplies judgment by filling the draft JSON;
  ai-ops applies, verifies, and commits only ~/.personal-project-contexts.
`;

const PC_DONE_HELP_TEXT = `

Draft/apply protocol:
  draft creates a JSON skeleton under:
    ~/.personal-project-contexts/workspaces/<workspace-id>/.ai-ops/drafts/

  Fill these AI fields before apply:
    completed, verification, remaining, nextAction, nextActionEvidence,
    blockers, durableContextDelta

  durableContextDelta is optional. Use it only when long-term workspace context
  actually changed and should be reflected in workspace-state.md.

Examples:
  ai-ops pc done draft --cwd /path/to/product-repo
  ai-ops pc done draft --from-hook --cwd /path/to/product-repo
  ai-ops pc done apply --draft ~/.personal-project-contexts/workspaces/demo/.ai-ops/drafts/pc-done-2026-05-28T010203000Z.json
`;

export const registerPcCommands = (program: Command): void => {
  const command = program
    .command('pc')
    .description('personal project context workflow commands')
    .showHelpAfterError('Run ai-ops pc --help for pc workflow commands.')
    .addHelpText('after', PC_HELP_TEXT);

  command
    .command('status')
    .description('show current cwd pc workspace/workstream/current-entry readiness')
    .option('--cwd <path>', 'product repo/path to inspect')
    .action((opts: { cwd?: string }) => pcStatusCommand(opts));

  const doneCommand = command
    .command('done')
    .description('$pc:done draft/apply workflow')
    .showHelpAfterError('Run ai-ops pc done --help for draft/apply usage.')
    .addHelpText('after', PC_DONE_HELP_TEXT);

  doneCommand
    .command('draft')
    .description('create a $pc:done JSON draft for AI to fill')
    .option('--from-hook', 'mark that this draft was requested by a Codex PostToolUse hook', false)
    .option('--cwd <path>', 'product repo/path for matching pc workspace')
    .action((opts: { cwd?: string; fromHook?: boolean }) => pcDoneDraftCommand(opts));

  doneCommand
    .command('apply')
    .description('apply a filled $pc:done draft to the context repo and commit it')
    .requiredOption('--draft <draft-path>', 'filled draft JSON path inside ~/.personal-project-contexts')
    .action((opts: { draft?: string }) => pcDoneApplyCommand(opts));
};
