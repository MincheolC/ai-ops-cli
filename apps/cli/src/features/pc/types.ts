// ----- types -----

export type PcWorkspaceEntry = {
  id: string;
  path: string | null;
  gitRoot: string | null;
};

export type PcHandoffStatus = {
  cwd: string;
  contextRoot: string;
  workspaceId: string | null;
  workspaceRoot: string | null;
  activeWorkstreamId: string | null;
  activeWorkstreamPath: string | null;
  currentEntryId: string | null;
  lastConfirmedCommitHash: string | null;
  ready: boolean;
  skipReason: string | null;
};

export type PcPostToolUseHookOutput = {
  decision: 'block';
  reason: string;
  hookSpecificOutput: {
    hookEventName: 'PostToolUse';
    additionalContext: string;
  };
};

export type PcWorkspaceCandidate = {
  id: string;
  statePath: string;
  workspaceDir: string;
  workspaceRoot: string;
  activeWorkstreamId: string | null;
};

// ----- path and markdown helpers -----
