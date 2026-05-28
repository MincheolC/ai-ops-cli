import { FolderKanban, ShieldAlert } from 'lucide-react';
import type { ProjectViewModel } from '@/studio-bridge/project-view-model';
import { CompactCount, CountPanel, MetricCard, SourceStateDatum } from './project-shared-components';

type OverviewViewProps = {
  readonly viewModel: ProjectViewModel;
};

export function OverviewView({ viewModel }: OverviewViewProps): React.JSX.Element {
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
        <div className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
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

        <div className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
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
