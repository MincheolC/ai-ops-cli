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
import {
  subagentDiffCommand,
  subagentInstallCommand,
  subagentListCommand,
  subagentUninstallCommand,
  subagentUpdateCommand,
} from '../commands/subagent.js';
import {
  packDiffCommand,
  packInstallCommand,
  packListCommand,
  packUninstallCommand,
  packUpdateCommand,
} from '../commands/pack.js';

const program = new Command();

program.name('ai-ops').description('AI agent operating layer manager').version('0.1.0');

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

const applySkillInstallOptions = (command: Command): Command => command.option('--tool <tool...>', '대상 도구 지정');

skillCommand.command('list').description('사용 가능한 skill 목록').action(() => skillListCommand());

applySkillInstallOptions(skillCommand.command('install <skillId>').description('skill 설치')).action((skillId, opts) =>
  skillInstallCommand(skillId, opts),
);

skillCommand
  .command('diff [skillId]')
  .description('skill 변경 비교')
  .action((skillId) => skillDiffCommand(skillId));

skillCommand
  .command('update [skillId]')
  .description('skill 갱신')
  .action((skillId) => skillUpdateCommand(skillId));

skillCommand
  .command('uninstall <skillId>')
  .description('skill 제거')
  .action((skillId) => skillUninstallCommand(skillId));

const subagentCommand = program.command('subagent').description('에이전트 subagent 설치/조회/갱신');

const applySubagentInstallOptions = (command: Command): Command => command.option('--tool <tool...>', '대상 도구 지정');

subagentCommand.command('list').description('사용 가능한 subagent 목록').action(() => subagentListCommand());

applySubagentInstallOptions(subagentCommand.command('install <subagentId>').description('subagent 설치')).action(
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

const packCommand = program.command('pack').description('optional project operating layer pack 설치/조회/갱신');

packCommand.command('list').description('사용 가능한 pack 목록').action(() => packListCommand());

packCommand
  .command('install <packId>')
  .description('pack 설치')
  .action((packId) => packInstallCommand(packId));

packCommand
  .command('diff [packId]')
  .description('pack 변경 비교')
  .action((packId) => packDiffCommand(packId));

packCommand
  .command('update [packId]')
  .description('pack 갱신')
  .action((packId) => packUpdateCommand(packId));

packCommand
  .command('uninstall <packId>')
  .description('pack 제거')
  .action((packId) => packUninstallCommand(packId));

program.parse();
