import { Command } from 'commander';
import { initCommand } from '../commands/init.js';
import { updateCommand } from '../commands/update.js';
import { diffCommand } from '../commands/diff.js';
import { uninstallCommand } from '../commands/uninstall.js';

const program = new Command();

const ensureNoDeprecatedScopeFlag = (argv: readonly string[]): void => {
  if (argv.some((arg) => arg === '--scope' || arg.startsWith('--scope='))) {
    console.error('`--scope` is no longer supported. ai-ops is now project-only.');
    process.exit(1);
  }
};

program.name('ai-ops').description('AI 에이전트 규칙 스캐폴더').version('0.1.0');

program
  .command('init')
  .description('AI 규칙 초기 설치')
  .action(() => initCommand());

program
  .command('update')
  .description('기존 manifest 기반 규칙 갱신')
  .option('--force', '변경 없어도 강제 재설치', false)
  .action((opts: { force: boolean }) => updateCommand(opts));

program
  .command('diff')
  .description('설치된 규칙과 최신 소스 비교')
  .action(() => diffCommand());

program
  .command('uninstall')
  .description('설치된 규칙 파일 및 manifest 제거')
  .action(() => uninstallCommand());

ensureNoDeprecatedScopeFlag(process.argv);
program.parse();
