import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ContextPromotionReceiptIndexSchema, DEFAULT_PRUNE_MAX, RECEIPT_INDEX_FILENAME } from "./types.js";
import type { ContextPromotionReceipt, ContextPromotionReceiptIndex } from "./types.js";

// ----- receipt storage -----

export const resolveContextPromotionReceiptIndexPath = (params: { userBasePath: string; projectKey: string }): string =>
  join(params.userBasePath, '.ai-ops', 'context-promotion', 'projects', params.projectKey, RECEIPT_INDEX_FILENAME);

export const parseContextPromotionReceiptIndex = (json: string): ContextPromotionReceiptIndex =>
  ContextPromotionReceiptIndexSchema.parse(JSON.parse(json));

export const serializeContextPromotionReceiptIndex = (index: ContextPromotionReceiptIndex): string =>
  JSON.stringify(index, null, 2) + '\n';

export const readContextPromotionReceiptIndex = (indexPath: string): ContextPromotionReceiptIndex | null => {
  try {
    return parseContextPromotionReceiptIndex(readFileSync(indexPath, 'utf-8'));
  } catch {
    return null;
  }
};

const writeContextPromotionReceiptIndex = (indexPath: string, index: ContextPromotionReceiptIndex): void => {
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, serializeContextPromotionReceiptIndex(index), 'utf-8');
};

export const buildEmptyReceiptIndex = (params: { projectKey: string; projectRoot: string }): ContextPromotionReceiptIndex => ({
  schemaVersion: 1,
  kind: 'context-promotion-receipts',
  projectKey: params.projectKey,
  projectRoot: params.projectRoot,
  receipts: [],
});

const sortReceiptsByResolvedAtDesc = (receipts: readonly ContextPromotionReceipt[]): ContextPromotionReceipt[] =>
  [...receipts].sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt));

export const findContextPromotionReceipt = (params: {
  index: ContextPromotionReceiptIndex | null;
  fingerprint: string;
  commitHash: string;
}): ContextPromotionReceipt | null => {
  const receipts = params.index?.receipts ?? [];
  return (
    receipts.find((receipt) => receipt.commitHash === params.commitHash) ??
    receipts.find((receipt) => receipt.fingerprint === params.fingerprint) ??
    null
  );
};

export const upsertContextPromotionReceipt = (params: {
  indexPath: string;
  projectKey: string;
  projectRoot: string;
  receipt: ContextPromotionReceipt;
  maxReceipts?: number;
}): ContextPromotionReceiptIndex => {
  const previous = readContextPromotionReceiptIndex(params.indexPath);
  const index =
    previous?.projectKey === params.projectKey
      ? previous
      : buildEmptyReceiptIndex({ projectKey: params.projectKey, projectRoot: params.projectRoot });
  const remaining = index.receipts.filter((receipt) => {
    if (receipt.fingerprint === params.receipt.fingerprint) {
      return false;
    }
    if (params.receipt.commitHash && receipt.commitHash === params.receipt.commitHash) {
      return false;
    }
    return true;
  });
  const maxReceipts = params.maxReceipts ?? DEFAULT_PRUNE_MAX;
  const receipts = sortReceiptsByResolvedAtDesc([params.receipt, ...remaining]).slice(0, maxReceipts);
  const nextIndex = {
    ...index,
    projectRoot: params.projectRoot,
    receipts,
  };
  writeContextPromotionReceiptIndex(params.indexPath, nextIndex);
  return nextIndex;
};

export const pruneContextPromotionReceipts = (params: {
  indexPath: string;
  maxReceipts: number;
}): ContextPromotionReceiptIndex | null => {
  const index = readContextPromotionReceiptIndex(params.indexPath);
  if (!index) {
    return null;
  }

  const nextIndex = {
    ...index,
    receipts: sortReceiptsByResolvedAtDesc(index.receipts).slice(0, params.maxReceipts),
  };
  writeContextPromotionReceiptIndex(params.indexPath, nextIndex);
  return nextIndex;
};
