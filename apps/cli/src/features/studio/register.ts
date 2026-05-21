import type { Command } from 'commander';
import { studioSnapshotCommand } from './commands.js';

export const registerStudioCommands = (program: Command): void => {
  const studioCommand = program.command('studio').description('ai-ops Studio read-only helpers');

  studioCommand
    .command('snapshot')
    .description('Studio read-only snapshot JSON 생성')
    .requiredOption('--json', 'JSON으로 출력')
    .action((opts: { json?: boolean }) => studioSnapshotCommand(opts));
};
