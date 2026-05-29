import { Archive, CircleDashed } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { ProjectDocumentCount, ProjectSourceState } from '@/studio-bridge/project-view-model';
import { getSourceStateLabel } from './project-view-utils';

type MetricCardProps = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly testId: string;
};

export function MetricCard({ label, value, helper, testId }: MetricCardProps): React.JSX.Element {
  return (
    <div className="studio-density-card rounded-lg border bg-card p-4 shadow-sm">
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

export function SourceStateDatum({ label, source }: SourceStateDatumProps): React.JSX.Element {
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

export function CompactCount({ label, value }: CompactCountProps): React.JSX.Element {
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

export function CountPanel({ title, counts, emptyLabel = 'No documents' }: CountPanelProps): React.JSX.Element {
  return (
    <section className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
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

type InspectorDatumProps = {
  readonly label: string;
  readonly children: ReactNode;
};

export function InspectorDatum({ label, children }: InspectorDatumProps): React.JSX.Element {
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

export function TokenList({ values }: TokenListProps): React.JSX.Element {
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

export function ContextLayerEmptyState(): React.JSX.Element {
  return (
    <section className="studio-density-card rounded-lg border bg-card p-8 text-center shadow-sm">
      <Archive className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-3 text-base font-semibold">No context-layer documents</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Snapshot document set is empty.</p>
    </section>
  );
}
