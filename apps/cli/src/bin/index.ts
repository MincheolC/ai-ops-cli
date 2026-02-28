import { Command } from 'commander';
import { initCommand } from '../commands/init.js';
import { updateCommand } from '../commands/update.js';
import { diffCommand } from '../commands/diff.js';
import type { Scope } from '../lib/paths.js';

const program = new Command();

program.name('ai-ops').description('AI 에이전트 규칙 스캐폴더').version('0.1.0');

program
  .command('init')
  .description('AI 규칙 초기 설치')
  .option('--scope <scope>', 'project | global', 'project')
  .action((opts: { scope: Scope }) => initCommand(opts));

program
  .command('update')
  .description('기존 manifest 기반 규칙 갱신')
  .option('--scope <scope>', 'project | global', 'project')
  .option('--force', '변경 없어도 강제 재설치', false)
  .action((opts: { scope: Scope; force: boolean }) => updateCommand(opts));

program
  .command('diff')
  .description('설치된 규칙과 최신 소스 비교')
  .option('--scope <scope>', 'project | global', 'project')
  .action((opts: { scope: Scope }) => diffCommand(opts));

program.parse();
