import type { Command } from 'commander';
import { pcDoneApplyCommand, pcDoneDraftCommand, pcDoneFillCommand, pcStatusCommand } from './commands.js';

const PC_HELP_TEXT = `

Workflow:
  $pc:todo is the read-only context reload skill path.
  $pc:done uses this CLI protocol for handoff writes:

    1. ai-ops pc done draft --cwd <product-repo>
    2. ai-ops pc done fill --draft <draft-path> --apply ...

  The CLI never calls an LLM. Codex supplies judgment through fill arguments;
  ai-ops applies, verifies, and commits only ~/.personal-project-contexts.
`;

const PC_DONE_HELP_TEXT = `

Draft/fill/apply protocol:
  draft creates a JSON skeleton under:
    ~/.personal-project-contexts/workspaces/<workspace-id>/.ai-ops/drafts/

  fill updates these AI fields before apply:
    completed, verification, remaining, nextAction, nextActionEvidence,
    blockers, durableContextDelta

  durableContextDelta is optional. Use it only when long-term workspace context
  actually changed and should be reflected in workspace-state.md.

Examples:
  ai-ops pc done draft --cwd /path/to/product-repo
  ai-ops pc done draft --from-hook --cwd /path/to/product-repo
  ai-ops pc done fill --draft /path/to/draft.json --completed "구현 완료" --verification "npm test" --remaining "smoke 확인" --next-action "다음 검증" --next-action-evidence "HEAD와 workstream이 일치함" --apply
  ai-ops pc done apply --draft ~/.personal-project-contexts/workspaces/demo/.ai-ops/drafts/pc-done-2026-05-28T010203000Z.json
`;

const collectOptionValue = (value: string, previous: string[] | undefined): string[] => [...(previous ?? []), value];

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
    .command('fill')
    .description('fill AI-authored $pc:done draft fields without editing the JSON directly')
    .requiredOption('--draft <draft-path>', 'draft JSON path inside ~/.personal-project-contexts')
    .option('--completed <text>', 'completed handoff item (repeatable)', collectOptionValue)
    .option('--verification <text>', 'verification handoff item (repeatable)', collectOptionValue)
    .option('--remaining <text>', 'remaining handoff item (repeatable)', collectOptionValue)
    .option('--next-action <text>', 'next first action')
    .option('--next-action-evidence <text>', 'evidence that the next action is current')
    .option('--blocker <text>', 'blocker or open question (repeatable)', collectOptionValue)
    .option('--durable-context-delta <text>', 'long-term context update when durable context changed')
    .option('--clear-durable-context-delta', 'clear durableContextDelta to null', false)
    .option('--apply', 'apply and commit the filled draft immediately', false)
    .action(
      (opts: {
        draft?: string;
        completed?: string[];
        verification?: string[];
        remaining?: string[];
        nextAction?: string;
        nextActionEvidence?: string;
        blocker?: string[];
        durableContextDelta?: string;
        clearDurableContextDelta?: boolean;
        apply?: boolean;
      }) => pcDoneFillCommand(opts),
    );

  doneCommand
    .command('apply')
    .description('apply a filled $pc:done draft to the context repo and commit it')
    .requiredOption('--draft <draft-path>', 'filled draft JSON path inside ~/.personal-project-contexts')
    .action((opts: { draft?: string }) => pcDoneApplyCommand(opts));
};
