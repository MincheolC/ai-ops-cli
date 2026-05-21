import type { Command } from 'commander';
import {
  codexPermissionsInstallCommand,
  codexPermissionsPermissionRequestHookCommand,
  codexPermissionsStatusCommand,
  codexPermissionsUninstallCommand,
} from './commands.js';

export const registerCodexPermissionsCommands = (program: Command): void => {
  const command = program.command('codex-permissions').description('Codex safe permission 설정 관리');

  command.command('install <profile>').description('Codex safe permission profile 설치').action((profile) =>
    codexPermissionsInstallCommand(profile),
  );
  command.command('status <profile>').description('Codex safe permission profile 상태 확인').action((profile) =>
    codexPermissionsStatusCommand(profile),
  );
  command.command('uninstall <profile>').description('Codex safe permission profile 제거').action((profile) =>
    codexPermissionsUninstallCommand(profile),
  );

  const hookCommand = command.command('hook', { hidden: true }).description('Deprecated Codex permission hook 내부 명령');
  hookCommand
    .command('permission-request <profile>', { hidden: true })
    .description('Deprecated no-op Codex PermissionRequest hook entrypoint')
    .action((profile) => codexPermissionsPermissionRequestHookCommand(profile));
};
