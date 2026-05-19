import { useQuery, type QueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Blocks,
  Cable,
  CheckCircle2,
  ChevronLeft,
  CircleDashed,
  FileText,
  FolderKanban,
  GitBranch,
  Loader2,
  RefreshCw,
  Settings,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StudioProviders } from './providers';
import {
  isRecord,
  loadStudioSnapshot,
  StudioSnapshotParseError,
  type StudioSnapshotEnvelope,
} from '@/studio-bridge/studio-snapshot';
import { useStudioShellStore, type StudioNavItem } from '@/stores/studio-shell-store';

type SnapshotLoader = () => Promise<StudioSnapshotEnvelope>;

type AppProps = {
  readonly snapshotLoader?: SnapshotLoader;
  readonly queryClient?: QueryClient;
};

type StudioShellProps = {
  readonly snapshotLoader: SnapshotLoader;
};

type NavDefinition = {
  readonly id: StudioNavItem;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly phase?: string;
};

type NavGroup = {
  readonly label: string;
  readonly items: readonly NavDefinition[];
};

type SnapshotMetric = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly testId: string;
};

type SnapshotErrorDisplay = {
  readonly title: string;
  readonly message: string;
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Project',
    items: [{ id: 'project', label: 'Project', icon: FolderKanban }],
  },
  {
    label: 'Runtime',
    items: [{ id: 'runtime', label: 'Runtime', icon: Cable }],
  },
  {
    label: 'Local',
    items: [{ id: 'settings', label: 'Settings', icon: Settings }],
  },
  {
    label: 'Later',
    items: [
      { id: 'documents', label: 'Documents', icon: FileText, phase: 'Phase 4' },
      { id: 'audit', label: 'Audit', icon: ShieldCheck, phase: 'Phase 5' },
      { id: 'integrations', label: 'Integrations', icon: Blocks, phase: 'Phase 6' },
      { id: 'workflows', label: 'Workflows', icon: GitBranch, phase: 'Phase 7' },
    ],
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

const getArrayCount = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  return Array.isArray(value) ? value.length : 0;
};

const getAuditRecord = (project: Record<string, unknown>): Record<string, unknown> | null => {
  const audit = project.audit;
  return isRecord(audit) ? audit : null;
};

const getProjectState = (project: Record<string, unknown>): string => getStringField(project, 'state', 'unknown');

const getSnapshotMetrics = (snapshot: StudioSnapshotEnvelope): readonly SnapshotMetric[] => {
  const projectState = getProjectState(snapshot.project);
  const audit = getAuditRecord(snapshot.project);
  const hasErrors = audit === null ? null : getBooleanField(audit, 'hasErrors');
  const hasWarnings = audit === null ? null : getBooleanField(audit, 'hasWarnings');
  const runtimeAvailable = getBooleanField(snapshot.runtime, 'available');

  return [
    {
      label: 'Project state',
      value: projectState,
      helper: projectState === 'ready' ? 'Context layer is indexed' : 'Needs operating-layer attention',
      testId: 'project-state',
    },
    {
      label: 'Documents',
      value: String(getArrayCount(snapshot.project, 'documents')),
      helper: 'Tracked context documents',
      testId: 'document-count',
    },
    {
      label: 'Audit',
      value: hasErrors === true ? 'errors' : hasWarnings === true ? 'warnings' : 'clear',
      helper: `${audit === null ? 0 : getArrayCount(audit, 'issues')} snapshot issues`,
      testId: 'audit-state',
    },
    {
      label: 'Runtime',
      value: runtimeAvailable === false ? 'offline' : 'available',
      helper: `${getArrayCount(snapshot.runtime, 'skills')} skills, ${getArrayCount(snapshot.runtime, 'subagents')} subagents`,
      testId: 'runtime-state',
    },
  ];
};

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

const getProjectStateBadge = (projectState: string): React.ComponentProps<typeof Badge>['variant'] => {
  if (projectState === 'ready') {
    return 'default';
  }
  if (projectState === 'degraded') {
    return 'destructive';
  }
  return 'secondary';
};

function App({ snapshotLoader = loadStudioSnapshot, queryClient }: AppProps): React.JSX.Element {
  return (
    <StudioProviders queryClient={queryClient}>
      <StudioShell snapshotLoader={snapshotLoader} />
    </StudioProviders>
  );
}

