import type { Command } from 'commander';
import {
  integrationInstallCommand,
  integrationListCommand,
  integrationPostToolUseHookCommand,
  integrationStatusCommand,
  integrationUninstallCommand,
} from './commands.js';

export const registerIntegrationCommands = (program: Command): void => {
  const command = program.command('integration').description('user/global runtime integration 설치/조회/제거');

  command.command('list').description('사용 가능한 integration 목록').action(() => integrationListCommand());
  command
    .command('install <integrationId>')
    .description('integration 설치')
    .option('--command <command>', 'Codex hook에 저장할 실행 명령')
    .action((integrationId, opts: { command?: string }) => integrationInstallCommand(integrationId, opts));
  command.command('status <integrationId>').description('integration 설치 상태 확인').action((integrationId) =>
    integrationStatusCommand(integrationId),
  );
  command.command('uninstall <integrationId>').description('integration 제거').action((integrationId) =>
    integrationUninstallCommand(integrationId),
  );

  command
    .command('hook')
    .description('integration hook 내부 명령')
    .command('post-tool-use <integrationId>')
    .description('Codex PostToolUse integration hook entrypoint')
    .action((integrationId) => integrationPostToolUseHookCommand(integrationId));
};
