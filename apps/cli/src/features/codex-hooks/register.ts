import type { Command } from 'commander';
import { codexHookInstallCommand, codexHookStatusCommand, codexHookUninstallCommand } from './commands.js';

export const registerCodexHookCommands = (program: Command): void => {
  const command = program.command('codex-hook').description('Codex hooks 설정 관리');

  command
    .command('install <hookId>')
    .description('Codex hook 설치')
    .option('--command <command>', 'hook에 저장할 context-promotion 실행 명령')
    .action((hookId, opts: { command?: string }) => codexHookInstallCommand(hookId, opts));
  command.command('status <hookId>').description('Codex hook 설치 상태 확인').action((hookId) => codexHookStatusCommand(hookId));
  command.command('uninstall <hookId>').description('Codex hook 제거').action((hookId) => codexHookUninstallCommand(hookId));
};
