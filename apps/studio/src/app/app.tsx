import { useQuery, type QueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Archive,
  Blocks,
  BookOpenText,
  Cable,
  CheckCircle2,
  ChevronLeft,
  CircleDashed,
  FileText,
  FolderKanban,
  GitBranch,
  Hash,
  Loader2,
  Palette,
  RefreshCw,
  SearchCode,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StudioProviders } from './providers';
import {
  buildProjectViewModel,
  selectAuditIssue,
  selectProjectDocument,
  type ProjectAuditIssueGroup,
  type ProjectAuditIssueView,
  type ProjectDocumentCount,
  type ProjectDocumentStatus,
  type ProjectDocumentView,
  type ProjectSourceState,
  type ProjectViewModel,
} from '@/studio-bridge/project-view-model';
import {
  isRecord,
  loadStudioSnapshot,
  StudioSnapshotParseError,
  type StudioSnapshotEnvelope,
} from '@/studio-bridge/studio-snapshot';
import { useStudioShellStore, type StudioProjectView } from '@/stores/studio-shell-store';

type SnapshotLoader = () => Promise<StudioSnapshotEnvelope>;

type AppProps = {
  readonly snapshotLoader?: SnapshotLoader;
  readonly queryClient?: QueryClient;
};

type StudioShellProps = {
  readonly snapshotLoader: SnapshotLoader;
};

type NavDefinition = {
  readonly id: StudioProjectView;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly placeholder?: boolean;
};

type NavGroup = {
  readonly label: string;
  readonly items: readonly NavDefinition[];
};

type SnapshotErrorDisplay = {
  readonly title: string;
  readonly message: string;
};

type MarkdownAstNode = {
  readonly type?: unknown;
  children?: MarkdownAstNode[];
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Project',
    items: [
      { id: 'overview', label: 'Overview', icon: FolderKanban },
      { id: 'context-graph', label: 'Context Graph', icon: GitBranch },
      { id: 'documents', label: 'Documents', icon: FileText },
      { id: 'audit', label: 'Audit', icon: ShieldCheck },
    ],
  },
  {
    label: 'Placeholders',
    items: [
      { id: 'integrations', label: 'Integrations', icon: Blocks, placeholder: true },
      { id: 'skills', label: 'Skills', icon: Wrench, placeholder: true },
      { id: 'subagents', label: 'Subagents', icon: SearchCode, placeholder: true },
      { id: 'hooks', label: 'Hooks', icon: Cable, placeholder: true },
      { id: 'appearance', label: 'Appearance', icon: Palette, placeholder: true },
    ],
  },
];

type PlaceholderProjectView = Exclude<StudioProjectView, 'overview' | 'context-graph' | 'documents' | 'audit'>;

const PLACEHOLDER_VIEWS = [
  'integrations',
  'skills',
  'subagents',
  'hooks',
  'appearance',
] as const satisfies readonly PlaceholderProjectView[];

const PLACEHOLDER_COPY: Record<PlaceholderProjectView, string> = {
  integrations: 'Integration detail stays in a later phase.',
  skills: 'Skill detail stays in a later phase.',
  subagents: 'Subagent detail stays in a later phase.',
  hooks: 'Hook detail stays in a later phase.',
  appearance: 'Appearance controls stay in a later phase.',
};

const getStringField = (record: Record<string, unknown>, key: string, fallback: string): string => {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

const getBooleanField = (record: Record<string, unknown>, key: string): boolean | null => {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
};

const getAuditRecord = (project: Record<string, unknown>): Record<string, unknown> | null => {
  const audit = project.audit;
  return isRecord(audit) ? audit : null;
};

const getProjectState = (project: Record<string, unknown>): string => getStringField(project, 'state', 'unknown');

const getUnknownErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return 'Unknown Tauri command failure';
};

