import type { Command } from 'commander';
import {
  subagentDiffCommand,
  subagentInstallCommand,
  subagentListCommand,
  subagentUninstallCommand,
  subagentUpdateCommand,
} from './commands.js';

export const registerSubagentCommands = (program: Command): void => {
  const subagentCommand = program.command('subagent').description('에이전트 subagent 설치/조회/갱신');
  const applyInstallOptions = (command: Command): Command => command.option('--tool <tool...>', '대상 도구 지정');

  subagentCommand.command('list').description('사용 가능한 subagent 목록').action(() => subagentListCommand());
  applyInstallOptions(subagentCommand.command('install <subagentId>').description('subagent 설치')).action(
    (subagentId, opts) => subagentInstallCommand(subagentId, opts),
  );
  subagentCommand
    .command('diff [subagentId]')
    .description('subagent 변경 비교')
    .action((subagentId) => subagentDiffCommand(subagentId));
  subagentCommand
    .command('update [subagentId]')
    .description('subagent 갱신')
    .action((subagentId) => subagentUpdateCommand(subagentId));
  subagentCommand
    .command('uninstall <subagentId>')
    .description('subagent 제거')
    .action((subagentId) => subagentUninstallCommand(subagentId));
};
