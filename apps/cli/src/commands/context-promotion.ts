import * as p from '@clack/prompts';
import {
  CONTEXT_PROMOTION_DECISION,
  CONTEXT_PROMOTION_SCOPE,
  evaluateContextPromotionPreToolUseHook,
  getContextPromotionStatus,
  pruneContextPromotionReceipts,
  readContextPromotionReceiptIndex,
  resolveContextPromotion,
} from '@/core/index.js';
import type { ContextPromotionDecision, ContextPromotionScope } from '@/core/index.js';
import { resolveBasePath, resolveUserBasePath } from '../lib/paths.js';

type ContextPromotionStatusOptions = {
  json?: boolean;
};

type ContextPromotionResolveOptions = {
  decision?: string;
  summary?: string;
  scope?: string[];
  target?: string[];
};

type ContextPromotionPruneOptions = {
  max?: string;
};

const VALID_DECISIONS = [
  CONTEXT_PROMOTION_DECISION.PROMOTED,
  CONTEXT_PROMOTION_DECISION.NO_PROMOTION,
] as const satisfies readonly ContextPromotionDecision[];

const VALID_SCOPES = [
  CONTEXT_PROMOTION_SCOPE.CORE,
  CONTEXT_PROMOTION_SCOPE.PROJECT_LOCAL,
  CONTEXT_PROMOTION_SCOPE.GLOBAL,
] as const satisfies readonly ContextPromotionScope[];

const parseDecision = (decision: string | undefined): ContextPromotionDecision => {
  const parsed = VALID_DECISIONS.find((candidate) => candidate === decision);
  if (parsed) {
    return parsed;
  }
  throw new Error(`decision must be one of: ${VALID_DECISIONS.join(', ')}`);
};

const parseScopes = (scopes: readonly string[] | undefined): ContextPromotionScope[] => {
  const requestedScopes = scopes ?? [];
  return requestedScopes.map((scope) => {
    const parsed = VALID_SCOPES.find((candidate) => candidate === scope);
    if (!parsed) {
      throw new Error(`scope must be one of: ${VALID_SCOPES.join(', ')}`);
    }
    return parsed;
  });
};

const parseMax = (max: string | undefined): number => {
  if (max === undefined) {
    return 50;
  }
  const parsed = Number.parseInt(max, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('max must be a positive integer');
  }
  return parsed;
};

const readStdin = async (): Promise<string> =>
  new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      raw += chunk;
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });

const reportContextPromotionError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  p.log.error(message);
  process.exitCode = 1;
};

export const contextPromotionStatusCommand = async (opts: ContextPromotionStatusOptions): Promise<void> => {
  try {
    const status = getContextPromotionStatus({
      cwd: resolveBasePath(),
      userBasePath: resolveUserBasePath(),
    });

    if (opts.json) {
      process.stdout.write(JSON.stringify(status, null, 2) + '\n');
      return;
    }

    p.intro('ai-ops context-promotion status');
    p.log.info(
      [
        `git root: ${status.gitRoot ?? 'not found'}`,
        `context layer: ${status.hasContextLayer ? 'found' : 'not found'}`,
        `fingerprint: ${status.fingerprint ?? 'not available'}`,
        `receipt: ${status.receipt ? 'found' : 'missing'}`,
        `receipt store: ${status.receiptIndexPath ?? 'not available'}`,
      ].join('\n'),
    );
    p.outro('ai-ops context-promotion status 완료');
  } catch (error) {
    reportContextPromotionError(error);
  }
};

export const contextPromotionResolveCommand = async (opts: ContextPromotionResolveOptions): Promise<void> => {
  p.intro('ai-ops context-promotion resolve');
  try {
    const nextStatus = resolveContextPromotion({
      cwd: resolveBasePath(),
      userBasePath: resolveUserBasePath(),
      input: {
        decision: parseDecision(opts.decision),
        summary: opts.summary ?? '',
        scopes: parseScopes(opts.scope),
        targets: opts.target ?? [],
      },
    });
    p.log.success(`receipt 기록 완료: ${nextStatus.fingerprint ?? 'unknown'}`);
  } catch (error) {
    reportContextPromotionError(error);
  }
  p.outro('ai-ops context-promotion resolve 완료');
};

export const contextPromotionPruneCommand = async (opts: ContextPromotionPruneOptions): Promise<void> => {
  p.intro('ai-ops context-promotion prune');
  try {
    const status = getContextPromotionStatus({
      cwd: resolveBasePath(),
      userBasePath: resolveUserBasePath(),
    });
    if (!status.receiptIndexPath) {
      p.log.warn('prune할 receipt store를 찾지 못했습니다.');
      p.outro('ai-ops context-promotion prune 완료');
      return;
    }

    const maxReceipts = parseMax(opts.max);
    const before = readContextPromotionReceiptIndex(status.receiptIndexPath)?.receipts.length ?? 0;
    const next = pruneContextPromotionReceipts({ indexPath: status.receiptIndexPath, maxReceipts });
    const after = next?.receipts.length ?? 0;
    p.log.success(`receipt prune 완료: ${before} -> ${after}`);
  } catch (error) {
    reportContextPromotionError(error);
  }
  p.outro('ai-ops context-promotion prune 완료');
};

export const contextPromotionPreToolUseHookCommand = async (): Promise<void> => {
  try {
    const raw = await readStdin();
    const hookInput = raw.trim().length > 0 ? JSON.parse(raw) : {};
    const output = evaluateContextPromotionPreToolUseHook({
      hookInput,
      userBasePath: resolveUserBasePath(),
    });
    if (output) {
      process.stdout.write(JSON.stringify(output) + '\n');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    process.stdout.write(
      JSON.stringify({
        systemMessage: `ai-ops context promotion hook skipped: ${message}`,
      }) + '\n',
    );
  }
};
