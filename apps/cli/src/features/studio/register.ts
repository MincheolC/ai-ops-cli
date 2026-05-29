import type { Command } from 'commander';
import { studioLaunchCommand, studioSnapshotCommand } from './commands.js';

export const registerStudioCommands = (program: Command): void => {
  const studioCommand = program
    .command('studio')
    .description('Launch ai-ops Studio or generate read-only Studio helpers')
    .argument('[project]', 'project root to inspect', '.')
    .action((project: string) => studioLaunchCommand({ project }));

  studioCommand
    .command('snapshot')
    .description('Studio read-only snapshot JSON 생성')
    .requiredOption('--json', 'JSON으로 출력')
    .action((opts: { json?: boolean }) => studioSnapshotCommand(opts));
};
