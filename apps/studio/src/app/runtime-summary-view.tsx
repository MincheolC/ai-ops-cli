import { FileWarning } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import type {
  RuntimeInstalledPathIssue,
  RuntimeSourceSummary,
  RuntimeSourceSummaryState,
  RuntimeViewModel,
} from '@/studio-bridge/runtime-view-model';
import type { StudioRuntimeView } from '@/stores/studio-shell-store';
import { RuntimeMetric } from './runtime-view-parts';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

type RuntimeSummaryProps = {
  readonly view: StudioRuntimeView;
  readonly viewModel: RuntimeViewModel;
};

type RuntimeManifestStatesProps = {
  readonly states: readonly RuntimeSourceSummary[];
};

type MissingInstalledPathsProps = {
  readonly paths: readonly RuntimeInstalledPathIssue[];
};

const RUNTIME_VIEW_LABELS = {
  integrations: 'Integrations',
  skills: 'Skills',
  subagents: 'Subagents',
  hooks: 'Hooks',
} as const satisfies Record<StudioRuntimeView, string>;

const SOURCE_STATE_LABELS = {
  ready: 'ready',
  missing: 'missing',
  invalid: 'invalid',
  unavailable: 'unavailable',
  unknown: 'unknown',
} as const satisfies Record<RuntimeSourceSummaryState, string>;

const getSourceBadgeVariant = (state: RuntimeSourceSummaryState): BadgeVariant => {
  if (state === 'ready') {
    return 'default';
  }
  if (state === 'invalid' || state === 'unavailable') {
    return 'destructive';
  }
  return 'secondary';
};

export function RuntimeSummary({ view, viewModel }: RuntimeSummaryProps): React.JSX.Element {
  return (
    <section className="space-y-4">
      {!viewModel.available && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <FileWarning className="mt-0.5 size-4 shrink-0" />
            <p>{viewModel.unavailableReason ?? 'Runtime home is unavailable.'}</p>
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <RuntimeMetric
          label="Runtime view"
          value={RUNTIME_VIEW_LABELS[view]}
          helper={viewModel.available ? 'Global runtime readable' : 'Catalog-only state'}
        />
        <RuntimeMetric
          label="Integrations"
          value={`${viewModel.counts.integrations.installed}/${viewModel.counts.integrations.total}`}
          helper="Installed catalog entries"
        />
        <RuntimeMetric
          label="Skills"
          value={`${viewModel.counts.skills.installed}/${viewModel.counts.skills.total}`}
          helper="Installed global skills"
        />
        <RuntimeMetric
          label="Subagents"
          value={`${viewModel.counts.subagents.installed}/${viewModel.counts.subagents.total}`}
          helper="Installed global subagents"
        />
        <RuntimeMetric
          label="Path health"
          value={String(viewModel.counts.missingInstalledPaths)}
          helper="Missing installed paths"
        />
      </div>
      <RuntimeManifestStates states={viewModel.manifestStates} />
      {viewModel.missingInstalledPaths.length > 0 && <MissingInstalledPaths paths={viewModel.missingInstalledPaths} />}
    </section>
  );
}

function RuntimeManifestStates({ states }: RuntimeManifestStatesProps): React.JSX.Element {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {states.map((state) => (
        <div key={state.id} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={getSourceBadgeVariant(state.state)}>{SOURCE_STATE_LABELS[state.state]}</Badge>
            <span className="text-xs font-medium text-muted-foreground">{state.label}</span>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{state.source.path}</p>
          {state.source.error !== null && (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-destructive">{state.source.error}</p>
          )}
        </div>
      ))}
    </section>
  );
}

function MissingInstalledPaths({ paths }: MissingInstalledPathsProps): React.JSX.Element {
  return (
    <section className="rounded-lg border border-destructive/30 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <FileWarning className="size-4 text-destructive" />
        <h2 className="text-sm font-semibold">Missing installed paths</h2>
      </div>
      <div className="space-y-2">
        {paths.map((path) => (
          <div key={`${path.kind}:${path.id}:${path.path}`} className="rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive">{path.kind}</Badge>
              <span className="font-mono text-xs font-medium">{path.id}</span>
            </div>
            <p className="mt-2 break-words font-mono text-xs text-muted-foreground">{path.path}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