function StudioShell({ snapshotLoader }: StudioShellProps): React.JSX.Element {
  const selectedNav = useStudioShellStore((state) => state.selectedNav);
  const setSelectedNav = useStudioShellStore((state) => state.setSelectedNav);
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
            {auditHasErrors ? 'Audit errors' : auditHasWarnings ? 'Audit warnings' : 'Audit placeholder'}
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
                  const active = selectedNav === item.id;

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
                        setSelectedNav(item.id);
                      }}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      {!sidebarCollapsed && item.phase !== undefined && (
                        <span className="ml-auto rounded-sm border px-1.5 py-0.5 text-[10px] leading-none">
                          {item.phase}
                        </span>
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
            <SnapshotSummary snapshot={snapshotQuery.data} selectedNav={selectedNav} />
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
        {['project', 'documents', 'audit', 'runtime'].map((item) => (
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

type SnapshotSummaryProps = {
  readonly snapshot: StudioSnapshotEnvelope;
  readonly selectedNav: StudioNavItem;
};

function SnapshotSummary({ snapshot, selectedNav }: SnapshotSummaryProps): React.JSX.Element {
  const metrics = getSnapshotMetrics(snapshot);
  const projectState = getProjectState(snapshot.project);
  const projectRoot = getStringField(snapshot.project, 'root', 'Unknown project');
  const runtimeAvailable = getBooleanField(snapshot.runtime, 'available') !== false;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant={getProjectStateBadge(projectState)}>
                {projectState === 'ready' ? <CheckCircle2 /> : <TriangleAlert />}
                {projectState}
              </Badge>
              <Badge variant={runtimeAvailable ? 'outline' : 'secondary'}>
                {runtimeAvailable ? 'Runtime available' : 'Runtime unavailable'}
              </Badge>
            </div>
            <h1 className="text-xl font-semibold md:text-2xl">Studio control plane</h1>
            <p className="mt-2 max-w-3xl break-words font-mono text-xs leading-6 text-muted-foreground">
              {projectRoot}
            </p>
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Selected</span> {selectedNav}
          </div>
        </div>
      </section>

      {projectState !== 'ready' && <ProjectStateNotice projectState={projectState} />}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FolderKanban className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Project snapshot</h2>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <SnapshotDatum label="Manifest" value={getSourceState(snapshot.project, 'manifest')} />
            <SnapshotDatum label="Context index" value={getSourceState(snapshot.project, 'contextIndex')} />
            <SnapshotDatum label="Docs status" value={getSourceState(snapshot.project, 'docsStatus')} />
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CircleDashed className="size-4 text-accent" />
            <h2 className="text-base font-semibold">Runtime counts</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CompactCount label="Integrations" value={getArrayCount(snapshot.runtime, 'integrations')} />
            <CompactCount label="Hooks" value={getArrayCount(snapshot.runtime, 'hooks')} />
            <CompactCount label="Skills" value={getArrayCount(snapshot.runtime, 'skills')} />
            <CompactCount label="Subagents" value={getArrayCount(snapshot.runtime, 'subagents')} />
          </div>
        </div>
      </section>
    </div>
  );
}

type ProjectStateNoticeProps = {
  readonly projectState: string;
};

function ProjectStateNotice({ projectState }: ProjectStateNoticeProps): React.JSX.Element {
  const title = projectState === 'uninitialized' ? 'Uninitialized project' : 'Degraded project';
  const message =
    projectState === 'uninitialized'
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

type MetricCardProps = {
  readonly metric: SnapshotMetric;
};

function MetricCard({ metric }: MetricCardProps): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
      <p data-testid={metric.testId} className="mt-2 truncate text-2xl font-semibold">
        {metric.value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{metric.helper}</p>
    </div>
  );
}

type SnapshotDatumProps = {
  readonly label: string;
  readonly value: string;
};

function SnapshotDatum({ label, value }: SnapshotDatumProps): React.JSX.Element {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-2 truncate text-sm font-semibold">{value}</dd>
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

const getSourceState = (project: Record<string, unknown>, key: string): string => {
  const files = project.files;
  if (!isRecord(files)) {
    return 'unknown';
  }

  const source = files[key];
  if (!isRecord(source)) {
    return 'unknown';
  }

  const exists = getBooleanField(source, 'exists');
  const parsed = getBooleanField(source, 'parsed');

  if (exists === false) {
    return 'missing';
  }
  if (parsed === false) {
    return 'invalid';
  }
  if (exists === true && parsed === true) {
    return 'ready';
  }
  return 'unknown';
};

export { App, StudioShell };
