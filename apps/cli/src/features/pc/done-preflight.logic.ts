import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { normalizePath, pathContains } from './markdown.js';
import { getPcHandoffStatus, readGitHead, resolveGitRoot } from './status.js';
import type { PcDoneDraft } from './done-draft.js';
import type { VerifiedApplyState } from './done-types.js';

export const assertInside = (params: { parent: string; child: string; label: string }): void => {
  if (!pathContains(params.parent, params.child)) {
    throw new Error(`${params.label} must be inside ${params.parent}`);
  }
};

export const pathsEqual = (left: string, right: string): boolean => {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  if (normalizedLeft === normalizedRight) {
    return true;
  }
  try {
    return realpathSync(normalizedLeft) === realpathSync(normalizedRight);
  } catch {
    return false;
  }
};

export const assertStatusMatchesDraft = (draft: PcDoneDraft, contextRoot: string): VerifiedApplyState => {
  const status = getPcHandoffStatus({
    cwd: draft.productGitRoot,
    contextRoot,
  });
  if (!status.ready) {
    throw new Error(`pc context is not ready: ${status.skipReason ?? 'unknown reason'}`);
  }
  if (status.workspaceId !== draft.workspaceId) {
    throw new Error(`workspace mismatch: draft=${draft.workspaceId}, current=${status.workspaceId ?? 'none'}`);
  }
  if (status.activeWorkstreamId !== draft.workstreamId) {
    throw new Error(`workstream mismatch: draft=${draft.workstreamId}, current=${status.activeWorkstreamId ?? 'none'}`);
  }
  if (status.currentEntryId !== draft.currentEntryId) {
    throw new Error(`current entry mismatch: draft=${draft.currentEntryId}, current=${status.currentEntryId ?? 'none'}`);
  }
  if (!status.activeWorkstreamPath) {
    throw new Error('pc context status is incomplete: active workstream path not found');
  }
  const workspaceDir = dirname(dirname(status.activeWorkstreamPath));
  if (!pathsEqual(workspaceDir, draft.workspaceDir)) {
    throw new Error(`workspace directory mismatch: draft=${draft.workspaceDir}, current=${workspaceDir}`);
  }
  if (
    status.lastConfirmedCommitHash !== draft.lastConfirmedCommitHash &&
    status.lastConfirmedCommitHash !== draft.productHead
  ) {
    throw new Error(
      `last confirmed commit changed: draft=${draft.lastConfirmedCommitHash ?? 'none'}, current=${
        status.lastConfirmedCommitHash ?? 'none'
      }`,
    );
  }
  return {
    workstreamPath: status.activeWorkstreamPath,
    workspaceDir,
  };
};

export const assertProductHeadMatchesDraft = (draft: PcDoneDraft): void => {
  const productGitRoot = resolveGitRoot(draft.productGitRoot);
  if (!productGitRoot || !pathsEqual(productGitRoot, draft.productGitRoot)) {
    throw new Error(`product git root mismatch: ${draft.productGitRoot}`);
  }
  const head = readGitHead(draft.productGitRoot);
  if (head !== draft.productHead) {
    throw new Error(`product HEAD changed: draft=${draft.productHead}, current=${head ?? 'none'}`);
  }
};
