import type { PcDoneDraft } from './done-draft.js';

export type CreatePcDoneDraftResult = {
  draftPath: string;
  draft: PcDoneDraft;
};

export type FillPcDoneDraftInput = {
  completed?: readonly string[];
  verification?: readonly string[];
  remaining?: readonly string[];
  nextAction?: string;
  nextActionEvidence?: string;
  blockers?: readonly string[];
  durableContextDelta?: string | null;
};

export type FillPcDoneDraftResult = {
  draftPath: string;
  changed: boolean;
  draft: PcDoneDraft;
};

export type ApplyPcDoneDraftResult = {
  contextRoot: string;
  changedFiles: string[];
  committed: boolean;
  commitHash: string | null;
};

export type ApplyContext = {
  draft: PcDoneDraft;
  contextRoot: string;
  workspaceDir: string;
  workstreamPath: string;
  workspaceStatePath: string;
  backlogPath: string;
  dailyPath: string;
  draftPath: string;
  date: string;
  shortHead: string;
};

export type ContextFileContents = {
  workstream: string;
  workspaceState: string;
  backlog: string;
  daily: string;
};

export type ContextFileFallbacks = ContextFileContents;

export type FileUpdate = {
  path: string;
  content: string;
};

export type VerifiedApplyState = {
  workstreamPath: string;
  workspaceDir: string;
};
