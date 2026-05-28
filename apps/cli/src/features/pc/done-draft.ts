import { z } from 'zod';

export const PC_DONE_DRAFT_SCHEMA_VERSION = 'pc-done-draft.v1';

const FILLED_DRAFT_ERROR = 'draft must be filled before apply: nextAction and nextActionEvidence are required';

const PcDoneDraftSchema = z
  .object({
    schemaVersion: z.literal(PC_DONE_DRAFT_SCHEMA_VERSION),
    workspaceId: z.string().min(1),
    workstreamId: z.string().min(1),
    currentEntryId: z.string().min(1),
    contextRoot: z.string().min(1),
    workspaceDir: z.string().min(1),
    productGitRoot: z.string().min(1),
    productHead: z.string().regex(/^[a-f0-9]{40}$/),
    lastConfirmedCommitHash: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
    generatedAt: z.string().min(1),
    completed: z.array(z.string()),
    verification: z.array(z.string()),
    remaining: z.array(z.string()),
    nextAction: z.string(),
    nextActionEvidence: z.string(),
    blockers: z.array(z.string()),
    durableContextDelta: z.string().nullable().optional(),
    appliedAt: z.string().optional(),
  })
  .strict();

export type PcDoneDraft = z.infer<typeof PcDoneDraftSchema>;

const compactItems = (items: readonly string[]): string[] =>
  items.map((item) => item.trim()).filter((item) => item.length > 0);

export const normalizePcDoneDraft = (draft: PcDoneDraft): PcDoneDraft => ({
  ...draft,
  completed: compactItems(draft.completed),
  verification: compactItems(draft.verification),
  remaining: compactItems(draft.remaining),
  nextAction: draft.nextAction.trim(),
  nextActionEvidence: draft.nextActionEvidence.trim(),
  blockers: compactItems(draft.blockers),
  durableContextDelta: draft.durableContextDelta?.trim() || null,
});

export const parsePcDoneDraft = (value: unknown): PcDoneDraft => normalizePcDoneDraft(PcDoneDraftSchema.parse(value));

export const assertFilledPcDoneDraft = (draft: PcDoneDraft): void => {
  if (draft.nextAction.trim().length === 0 || draft.nextActionEvidence.trim().length === 0) {
    throw new Error(FILLED_DRAFT_ERROR);
  }
};
