import { Command } from 'commander';
import { initCommand } from '../commands/init.js';
import { updateCommand } from '../commands/update.js';
import { diffCommand } from '../commands/diff.js';
import { auditCommand } from '../commands/audit.js';
import { uninstallCommand } from '../commands/uninstall.js';
import {
  skillDiffCommand,
  skillInstallCommand,
  skillListCommand,
  skillUninstallCommand,
  skillUpdateCommand,
} from '../commands/skill.js';
import { specInitCommand } from '../commands/spec.js';

const program = new Command();

program.name('ai-ops').description('AI 에이전트 규칙 스캐폴더').version('0.1.0');

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

program
  .command('diff')
  .description('project operating layer drift 비교')
  .action(() => diffCommand());

program
  .command('audit')
  .description('project operating layer 상태 검사')
  .action(() => auditCommand());

program
  .command('uninstall')
  .description('project operating layer 제거')
  .option('--yes', '확인 프롬프트 없이 제거', false)
  .action((opts: { yes?: boolean }) => uninstallCommand(opts));

const skillCommand = program.command('skill').description('에이전트 skill 설치/조회/갱신');

const applySkillScopeOptions = (command: Command): Command =>
  command
    .option('-g, --global', 'user scope에 설치/조회')
    .option('--project', 'project scope에 설치/조회')
    .option('--scope <scope>', 'explicit scope (user|project)')
    .option('--tool <tool...>', '대상 도구 지정');

applySkillScopeOptions(skillCommand.command('list').description('사용 가능한 skill 목록')).action((opts) =>
  skillListCommand(opts),
);

applySkillScopeOptions(skillCommand.command('install <skillId>').description('skill 설치')).action((skillId, opts) =>
  skillInstallCommand(skillId, opts),
);

applySkillScopeOptions(skillCommand.command('diff [skillId]').description('skill 변경 비교')).action((skillId, opts) =>
  skillDiffCommand(skillId, opts),
);

applySkillScopeOptions(skillCommand.command('update [skillId]').description('skill 갱신')).action((skillId, opts) =>
  skillUpdateCommand(skillId, opts),
);

applySkillScopeOptions(skillCommand.command('uninstall <skillId>').description('skill 제거')).action((skillId, opts) =>
  skillUninstallCommand(skillId, opts),
);

const specCommand = program.command('spec').description('spec 파이프라인 관리');

specCommand
  .command('init')
  .description('specs/ 디렉토리 구조 초기화')
  .option('--force', '이미 존재해도 강제 재생성', false)
  .action((opts: { force: boolean }) => specInitCommand(opts));

program.parse();