const getSnapshotErrorDisplay = (error: unknown): SnapshotErrorDisplay => {
  const message = getUnknownErrorMessage(error);

  if (error instanceof StudioSnapshotParseError) {
    return {
      title: 'Invalid snapshot JSON',
      message,
    };
  }

  if (message.includes('CLI build missing') || message.includes('Cannot find module')) {
    return {
      title: 'CLI build missing',
      message,
    };
  }

  return {
    title: 'Tauri command failure',
    message,
  };
};

const getProjectStateBadge = (projectState: string): ComponentProps<typeof Badge>['variant'] => {
  if (projectState === 'ready') {
    return 'default';
  }
  if (projectState === 'degraded') {
    return 'destructive';
  }
  return 'secondary';
};

const getStatusBadgeVariant = (status: ProjectDocumentStatus): ComponentProps<typeof Badge>['variant'] => {
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

const getAuditLevelBadgeVariant = (
  level: ProjectAuditIssueView['level'],
): ComponentProps<typeof Badge>['variant'] => (level === 'error' ? 'destructive' : 'secondary');

const getSourceStateLabel = (source: ProjectSourceState): string => {
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

const getHashMatchLabel = (document: ProjectDocumentView): string => {
  if (document.contentHashMatches === true) {
    return 'Matches index';
  }
  if (document.contentHashMatches === false) {
    return 'Hash mismatch';
  }
  return 'Not checked';
};

const isPlaceholderView = (
  view: StudioProjectView,
): view is PlaceholderProjectView => PLACEHOLDER_VIEWS.includes(view as PlaceholderProjectView);

const removeHtmlNodes = (node: MarkdownAstNode): void => {
  if (node.children === undefined) {
    return;
  }

  node.children = node.children.filter((child) => child.type !== 'html');
  for (const child of node.children) {
    removeHtmlNodes(child);
  }
};

const stripMarkdownHtml =
  () =>
  (tree: MarkdownAstNode): void => {
    removeHtmlNodes(tree);
  };

function App({ snapshotLoader = loadStudioSnapshot, queryClient }: AppProps): React.JSX.Element {
  return (
    <StudioProviders queryClient={queryClient}>
      <StudioShell snapshotLoader={snapshotLoader} />
    </StudioProviders>
  );
}

function StudioShell({ snapshotLoader }: StudioShellProps): React.JSX.Element {
  const selectedView = useStudioShellStore((state) => state.selectedView);
  const selectedDocumentPath = useStudioShellStore((state) => state.selectedDocumentPath);
  const selectedAuditIssueId = useStudioShellStore((state) => state.selectedAuditIssueId);
  const setSelectedView = useStudioShellStore((state) => state.setSelectedView);
  const setSelectedDocumentPath = useStudioShellStore((state) => state.setSelectedDocumentPath);
  const setSelectedAuditIssueId = useStudioShellStore((state) => state.setSelectedAuditIssueId);
  const sidebarCollapsed = useStudioShellStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useStudioShellStore((state) => state.toggleSidebar);
  const snapshotQuery = useQuery({
    queryKey: ['studio-snapshot'],
    queryFn: snapshotLoader,
  });

  const projectRoot =
    snapshotQuery.data === undefined
      ? 'Snapshot pending'
      : getStringField(snapshotQuery.data.project, 'root', 'Unknown project');
  const projectState = snapshotQuery.data === undefined ? 'loading' : getProjectState(snapshotQuery.data.project);
  const audit = snapshotQuery.data === undefined ? null : getAuditRecord(snapshotQuery.data.project);
  const auditHasErrors = audit === null ? false : getBooleanField(audit, 'hasErrors') === true;
  const auditHasWarnings = audit === null ? false : getBooleanField(audit, 'hasWarnings') === true;

  const openDocument = (path: string): void => {
    setSelectedDocumentPath(path);
    setSelectedView('documents');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex min-h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          onClick={toggleSidebar}
          className="hidden md:inline-flex"
        >
          <ChevronLeft className={cn('transition-transform', sidebarCollapsed && 'rotate-180')} />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-muted-foreground">Project root</p>
          <p className="truncate text-sm font-semibold md:text-base">{projectRoot}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={getProjectStateBadge(projectState)} className="hidden sm:inline-flex">
            {projectState}
          </Badge>
          <Badge variant={auditHasErrors ? 'destructive' : auditHasWarnings ? 'secondary' : 'outline'}>
            {auditHasErrors ? 'Audit errors' : auditHasWarnings ? 'Audit warnings' : 'Audit clear'}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Refresh snapshot"
            title="Refresh snapshot"
            onClick={() => {
              void snapshotQuery.refetch();
            }}
          >
            <RefreshCw className={cn(snapshotQuery.isFetching && 'animate-spin')} />
          </Button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 md:grid-cols-[auto_1fr]">
        <aside className={cn('border-b bg-card md:border-b-0 md:border-r', sidebarCollapsed ? 'md:w-16' : 'md:w-64')}>
          <nav className="shell-scrollbar flex gap-2 overflow-x-auto p-3 md:h-[calc(100vh-4rem)] md:flex-col md:overflow-y-auto md:p-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="flex shrink-0 gap-2 md:flex-col">
                {!sidebarCollapsed && (
                  <p className="hidden px-2 pt-2 text-xs font-medium text-muted-foreground md:block">{group.label}</p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = selectedView === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      className={cn(
                        'flex h-10 min-w-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        sidebarCollapsed && 'justify-center px-0',
                      )}
                      onClick={() => {
                        setSelectedView(item.id);
                      }}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      {!sidebarCollapsed && item.placeholder === true && (
                        <span className="ml-auto rounded-sm border px-1.5 py-0.5 text-[10px] leading-none">Later</span>
                      )}
                    </button>
                  );
                })}
                {!sidebarCollapsed && <Separator className="hidden md:block" />}
              </div>
            ))}
          </nav>
        </aside>

        <main className="shell-scrollbar overflow-y-auto p-4 md:p-6">
          {snapshotQuery.isLoading && <SnapshotLoadingState />}
          {snapshotQuery.isError && (
            <SnapshotErrorState
              errorDisplay={getSnapshotErrorDisplay(snapshotQuery.error)}
              onRetry={() => {
                void snapshotQuery.refetch();
              }}
            />
          )}
          {snapshotQuery.data !== undefined && (
            <ProjectSurface
              snapshot={snapshotQuery.data}
              selectedView={selectedView}
              selectedDocumentPath={selectedDocumentPath}
              selectedAuditIssueId={selectedAuditIssueId}
              onSelectDocument={setSelectedDocumentPath}
              onSelectAuditIssue={setSelectedAuditIssueId}
              onOpenDocument={openDocument}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function SnapshotLoadingState(): React.JSX.Element {
  return (
    <div className="space-y-4" aria-label="Loading snapshot">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading snapshot
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {['overview', 'graph', 'documents', 'inspector'].map((item) => (
          <div key={item} className="rounded-lg border bg-card p-4">
            <Skeleton className="mb-4 h-3 w-24" />
            <Skeleton className="mb-2 h-8 w-20" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

type SnapshotErrorStateProps = {
  readonly errorDisplay: SnapshotErrorDisplay;
  readonly onRetry: () => void;
};

function SnapshotErrorState({ errorDisplay, onRetry }: SnapshotErrorStateProps): React.JSX.Element {
  return (
    <section className="max-w-3xl rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-destructive/10 p-2 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">{errorDisplay.title}</h1>
          <p className="mt-2 break-words font-mono text-xs leading-6 text-muted-foreground">{errorDisplay.message}</p>
          <Button type="button" className="mt-4" onClick={onRetry}>
            <RefreshCw />
            Retry
          </Button>
        </div>
      </div>
    </section>
  );
}

type ProjectSurfaceProps = {
  readonly snapshot: StudioSnapshotEnvelope;
  readonly selectedView: StudioProjectView;
  readonly selectedDocumentPath: string | null;
  readonly selectedAuditIssueId: string | null;
  readonly onSelectDocument: (path: string | null) => void;
  readonly onSelectAuditIssue: (issueId: string | null) => void;
  readonly onOpenDocument: (path: string) => void;
};

function ProjectSurface({
  snapshot,
  selectedView,
  selectedDocumentPath,
  selectedAuditIssueId,
  onSelectDocument,
  onSelectAuditIssue,
  onOpenDocument,
}: ProjectSurfaceProps): React.JSX.Element {
  const viewModel = buildProjectViewModel(snapshot);

  return (
    <div className="space-y-5">
      <ProjectSurfaceHeader viewModel={viewModel} selectedView={selectedView} />
      {viewModel.state !== 'ready' && <ProjectStateNotice state={viewModel.state} />}
      {selectedView === 'overview' && <OverviewView viewModel={viewModel} />}
      {selectedView === 'context-graph' &&
        (viewModel.state === 'uninitialized' ? (
          <ContextLayerEmptyState />
        ) : (
          <ContextGraphView viewModel={viewModel} onOpenDocument={onOpenDocument} />
        ))}
      {selectedView === 'documents' &&
        (viewModel.state === 'uninitialized' ? (
          <ContextLayerEmptyState />
        ) : (
          <DocumentsView
            documents={viewModel.documents}
            selectedDocumentPath={selectedDocumentPath}
            onSelectDocument={onSelectDocument}
          />
        ))}
      {selectedView === 'audit' && (
        <AuditView
          viewModel={viewModel}
          selectedIssueId={selectedAuditIssueId}
          onSelectIssue={onSelectAuditIssue}
          onOpenDocument={onOpenDocument}
        />
      )}
      {isPlaceholderView(selectedView) && <PlaceholderView view={selectedView} />}
    </div>
  );
}

type ProjectSurfaceHeaderProps = {
  readonly viewModel: ProjectViewModel;
  readonly selectedView: StudioProjectView;
};

function ProjectSurfaceHeader({ viewModel, selectedView }: ProjectSurfaceHeaderProps): React.JSX.Element {
  const runtimeLabel = selectedView === 'overview' ? 'Project read surface' : selectedView;

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={getProjectStateBadge(viewModel.state)}>
              {viewModel.state === 'ready' ? <CheckCircle2 /> : <TriangleAlert />}
              {viewModel.state}
            </Badge>
            <Badge
              variant={
                viewModel.audit.hasErrors ? 'destructive' : viewModel.audit.hasWarnings ? 'secondary' : 'outline'
              }
            >
              {viewModel.audit.hasErrors
                ? 'Audit errors'
                : viewModel.audit.hasWarnings
                  ? 'Audit warnings'
                  : 'Audit clear'}
            </Badge>
          </div>
          <h1 className="text-xl font-semibold md:text-2xl">Studio control plane</h1>
          <p className="mt-2 max-w-3xl break-words font-mono text-xs leading-6 text-muted-foreground">
            {viewModel.root}
          </p>
        </div>
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">View</span> {runtimeLabel}
        </div>
      </div>
    </section>
  );
}

type ProjectStateNoticeProps = {
  readonly state: string;
};

function ProjectStateNotice({ state }: ProjectStateNoticeProps): React.JSX.Element {
  const title = state === 'uninitialized' ? 'Uninitialized project' : 'Degraded project';
  const message =
    state === 'uninitialized'
      ? 'No project operating layer was found for this root.'
      : 'Snapshot loaded with recoverable project issues.';

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-secondary p-2 text-secondary-foreground">
          <TriangleAlert className="size-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </section>
  );
}

type OverviewViewProps = {
  readonly viewModel: ProjectViewModel;
};

function OverviewView({ viewModel }: OverviewViewProps): React.JSX.Element {
  const sourceStates = [
    { label: 'Manifest', value: viewModel.files.manifest },
    { label: 'Context index', value: viewModel.files.contextIndex },
    { label: 'Docs status', value: viewModel.files.docsStatus },
  ] as const;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Project state"
          value={viewModel.state}
          helper="Context layer readiness"
          testId="project-state"
        />
        <MetricCard
          label="Documents"
          value={String(viewModel.documents.length)}
          helper="Tracked context documents"
          testId="document-count"
        />
        <MetricCard
          label="Audit"
          value={viewModel.audit.hasErrors ? 'errors' : viewModel.audit.hasWarnings ? 'warnings' : 'clear'}
          helper={`${viewModel.audit.issues.length} snapshot issues`}
          testId="audit-state"
        />
        <MetricCard
          label="Source hash"
          value={viewModel.audit.currentSourceHash ?? 'unknown'}
          helper="Current template source hash"
          testId="source-hash"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FolderKanban className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Source file health</h2>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            {sourceStates.map((source) => (
              <SourceStateDatum key={source.label} label={source.label} source={source.value} />
            ))}
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="size-4 text-accent" />
            <h2 className="text-base font-semibold">Audit summary</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CompactCount
              label="Errors"
              value={viewModel.audit.issues.filter((issue) => issue.level === 'error').length}
            />
            <CompactCount
              label="Warnings"
              value={viewModel.audit.issues.filter((issue) => issue.level === 'warning').length}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <CountPanel title="By status" counts={viewModel.counts.byStatus} />
        <CountPanel title="By layer" counts={viewModel.counts.byLayer} emptyLabel="No layers" />
        <CountPanel title="By owner" counts={viewModel.counts.byOwner} emptyLabel="No owners" />
      </section>
    </div>
  );
}

type AuditViewProps = {
  readonly viewModel: ProjectViewModel;
  readonly selectedIssueId: string | null;
  readonly onSelectIssue: (issueId: string | null) => void;
  readonly onOpenDocument: (path: string) => void;
};

function AuditView({
  viewModel,
  selectedIssueId,
  onSelectIssue,
  onOpenDocument,
}: AuditViewProps): React.JSX.Element {
  const selectedIssue = selectAuditIssue(viewModel.audit.issues, selectedIssueId);

  if (viewModel.audit.issues.length === 0) {
    return (
      <div className="space-y-5">
        <AuditSummaryGrid viewModel={viewModel} />
        <AuditClearState />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AuditSummaryGrid viewModel={viewModel} />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <AuditIssueGroups
          groups={viewModel.audit.groups}
          selectedIssueId={selectedIssue?.id ?? null}
          onSelectIssue={onSelectIssue}
        />
        <AuditIssueDetails issue={selectedIssue} documents={viewModel.documents} onOpenDocument={onOpenDocument} />
      </section>
    </div>
  );
}

type AuditSummaryGridProps = {
  readonly viewModel: ProjectViewModel;
};

function AuditSummaryGrid({ viewModel }: AuditSummaryGridProps): React.JSX.Element {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Errors"
        value={String(viewModel.audit.summary.errors)}
        helper="Blocking diagnostics"
        testId="audit-errors"
      />
      <MetricCard
        label="Warnings"
        value={String(viewModel.audit.summary.warnings)}
        helper="Review diagnostics"
        testId="audit-warnings"
      />
      <MetricCard
        label="Affected paths"
        value={String(viewModel.audit.summary.affectedPaths)}
        helper="Unique linked paths"
        testId="audit-affected-paths"
      />
      <MetricCard
        label="Issue sources"
        value={String(viewModel.audit.summary.issueSources)}
        helper="Unique source areas"
        testId="audit-issue-sources"
      />
    </section>
  );
}

function AuditClearState(): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-8 text-center shadow-sm">
      <ShieldCheck className="mx-auto size-8 text-primary" />
      <h2 className="mt-3 text-base font-semibold">Audit clear</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        Snapshot audit has no errors or warnings.
      </p>
    </section>
  );
}

type AuditIssueGroupsProps = {
  readonly groups: readonly ProjectAuditIssueGroup[];
  readonly selectedIssueId: string | null;
  readonly onSelectIssue: (issueId: string | null) => void;
};

function AuditIssueGroups({
  groups,
  selectedIssueId,
  onSelectIssue,
}: AuditIssueGroupsProps): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert className="size-4 text-primary" />
        <h2 className="text-base font-semibold">Diagnostics</h2>
      </div>
      <div className="shell-scrollbar max-h-[72vh] space-y-4 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.id} className="rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getAuditLevelBadgeVariant(group.level)}>{group.level}</Badge>
              <Badge variant="outline">{group.source}</Badge>
              <span className="font-mono text-xs text-muted-foreground">{group.code}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">{group.issues.length} issues</span>
            </div>
            <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
              {group.affectedPath ?? 'No linked path'}
            </p>
            <div className="mt-3 space-y-2">
              {group.issues.map((issue) => {
                const selected = issue.id === selectedIssueId;

                return (
                  <button
                    key={issue.id}
                    type="button"
                    className={cn(
                      'w-full rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground',
                      selected && 'border-primary bg-secondary',
                    )}
                    onClick={() => {
                      onSelectIssue(issue.id);
                    }}
                  >
                    <span className="block truncate font-mono text-xs font-medium">{issue.code}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{issue.message}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type AuditIssueDetailsProps = {
  readonly issue: ProjectAuditIssueView | null;
  readonly documents: readonly ProjectDocumentView[];
  readonly onOpenDocument: (path: string) => void;
};

function AuditIssueDetails({ issue, documents, onOpenDocument }: AuditIssueDetailsProps): React.JSX.Element {
  const affectedPath = issue?.affectedPath ?? null;
  const linkedDocument =
    affectedPath === null ? null : documents.find((document) => document.path === affectedPath) ?? null;

  if (issue === null) {
    return (
      <aside className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <CircleDashed className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Issue details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select a diagnostic to inspect it.</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <h2 className="text-base font-semibold">Issue details</h2>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={getAuditLevelBadgeVariant(issue.level)}>{issue.level}</Badge>
        <Badge variant="outline">{issue.source}</Badge>
      </div>
      <dl className="space-y-4">
        <InspectorDatum label="Code">{issue.code}</InspectorDatum>
        <InspectorDatum label="Affected path">{issue.affectedPath ?? 'none'}</InspectorDatum>
        <InspectorDatum label="Message">
          <span className="block rounded-md border bg-muted/30 p-3 text-sm leading-6">{issue.message}</span>
        </InspectorDatum>
        {issue.suggestedActionLabel !== null && (
          <InspectorDatum label="Suggested action">
            <span className="inline-flex rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium">
              {issue.suggestedActionLabel}
            </span>
          </InspectorDatum>
        )}
      </dl>
      {linkedDocument !== null && (
        <Button
          type="button"
          variant="outline"
          className="mt-5 w-full"
          data-testid="open-audit-document"
          onClick={() => {
            onOpenDocument(linkedDocument.path);
          }}
        >
          <BookOpenText />
          Open Document
        </Button>
      )}
    </aside>
  );
}

type MetricCardProps = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly testId: string;
};

function MetricCard({ label, value, helper, testId }: MetricCardProps): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p data-testid={testId} className="mt-2 truncate text-2xl font-semibold">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

type SourceStateDatumProps = {
  readonly label: string;
  readonly source: ProjectSourceState;
};

function SourceStateDatum({ label, source }: SourceStateDatumProps): React.JSX.Element {
  const state = getSourceStateLabel(source);

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-2 flex items-center gap-2 text-sm font-semibold">
        <Badge variant={state === 'ready' ? 'default' : state === 'missing' ? 'secondary' : 'destructive'}>
          {state}
        </Badge>
      </dd>
      {source.error !== null && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{source.error}</p>}
    </div>
  );
}

type CompactCountProps = {
  readonly label: string;
  readonly value: number;
};

function CompactCount({ label, value }: CompactCountProps): React.JSX.Element {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

type CountPanelProps = {
  readonly title: string;
  readonly counts: readonly ProjectDocumentCount[];
  readonly emptyLabel?: string;
};

function CountPanel({ title, counts, emptyLabel = 'No documents' }: CountPanelProps): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CircleDashed className="size-4 text-primary" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-2">
        {counts.map((count) => (
          <div
            key={count.label}
            className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
          >
            <span className="truncate text-sm">{count.label}</span>
            <span className="font-mono text-sm font-semibold">{count.count}</span>
          </div>
        ))}
        {counts.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}
      </div>
    </section>
  );
}

type ContextGraphViewProps = {
  readonly viewModel: ProjectViewModel;
  readonly onOpenDocument: (path: string) => void;
};

function ContextGraphView({ viewModel, onOpenDocument }: ContextGraphViewProps): React.JSX.Element {
  if (viewModel.documents.length === 0) {
    return <ContextLayerEmptyState />;
  }

  return (
    <section className="space-y-4">
      {viewModel.graph.map((statusGroup) => (
        <div key={statusGroup.status} className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant={getStatusBadgeVariant(statusGroup.status)}>{statusGroup.status}</Badge>
            <span className="font-mono text-xs text-muted-foreground">{statusGroup.count} documents</span>
          </div>
          {statusGroup.layers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No {statusGroup.status} documents</p>
          ) : (
            <div className="space-y-4">
              {statusGroup.layers.map((layerGroup) => (
                <div key={layerGroup.layer} className="rounded-md border bg-muted/20 p-3">
                  <h3 className="text-sm font-semibold">{layerGroup.layer}</h3>
                  <div className="mt-3 space-y-3">
                    {layerGroup.owners.map((ownerGroup) => (
                      <div key={ownerGroup.owner}>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">{ownerGroup.owner}</p>
                        <div className="space-y-2">
                          {ownerGroup.documents.map((document) => (
                            <button
                              key={document.path}
                              type="button"
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                                document.status !== 'Active' && 'border-destructive/30',
                              )}
                              onClick={() => {
                                onOpenDocument(document.path);
                              }}
                            >
                              <FileText className="size-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate font-mono text-xs">{document.path}</span>
                              {document.readError !== null && (
                                <TriangleAlert className="size-4 shrink-0 text-destructive" />
                              )}
                              {document.contentHashMatches === false && (
                                <Hash className="size-4 shrink-0 text-destructive" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

type DocumentsViewProps = {
  readonly documents: readonly ProjectDocumentView[];
  readonly selectedDocumentPath: string | null;
  readonly onSelectDocument: (path: string | null) => void;
};

function DocumentsView({ documents, selectedDocumentPath, onSelectDocument }: DocumentsViewProps): React.JSX.Element {
  const selectedDocument = selectProjectDocument(documents, selectedDocumentPath);

  if (selectedDocument === null) {
    return <ContextLayerEmptyState />;
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(220px,300px)_minmax(0,1fr)_minmax(280px,360px)]">
      <DocumentList documents={documents} selectedPath={selectedDocument.path} onSelectDocument={onSelectDocument} />
      <MarkdownPreview document={selectedDocument} />
      <DocumentInspector document={selectedDocument} />
    </section>
  );
}

type DocumentListProps = {
  readonly documents: readonly ProjectDocumentView[];
  readonly selectedPath: string;
  readonly onSelectDocument: (path: string | null) => void;
};

function DocumentList({ documents, selectedPath, onSelectDocument }: DocumentListProps): React.JSX.Element {
  return (
    <aside className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2 px-1">
        <BookOpenText className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Documents</h2>
      </div>
      <div className="shell-scrollbar max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {documents.map((document) => {
          const selected = document.path === selectedPath;

          return (
            <button
              key={document.path}
              type="button"
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left transition-colors',
                selected ? 'border-primary bg-secondary' : 'bg-background hover:bg-accent hover:text-accent-foreground',
                document.status !== 'Active' && 'border-destructive/40',
              )}
              onClick={() => {
                onSelectDocument(document.path);
              }}
            >
              <span className="block truncate font-mono text-xs font-medium">{document.path}</span>
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={getStatusBadgeVariant(document.status)}>{document.status}</Badge>
                {document.trustWarning !== null && (
                  <Badge variant="destructive">
                    <TriangleAlert />
                    Trust
                  </Badge>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

type MarkdownPreviewProps = {
  readonly document: ProjectDocumentView;
};

function MarkdownPreview({ document }: MarkdownPreviewProps): React.JSX.Element {
  return (
    <article className="min-w-0 rounded-lg border bg-card shadow-sm">
      <header className="border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getStatusBadgeVariant(document.status)}>{document.status}</Badge>
          <Badge variant="outline">{document.layer}</Badge>
        </div>
        <h2 className="mt-3 break-words font-mono text-sm font-semibold">{document.path}</h2>
      </header>
      {document.readError !== null || document.content === null ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {document.readError ?? 'Document content is unavailable.'}
          </div>
        </div>
      ) : (
        <div className="markdown-preview shell-scrollbar max-h-[72vh] overflow-y-auto p-5">
          <ReactMarkdown remarkPlugins={[remarkGfm, stripMarkdownHtml]} rehypePlugins={[rehypeSanitize]} skipHtml>
            {document.content}
          </ReactMarkdown>
        </div>
      )}
    </article>
  );
}

type DocumentInspectorProps = {
  readonly document: ProjectDocumentView;
};

function DocumentInspector({ document }: DocumentInspectorProps): React.JSX.Element {
  const warnings = [
    document.trustWarning,
    document.readError,
    document.contentHashMatches === false ? 'Current content hash differs from the indexed content hash.' : null,
  ].filter((warning): warning is string => warning !== null);

  return (
    <aside className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <h2 className="text-base font-semibold">Inspector</h2>
      </div>
      {warnings.length > 0 && (
        <div className="mb-4 space-y-2" data-testid="inspector-warnings">
          {warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {warning}
            </div>
          ))}
        </div>
      )}
      <dl className="space-y-4">
        <InspectorDatum label="Status">
          <Badge variant={getStatusBadgeVariant(document.status)}>{document.status}</Badge>
        </InspectorDatum>
        <InspectorDatum label="Layer">{document.layer}</InspectorDatum>
        <InspectorDatum label="Owner">{document.owner}</InspectorDatum>
        <InspectorDatum label="Provenance">{document.provenance}</InspectorDatum>
        <InspectorDatum label="Indexed hash">{document.indexedContentHash}</InspectorDatum>
        <InspectorDatum label="Current hash">{document.currentContentHash ?? 'unavailable'}</InspectorDatum>
        <InspectorDatum label="Match state">{getHashMatchLabel(document)}</InspectorDatum>
        <InspectorDatum label="read_when">
          <TokenList values={document.readWhen} />
        </InspectorDatum>
        <InspectorDatum label="update_when">
          <TokenList values={document.updateWhen} />
        </InspectorDatum>
      </dl>
    </aside>
  );
}

type InspectorDatumProps = {
  readonly label: string;
  readonly children: ReactNode;
};

function InspectorDatum({ label, children }: InspectorDatumProps): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

type TokenListProps = {
  readonly values: readonly string[];
};

function TokenList({ values }: TokenListProps): React.JSX.Element {
  if (values.length === 0) {
    return <span className="text-muted-foreground">none</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span key={value} className="rounded-sm border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]">
          {value}
        </span>
      ))}
    </div>
  );
}

function ContextLayerEmptyState(): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-8 text-center shadow-sm">
      <Archive className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-3 text-base font-semibold">No context-layer documents</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Snapshot document set is empty.</p>
    </section>
  );
}

type PlaceholderViewProps = {
  readonly view: PlaceholderProjectView;
};

function PlaceholderView({ view }: PlaceholderViewProps): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-8 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-muted p-2 text-muted-foreground">
          <CircleDashed className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{view}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{PLACEHOLDER_COPY[view]}</p>
        </div>
      </div>
    </section>
  );
}

export { App, StudioShell };
