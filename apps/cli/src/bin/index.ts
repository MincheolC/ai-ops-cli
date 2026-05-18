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
import {
  contextPromotionPostToolUseHookCommand,
  contextPromotionPreToolUseHookCommand,
  contextPromotionPruneCommand,
  contextPromotionResolveCommand,
  contextPromotionStatusCommand,
} from '../commands/context-promotion.js';
import { codexHookInstallCommand, codexHookStatusCommand, codexHookUninstallCommand } from '../commands/codex-hook.js';
import {
  integrationInstallCommand,
  integrationListCommand,
  integrationPostToolUseHookCommand,
  integrationStatusCommand,
  integrationUninstallCommand,
} from '../commands/integration.js';
import { getCliVersion } from '../core/index.js';

const program = new Command();

program.name('ai-ops').description('AI agent operating layer manager').version(getCliVersion());

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

skillCommand
  .command('list')
  .description('사용 가능한 skill 목록')
  .action(() => skillListCommand());

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

subagentCommand
  .command('list')
  .description('사용 가능한 subagent 목록')
  .action(() => subagentListCommand());

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

packCommand
  .command('list')
  .description('사용 가능한 pack 목록')
  .action(() => packListCommand());

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

const contextPromotionCommand = program
  .command('context-promotion')
  .description('context promotion review receipt 관리');

contextPromotionCommand
  .command('status')
  .description('현재 context promotion receipt 상태 확인')
  .option('--json', 'JSON으로 출력', false)
  .action((opts: { json?: boolean }) => contextPromotionStatusCommand(opts));

contextPromotionCommand
  .command('resolve')
  .description('현재 HEAD 커밋에 대한 context promotion review receipt 기록')
  .requiredOption('--decision <decision>', 'promoted|no-promotion')
  .requiredOption('--summary <summary>', 'review 결정 요약')
  .option('--scope <scope...>', '승격 scope (core|project-local|global)')
  .option('--target <path...>', '승격 대상 파일 또는 자산')
  .action((opts: { decision?: string; summary?: string; scope?: string[]; target?: string[] }) =>
    contextPromotionResolveCommand(opts),
  );

contextPromotionCommand
  .command('prune')
  .description('user-local context promotion receipts 정리')
  .option('--max <number>', '유지할 receipt 수', '50')
  .action((opts: { max?: string }) => contextPromotionPruneCommand(opts));

const contextPromotionHookCommand = contextPromotionCommand.command('hook').description('Codex hook 내부 명령');

contextPromotionHookCommand
  .command('pre-tool-use')
  .description('Deprecated no-op Codex PreToolUse hook entrypoint')
  .action(() => contextPromotionPreToolUseHookCommand());

contextPromotionHookCommand
  .command('post-tool-use')
  .description('Codex PostToolUse hook entrypoint')
  .action(() => contextPromotionPostToolUseHookCommand());

const codexHookCommand = program.command('codex-hook').description('Codex hooks 설정 관리');

codexHookCommand
  .command('install <hookId>')
  .description('Codex hook 설치')
  .option('--command <command>', 'hook에 저장할 context-promotion 실행 명령')
  .action((hookId, opts: { command?: string }) => codexHookInstallCommand(hookId, opts));

codexHookCommand
  .command('status <hookId>')
  .description('Codex hook 설치 상태 확인')
  .action((hookId) => codexHookStatusCommand(hookId));

codexHookCommand
  .command('uninstall <hookId>')
  .description('Codex hook 제거')
  .action((hookId) => codexHookUninstallCommand(hookId));

const integrationCommand = program.command('integration').description('user/global runtime integration 설치/조회/제거');

integrationCommand
  .command('list')
  .description('사용 가능한 integration 목록')
  .action(() => integrationListCommand());

integrationCommand
  .command('install <integrationId>')
  .description('integration 설치')
  .option('--command <command>', 'Codex hook에 저장할 실행 명령')
  .action((integrationId, opts: { command?: string }) => integrationInstallCommand(integrationId, opts));

integrationCommand
  .command('status <integrationId>')
  .description('integration 설치 상태 확인')
  .action((integrationId) => integrationStatusCommand(integrationId));

integrationCommand
  .command('uninstall <integrationId>')
  .description('integration 제거')
  .action((integrationId) => integrationUninstallCommand(integrationId));

const integrationHookCommand = integrationCommand.command('hook').description('integration hook 내부 명령');

integrationHookCommand
  .command('post-tool-use <integrationId>')
  .description('Codex PostToolUse integration hook entrypoint')
  .action((integrationId) => integrationPostToolUseHookCommand(integrationId));

program.parse();
