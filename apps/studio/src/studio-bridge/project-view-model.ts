import { isRecord, type StudioSnapshotEnvelope } from './studio-snapshot';

// ----- types -----

export const PROJECT_DOCUMENT_STATUSES = ['Active', 'Draft', 'Reserved', 'Archived'] as const;

export type ProjectDocumentStatus = (typeof PROJECT_DOCUMENT_STATUSES)[number];

export type ProjectDocumentProvenance = 'ai-ops-managed' | 'project-owned' | 'pack-document' | 'context-only';

export type ProjectSourceState = {
  readonly path: string;
  readonly exists: boolean | null;
  readonly parsed: boolean | null;
  readonly generatedAt: string | null;
  readonly error: string | null;
};

export type ProjectDocumentView = {
  readonly path: string;
  readonly status: ProjectDocumentStatus;
  readonly layer: string;
  readonly owner: string;
  readonly readWhen: readonly string[];
  readonly updateWhen: readonly string[];
  readonly indexedContentHash: string;
  readonly currentContentHash: string | null;
  readonly contentHashMatches: boolean | null;
  readonly provenance: ProjectDocumentProvenance;
  readonly content: string | null;
  readonly trustWarning: string | null;
  readonly readError: string | null;
};

export type ProjectAuditIssueView = {
  readonly level: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
};

export type ProjectAuditView = {
  readonly currentSourceHash: string | null;
  readonly hasErrors: boolean;
  readonly hasWarnings: boolean;
  readonly issues: readonly ProjectAuditIssueView[];
};

export type ProjectDocumentCount = {
  readonly label: string;
  readonly count: number;
};

export type ContextGraphOwnerGroup = {
  readonly owner: string;
  readonly documents: readonly ProjectDocumentView[];
};

export type ContextGraphLayerGroup = {
  readonly layer: string;
  readonly owners: readonly ContextGraphOwnerGroup[];
};

export type ContextGraphStatusGroup = {
  readonly status: ProjectDocumentStatus;
  readonly layers: readonly ContextGraphLayerGroup[];
  readonly count: number;
};

export type ProjectViewModel = {
  readonly root: string;
  readonly state: string;
  readonly files: {
    readonly manifest: ProjectSourceState;
    readonly contextIndex: ProjectSourceState;
    readonly docsStatus: ProjectSourceState;
  };
  readonly audit: ProjectAuditView;
  readonly documents: readonly ProjectDocumentView[];
  readonly counts: {
    readonly byStatus: readonly ProjectDocumentCount[];
    readonly byLayer: readonly ProjectDocumentCount[];
    readonly byOwner: readonly ProjectDocumentCount[];
  };
  readonly graph: readonly ContextGraphStatusGroup[];
};

// ----- guards -----

const PROJECT_DOCUMENT_PROVENANCES = [
  'ai-ops-managed',
  'project-owned',
  'pack-document',
  'context-only',
] as const satisfies readonly ProjectDocumentProvenance[];

const isProjectDocumentStatus = (value: unknown): value is ProjectDocumentStatus =>
  typeof value === 'string' && PROJECT_DOCUMENT_STATUSES.includes(value as ProjectDocumentStatus);

const isProjectDocumentProvenance = (value: unknown): value is ProjectDocumentProvenance =>
  typeof value === 'string' && PROJECT_DOCUMENT_PROVENANCES.includes(value as ProjectDocumentProvenance);

// ----- field readers -----

const getString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const getNullableString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' ? value : null;
};

const getBoolean = (record: Record<string, unknown>, key: string): boolean | null => {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
};

const getStringArray = (record: Record<string, unknown>, key: string): readonly string[] => {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
};

// ----- builders -----

const createUnknownSourceState = (path: string): ProjectSourceState => ({
  path,
  exists: null,
  parsed: null,
  generatedAt: null,
  error: null,
});

const parseSourceState = (value: unknown, fallbackPath: string): ProjectSourceState => {
  if (!isRecord(value)) {
    return createUnknownSourceState(fallbackPath);
  }

  return {
    path: getString(value, 'path') ?? fallbackPath,
    exists: getBoolean(value, 'exists'),
    parsed: getBoolean(value, 'parsed'),
    generatedAt: getNullableString(value, 'generatedAt'),
    error: getNullableString(value, 'error'),
  };
};

const parseProjectDocument = (value: unknown): ProjectDocumentView | null => {
  if (!isRecord(value)) {
    return null;
  }

  const path = getString(value, 'path');
  const layer = getString(value, 'layer');
  const owner = getString(value, 'owner');
  const status = value.status;
  const indexedContentHash = getString(value, 'indexedContentHash');
  const provenance = value.provenance;

  if (
    path === null ||
    layer === null ||
    owner === null ||
    indexedContentHash === null ||
    !isProjectDocumentStatus(status) ||
    !isProjectDocumentProvenance(provenance)
  ) {
    return null;
  }

  return {
    path,
    status,
    layer,
    owner,
    readWhen: getStringArray(value, 'read_when'),
    updateWhen: getStringArray(value, 'update_when'),
    indexedContentHash,
    currentContentHash: getNullableString(value, 'currentContentHash'),
    contentHashMatches: getBoolean(value, 'contentHashMatches'),
    provenance,
    content: getNullableString(value, 'content'),
    trustWarning: getNullableString(value, 'trustWarning'),
    readError: getNullableString(value, 'readError'),
  };
};

