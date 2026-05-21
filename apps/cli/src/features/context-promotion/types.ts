import { z } from "zod";

// ----- types -----

export const CONTEXT_PROMOTION_DECISION = {
  PROMOTED: 'promoted',
  NO_PROMOTION: 'no-promotion',
} as const;

export const CONTEXT_PROMOTION_SCOPE = {
  CORE: 'core',
  PROJECT_LOCAL: 'project-local',
  GLOBAL: 'global',
} as const;

export const ContextPromotionDecisionSchema = z.union([
  z.literal(CONTEXT_PROMOTION_DECISION.PROMOTED),
  z.literal(CONTEXT_PROMOTION_DECISION.NO_PROMOTION),
]);

export const ContextPromotionScopeSchema = z.union([
  z.literal(CONTEXT_PROMOTION_SCOPE.CORE),
  z.literal(CONTEXT_PROMOTION_SCOPE.PROJECT_LOCAL),
  z.literal(CONTEXT_PROMOTION_SCOPE.GLOBAL),
]);

export const ContextPromotionReceiptSchema = z
  .object({
    fingerprint: z.string().regex(/^[a-f0-9]{16}$/),
    commitHash: z
      .string()
      .regex(/^(NO_HEAD|[a-f0-9]{40})$/)
      .optional(),
    decision: ContextPromotionDecisionSchema,
    scopes: z.array(ContextPromotionScopeSchema),
    targets: z.array(z.string().min(1)),
    summary: z.string().min(1),
    resolvedAt: z.string().min(1),
  })
  .strict();

export const ContextPromotionReceiptIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('context-promotion-receipts'),
    projectKey: z.string().regex(/^[a-f0-9]{12}$/),
    projectRoot: z.string().min(1),
    receipts: z.array(ContextPromotionReceiptSchema),
  })
  .strict();

export type ContextPromotionDecision = z.infer<typeof ContextPromotionDecisionSchema>;
export type ContextPromotionScope = z.infer<typeof ContextPromotionScopeSchema>;
export type ContextPromotionReceipt = z.infer<typeof ContextPromotionReceiptSchema>;
export type ContextPromotionReceiptIndex = z.infer<typeof ContextPromotionReceiptIndexSchema>;

export type ContextPromotionProjectStatus = {
  cwd: string;
  gitRoot: string | null;
  hasContextLayer: boolean;
  projectKey: string | null;
  commitHash: string | null;
  fingerprint: string | null;
  receipt: ContextPromotionReceipt | null;
  receiptIndexPath: string | null;
};

export type ContextPromotionResolveInput = {
  decision: ContextPromotionDecision;
  summary: string;
  scopes: readonly ContextPromotionScope[];
  targets: readonly string[];
};

export type ContextPromotionPostToolUseHookOutput = {
  decision: 'block';
  reason: string;
  hookSpecificOutput: {
    hookEventName: 'PostToolUse';
    additionalContext: string;
  };
};

// ----- constants -----

export const RECEIPT_INDEX_FILENAME = 'receipts-index.json';
export const DEFAULT_PRUNE_MAX = 50;
