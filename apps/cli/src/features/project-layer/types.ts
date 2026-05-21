// ----- types -----

import type {
  ProjectLayerContextDocument,
  ProjectLayerContextIndex,
  ProjectLayerFrontmatter,
  ProjectLayerManifest,
  ProjectLayerProjectFile,
} from '@/core/schemas/index.js';

export type ProjectLayerFileOwnership = 'managed' | 'project';

export type ProjectLayerTemplateSpec = {
  path: string;
  content: string;
  ownership: ProjectLayerFileOwnership;
  frontmatter: ProjectLayerFrontmatter;
  contentHash: string;
};

export type ProjectLayerInstallResult = {
  manifest: ProjectLayerManifest;
  contextIndex: ProjectLayerContextIndex;
  written: string[];
  appended: string[];
  createdProjectFiles: string[];
  refreshedProjectFiles: string[];
  preservedProjectFiles: string[];
};

export type ProjectLayerRemoveResult = {
  deleted: string[];
  cleaned: string[];
  preserved: string[];
  notFound: string[];
};

export type ProjectLayerIssueLevel = 'error' | 'warning';

export type ProjectLayerIssue = {
  level: ProjectLayerIssueLevel;
  code: string;
  message: string;
};

export type ProjectLayerReport = {
  currentSourceHash: string | null;
  issues: ProjectLayerIssue[];
};

export type DocsStatusEntry = {
  path: string;
  status: string;
  owner: string;
};

export type DocsStatusTableBounds = {
  headerIndex: number;
  dividerIndex: number;
  tableEndIndex: number;
};

export type ManagedInstallResult = {
  written: string[];
  appended: string[];
};

export type ProjectFileInstallResult = {
  records: ProjectLayerProjectFile[];
  created: string[];
  refreshed: string[];
  preserved: string[];
};

export type ProjectLayerDocumentReadResult = ProjectLayerContextDocument & {
  content: string;
};
