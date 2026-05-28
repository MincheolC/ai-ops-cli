import { useQuery, type QueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Blocks,
  Cable,
  ChevronLeft,
  FileText,
  FolderKanban,
  GitBranch,
  Loader2,
  Palette,
  RefreshCw,
  SearchCode,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AppearanceView } from './appearance-view';
import { StudioProviders } from './providers';
import { AuditView } from './project-audit-view';
import { ContextGraphView } from './project-context-graph-view';
import { DocumentsView } from './project-documents-view';
import { OverviewView } from './project-overview-view';
import { ContextLayerEmptyState } from './project-shared-components';
import { ProjectStateNotice, ProjectSurfaceHeader } from './project-surface-header';
import { getProjectStateBadge } from './project-view-utils';
import { RuntimeView } from './runtime-view';
import { isRuntimeView } from './studio-view-utils';
import { buildProjectViewModel } from '@/studio-bridge/project-view-model';
import {
  isRecord,
  loadStudioSnapshot,
  StudioSnapshotParseError,
  type StudioSnapshotEnvelope,
} from '@/studio-bridge/studio-snapshot';
import { buildRuntimeViewModel } from '@/studio-bridge/runtime-view-model';
import { useStudioShellStore, type StudioProjectView } from '@/stores/studio-shell-store';
import { useStudioAppearanceStore } from '@/stores/studio-appearance-store';
import { getStudioThemePreset } from '@/theme/theme-preset-registry';

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
};

type NavGroup = {
  readonly label: string;
  readonly items: readonly NavDefinition[];
};

type SnapshotErrorDisplay = {
  readonly title: string;
  readonly message: string;
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
    label: 'Runtime',
    items: [
      { id: 'integrations', label: 'Integrations', icon: Blocks },
      { id: 'skills', label: 'Skills', icon: Wrench },
      { id: 'subagents', label: 'Subagents', icon: SearchCode },
      { id: 'hooks', label: 'Hooks', icon: Cable },
    ],
  },
  {
    label: 'Settings',
    items: [{ id: 'appearance', label: 'Appearance', icon: Palette }],
  },
];

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
  const selectedRuntimeItemId = useStudioShellStore((state) => state.selectedRuntimeItemId);
  const setSelectedView = useStudioShellStore((state) => state.setSelectedView);
  const setSelectedDocumentPath = useStudioShellStore((state) => state.setSelectedDocumentPath);
  const setSelectedAuditIssueId = useStudioShellStore((state) => state.setSelectedAuditIssueId);
  const setSelectedRuntimeItemId = useStudioShellStore((state) => state.setSelectedRuntimeItemId);
  const sidebarCollapsed = useStudioShellStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useStudioShellStore((state) => state.toggleSidebar);
  const selectedThemePresetId = useStudioAppearanceStore((state) => state.presetId);
  const selectedThemePreset = getStudioThemePreset(selectedThemePresetId);
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
      <header className="studio-shell-header flex min-h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
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
          <Badge variant="outline" className="hidden lg:inline-flex" data-testid="theme-badge">
            <Palette />
            {selectedThemePreset.label} / {selectedThemePreset.preview.appearance}
          </Badge>
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
          <nav className="studio-shell-nav shell-scrollbar flex gap-2 overflow-x-auto p-3 md:h-[calc(100vh-4rem)] md:flex-col md:overflow-y-auto md:p-4">
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
                    </button>
                  );
                })}
                {!sidebarCollapsed && <Separator className="hidden md:block" />}
              </div>
            ))}
          </nav>
        </aside>

        <main className="studio-shell-main shell-scrollbar overflow-y-auto p-4 md:p-6">
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
              selectedRuntimeItemId={selectedRuntimeItemId}
              onSelectDocument={setSelectedDocumentPath}
              onSelectAuditIssue={setSelectedAuditIssueId}
              onSelectRuntimeItem={setSelectedRuntimeItemId}
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
          <div key={item} className="studio-density-card rounded-lg border bg-card p-4">
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
    <section className="studio-density-card max-w-3xl rounded-lg border bg-card p-5 shadow-sm">
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
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectDocument: (path: string | null) => void;
  readonly onSelectAuditIssue: (issueId: string | null) => void;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
  readonly onOpenDocument: (path: string) => void;
};

function ProjectSurface({
  snapshot,
  selectedView,
  selectedDocumentPath,
  selectedAuditIssueId,
  selectedRuntimeItemId,
  onSelectDocument,
  onSelectAuditIssue,
  onSelectRuntimeItem,
  onOpenDocument,
}: ProjectSurfaceProps): React.JSX.Element {
  const viewModel = buildProjectViewModel(snapshot);
  const runtimeViewModel = buildRuntimeViewModel(snapshot);

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
      {isRuntimeView(selectedView) && (
        <RuntimeView
          view={selectedView}
          viewModel={runtimeViewModel}
          selectedRuntimeItemId={selectedRuntimeItemId}
          onSelectRuntimeItem={onSelectRuntimeItem}
        />
      )}
      {selectedView === 'appearance' && <AppearanceView />}
    </div>
  );
}

export { App, StudioShell };
