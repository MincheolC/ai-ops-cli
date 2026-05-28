import type { ComponentProps } from 'react';
import type { Badge } from '@/components/ui/badge';
import type {
  ProjectAuditIssueView,
  ProjectDocumentStatus,
  ProjectDocumentView,
  ProjectSourceState,
} from '@/studio-bridge/project-view-model';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

export const getProjectStateBadge = (projectState: string): BadgeVariant => {
  if (projectState === 'ready') {
    return 'default';
  }
  if (projectState === 'degraded') {
    return 'destructive';
  }
  return 'secondary';
};

export const getStatusBadgeVariant = (status: ProjectDocumentStatus): BadgeVariant => {
  if (status === 'Active') {
    return 'default';
  }
  if (status === 'Draft') {
    return 'secondary';
  }
  if (status === 'Reserved') {
    return 'destructive';
  }
  return 'outline';
};

export const getAuditLevelBadgeVariant = (level: ProjectAuditIssueView['level']): BadgeVariant =>
  level === 'error' ? 'destructive' : 'secondary';

export const getSourceStateLabel = (source: ProjectSourceState): string => {
  if (source.exists === false) {
    return 'missing';
  }
  if (source.parsed === false) {
    return 'invalid';
  }
  if (source.exists === true && source.parsed === true) {
    return 'ready';
  }
  return 'unknown';
};

export const getHashMatchLabel = (document: ProjectDocumentView): string => {
  if (document.contentHashMatches === true) {
    return 'Matches index';
  }
  if (document.contentHashMatches === false) {
    return 'Hash mismatch';
  }
  return 'Not checked';
};
