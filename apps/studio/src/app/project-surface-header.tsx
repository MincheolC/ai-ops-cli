import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProjectViewModel } from '@/studio-bridge/project-view-model';
import type { StudioProjectView } from '@/stores/studio-shell-store';
import { getProjectStateBadge } from './project-view-utils';
import { isRuntimeView } from './studio-view-utils';

type ProjectSurfaceHeaderProps = {
  readonly viewModel: ProjectViewModel;
  readonly selectedView: StudioProjectView;
};

export function ProjectSurfaceHeader({ viewModel, selectedView }: ProjectSurfaceHeaderProps): React.JSX.Element {
  const surfaceLabel = isRuntimeView(selectedView)
    ? 'Runtime read surface'
    : selectedView === 'appearance'
      ? 'Settings'
      : 'Project read surface';

  return (
    <section className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
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
          <span className="font-medium text-foreground">View</span> {surfaceLabel} / {selectedView}
        </div>
      </div>
    </section>
  );
}

type ProjectStateNoticeProps = {
  readonly state: string;
};

export function ProjectStateNotice({ state }: ProjectStateNoticeProps): React.JSX.Element {
  const title = state === 'uninitialized' ? 'Uninitialized project' : 'Degraded project';
  const message =
    state === 'uninitialized'
      ? 'No project operating layer was found for this root.'
      : 'Snapshot loaded with recoverable project issues.';

  return (
    <section className="studio-density-card rounded-lg border bg-card p-4 shadow-sm">
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
