import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH } from '../project-layer/index.js';
import {
  buildContextPromotionProjectKey,
  computeContextPromotionFingerprint,
  readGitHead,
  resolveContextPromotionGitRoot,
} from './git.js';
import {
  findContextPromotionReceipt,
  readContextPromotionReceiptIndex,
  resolveContextPromotionReceiptIndexPath,
  upsertContextPromotionReceipt,
} from './receipts.js';
import { CONTEXT_PROMOTION_DECISION, ContextPromotionReceiptSchema } from './types.js';
import type { ContextPromotionProjectStatus, ContextPromotionReceipt, ContextPromotionResolveInput } from './types.js';

// ----- status and resolve -----

export const hasContextPromotionLayer = (gitRoot: string): boolean =>
  existsSync(join(gitRoot, PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH));

export const getContextPromotionStatus = (params: {
  cwd: string;
  userBasePath: string;
}): ContextPromotionProjectStatus => {
  const cwd = resolve(params.cwd);
  const gitRoot = resolveContextPromotionGitRoot(cwd);
  if (!gitRoot) {
    return {
      cwd,
      gitRoot: null,
      hasContextLayer: false,
      projectKey: null,
      commitHash: null,
      fingerprint: null,
      receipt: null,
      receiptIndexPath: null,
    };
  }

  const hasContextLayer = hasContextPromotionLayer(gitRoot);
  const projectKey = buildContextPromotionProjectKey(gitRoot);
  const commitHash = readGitHead(gitRoot);
  const receiptIndexPath = resolveContextPromotionReceiptIndexPath({
    userBasePath: params.userBasePath,
    projectKey,
  });
  if (!hasContextLayer) {
    return {
      cwd,
      gitRoot,
      hasContextLayer,
      projectKey,
      commitHash,
      fingerprint: null,
      receipt: null,
      receiptIndexPath,
    };
  }

  const fingerprint = computeContextPromotionFingerprint(gitRoot);
  const index = readContextPromotionReceiptIndex(receiptIndexPath);

  return {
    cwd,
    gitRoot,
    hasContextLayer,
    projectKey,
    commitHash,
    fingerprint,
    receipt: findContextPromotionReceipt({ index, fingerprint, commitHash }),
    receiptIndexPath,
  };
};

export const buildContextPromotionReceipt = (params: {
  fingerprint: string;
  commitHash: string;
  input: ContextPromotionResolveInput;
  resolvedAt?: string;
}): ContextPromotionReceipt => {
  const summary = params.input.summary.trim();
  if (summary.length === 0) {
    throw new Error('summary is required');
  }

  if (params.input.decision === CONTEXT_PROMOTION_DECISION.PROMOTED && params.input.scopes.length === 0) {
    throw new Error('at least one scope is required for promoted decisions');
  }

  return ContextPromotionReceiptSchema.parse({
    fingerprint: params.fingerprint,
    commitHash: params.commitHash,
    decision: params.input.decision,
    scopes: [...params.input.scopes],
    targets: [...params.input.targets],
    summary,
    resolvedAt: params.resolvedAt ?? new Date().toISOString(),
  });
};

export const resolveContextPromotion = (params: {
  cwd: string;
  userBasePath: string;
  input: ContextPromotionResolveInput;
}): ContextPromotionProjectStatus => {
  const status = getContextPromotionStatus({ cwd: params.cwd, userBasePath: params.userBasePath });
  if (!status.gitRoot || !status.projectKey || !status.commitHash || !status.fingerprint || !status.receiptIndexPath) {
    throw new Error('git repository is required for context promotion receipts');
  }
  if (!status.hasContextLayer) {
    throw new Error('ai-ops context layer is required for context promotion receipts');
  }

  const receipt = buildContextPromotionReceipt({
    fingerprint: status.fingerprint,
    commitHash: status.commitHash,
    input: params.input,
  });
  upsertContextPromotionReceipt({
    indexPath: status.receiptIndexPath,
    projectKey: status.projectKey,
    projectRoot: status.gitRoot,
    receipt,
  });

  return getContextPromotionStatus({ cwd: params.cwd, userBasePath: params.userBasePath });
};