const parseProjectDocuments = (project: Record<string, unknown>): readonly ProjectDocumentView[] => {
  const documents = project.documents;
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents.flatMap((document): ProjectDocumentView[] => {
    const parsed = parseProjectDocument(document);
    return parsed === null ? [] : [parsed];
  });
};

const parseAuditIssue = (value: unknown): ProjectAuditIssueView | null => {
  if (!isRecord(value)) {
    return null;
  }

  const level = value.level;
  const code = getString(value, 'code');
  const message = getString(value, 'message');
  if ((level !== 'error' && level !== 'warning') || code === null || message === null) {
    return null;
  }

  return {
    level,
    code,
    message,
  };
};

const parseAudit = (project: Record<string, unknown>): ProjectAuditView => {
  const audit = project.audit;
  if (!isRecord(audit)) {
    return {
      currentSourceHash: null,
      hasErrors: false,
      hasWarnings: false,
      issues: [],
    };
  }

  const issues = Array.isArray(audit.issues)
    ? audit.issues.flatMap((issue): ProjectAuditIssueView[] => {
        const parsed = parseAuditIssue(issue);
        return parsed === null ? [] : [parsed];
      })
    : [];

  return {
    currentSourceHash: getNullableString(audit, 'currentSourceHash'),
    hasErrors: getBoolean(audit, 'hasErrors') ?? issues.some((issue) => issue.level === 'error'),
    hasWarnings: getBoolean(audit, 'hasWarnings') ?? issues.some((issue) => issue.level === 'warning'),
    issues,
  };
};

const incrementCount = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

const toSortedCounts = (counts: Map<string, number>): readonly ProjectDocumentCount[] =>
  [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ label, count }));

const buildCounts = (documents: readonly ProjectDocumentView[]): ProjectViewModel['counts'] => {
  const statusCounts = new Map<string, number>(PROJECT_DOCUMENT_STATUSES.map((status) => [status, 0]));
  const layerCounts = new Map<string, number>();
  const ownerCounts = new Map<string, number>();

  for (const document of documents) {
    incrementCount(statusCounts, document.status);
    incrementCount(layerCounts, document.layer);
    incrementCount(ownerCounts, document.owner);
  }

  return {
    byStatus: PROJECT_DOCUMENT_STATUSES.map((status) => ({ label: status, count: statusCounts.get(status) ?? 0 })),
    byLayer: toSortedCounts(layerCounts),
    byOwner: toSortedCounts(ownerCounts),
  };
};

const groupByKey = <T>(items: readonly T[], getKey: (item: T) => string): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }
  return grouped;
};

const buildContextGraph = (documents: readonly ProjectDocumentView[]): readonly ContextGraphStatusGroup[] =>
  PROJECT_DOCUMENT_STATUSES.map((status) => {
    const statusDocuments = documents
      .filter((document) => document.status === status)
      .sort((a, b) => a.path.localeCompare(b.path));
    const layerGroups = [...groupByKey(statusDocuments, (document) => document.layer).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([layer, layerDocuments]): ContextGraphLayerGroup => {
        const owners = [...groupByKey(layerDocuments, (document) => document.owner).entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([owner, ownerDocuments]): ContextGraphOwnerGroup => ({
              owner,
              documents: ownerDocuments,
            }),
          );

        return {
          layer,
          owners,
        };
      });

    return {
      status,
      layers: layerGroups,
      count: statusDocuments.length,
    };
  });

// ----- public API -----

export const buildProjectViewModel = (snapshot: StudioSnapshotEnvelope): ProjectViewModel => {
  const project = snapshot.project;
  const files = isRecord(project.files) ? project.files : {};
  const documents = parseProjectDocuments(project);

  return {
    root: getString(project, 'root') ?? 'Unknown project',
    state: getString(project, 'state') ?? 'unknown',
    files: {
      manifest: parseSourceState(files.manifest, '.ai-ops/manifest.json'),
      contextIndex: parseSourceState(files.contextIndex, '.ai-ops/context-layer.json'),
      docsStatus: parseSourceState(files.docsStatus, 'docs/docs-status.md'),
    },
    audit: parseAudit(project),
    documents,
    counts: buildCounts(documents),
    graph: buildContextGraph(documents),
  };
};

export const selectProjectDocument = (
  documents: readonly ProjectDocumentView[],
  selectedPath: string | null,
): ProjectDocumentView | null =>
  documents.find((document) => document.path === selectedPath) ??
  documents.find((document) => document.status === 'Active') ??
  documents[0] ??
  null;
