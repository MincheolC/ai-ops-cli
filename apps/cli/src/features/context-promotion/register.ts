import type { Command } from 'commander';
import {
  contextPromotionPostToolUseHookCommand,
  contextPromotionPreToolUseHookCommand,
  contextPromotionPruneCommand,
  contextPromotionResolveCommand,
  contextPromotionStatusCommand,
} from './commands.js';

export const registerContextPromotionCommands = (program: Command): void => {
  const command = program.command('context-promotion').description('context promotion review receipt 관리');

  command
    .command('status')
    .description('현재 context promotion receipt 상태 확인')
    .option('--json', 'JSON으로 출력', false)
    .action((opts: { json?: boolean }) => contextPromotionStatusCommand(opts));

  command
    .command('resolve')
    .description('현재 HEAD 커밋에 대한 context promotion review receipt 기록')
    .requiredOption('--decision <decision>', 'promoted|no-promotion')
    .requiredOption('--summary <summary>', 'review 결정 요약')
    .option('--scope <scope...>', '승격 scope (core|project-local|global)')
    .option('--target <path...>', '승격 대상 파일 또는 자산')
    .action((opts: { decision?: string; summary?: string; scope?: string[]; target?: string[] }) =>
      contextPromotionResolveCommand(opts),
    );

  command
    .command('prune')
    .description('user-local context promotion receipts 정리')
    .option('--max <number>', '유지할 receipt 수', '50')
    .action((opts: { max?: string }) => contextPromotionPruneCommand(opts));

  const hookCommand = command.command('hook').description('Codex hook 내부 명령');
  hookCommand
    .command('pre-tool-use')
    .description('Deprecated no-op Codex PreToolUse hook entrypoint')
    .action(() => contextPromotionPreToolUseHookCommand());
  hookCommand
    .command('post-tool-use')
    .description('Codex PostToolUse hook entrypoint')
    .action(() => contextPromotionPostToolUseHookCommand());
};
