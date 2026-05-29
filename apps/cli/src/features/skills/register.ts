import type { Command } from 'commander';
import {
  skillDiffCommand,
  skillInstallCommand,
  skillListCommand,
  skillUninstallCommand,
  skillUpdateCommand,
} from './commands.js';

export const registerSkillCommands = (program: Command): void => {
  const skillCommand = program.command('skill').description('에이전트 skill 설치/조회/갱신');
  const applyInstallOptions = (command: Command): Command => command.option('--tool <tool...>', '대상 도구 지정');

  skillCommand.command('list').description('사용 가능한 skill 목록').action(() => skillListCommand());
  applyInstallOptions(skillCommand.command('install <skillId>').description('skill 설치')).action((skillId, opts) =>
    skillInstallCommand(skillId, opts),
  );
  skillCommand.command('diff [skillId]').description('skill 변경 비교').action((skillId) => skillDiffCommand(skillId));
  skillCommand.command('update [skillId]').description('skill 갱신').action((skillId) => skillUpdateCommand(skillId));
  skillCommand.command('uninstall <skillId>').description('skill 제거').action((skillId) => skillUninstallCommand(skillId));
};
