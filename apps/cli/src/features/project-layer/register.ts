import type { Command } from 'commander';
import { auditCommand } from './audit-command.js';
import { diffCommand } from './diff-command.js';
import { initCommand } from './init-command.js';
import {
  packDiffCommand,
  packInstallCommand,
  packListCommand,
  packUninstallCommand,
  packUpdateCommand,
} from './pack-command.js';
import { uninstallCommand } from './uninstall-command.js';
import { updateCommand } from './update-command.js';

export const registerProjectLayerCommands = (program: Command): void => {
  program
    .command('init')
    .description('project operating layer 초기 설치')
    .option('--tool <tool...>', '대상 도구 adapter 지정 (codex|gemini|claude-code)')
    .action((opts: { tool?: string[] }) => initCommand(opts));

  program
    .command('update')
    .description('project operating layer 갱신')
    .option('--force', '변경 없어도 강제 재설치', false)
    .action((opts: { force: boolean }) => updateCommand(opts));

  program.command('diff').description('project operating layer drift 비교').action(() => diffCommand());
  program.command('audit').description('project operating layer 상태 검사').action(() => auditCommand());

  program
    .command('uninstall')
    .description('project operating layer 제거')
    .option('--yes', '확인 프롬프트 없이 제거', false)
    .action((opts: { yes?: boolean }) => uninstallCommand(opts));

  const packCommand = program.command('pack').description('optional project operating layer pack 설치/조회/갱신');

  packCommand.command('list').description('사용 가능한 pack 목록').action(() => packListCommand());
  packCommand.command('install <packId>').description('pack 설치').action((packId) => packInstallCommand(packId));
  packCommand.command('diff [packId]').description('pack 변경 비교').action((packId) => packDiffCommand(packId));
  packCommand.command('update [packId]').description('pack 갱신').action((packId) => packUpdateCommand(packId));
  packCommand.command('uninstall <packId>').description('pack 제거').action((packId) => packUninstallCommand(packId));
};
