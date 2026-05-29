import { BookOpenText, CircleDashed, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  selectAuditIssue,
  type ProjectAuditIssueGroup,
  type ProjectAuditIssueView,
  type ProjectDocumentView,
  type ProjectViewModel,
} from '@/studio-bridge/project-view-model';
import { cn } from '@/lib/utils';
import { InspectorDatum, MetricCard } from './project-shared-components';
import { getAuditLevelBadgeVariant } from './project-view-utils';

type AuditViewProps = {
  readonly viewModel: ProjectViewModel;
  readonly selectedIssueId: string | null;
  readonly onSelectIssue: (issueId: string | null) => void;
  readonly onOpenDocument: (path: string) => void;
};

export function AuditView({
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
    <section className="studio-density-card rounded-lg border bg-card p-8 text-center shadow-sm">
      <ShieldCheck className="mx-auto size-8 text-primary" />
      <h2 className="mt-3 text-base font-semibold">Audit clear</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Snapshot audit has no errors or warnings.</p>
    </section>
  );
}

type AuditIssueGroupsProps = {
  readonly groups: readonly ProjectAuditIssueGroup[];
  readonly selectedIssueId: string | null;
  readonly onSelectIssue: (issueId: string | null) => void;
};

function AuditIssueGroups({ groups, selectedIssueId, onSelectIssue }: AuditIssueGroupsProps): React.JSX.Element {
  return (
    <section className="studio-density-card rounded-lg border bg-card p-4 shadow-sm">
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
    affectedPath === null ? null : (documents.find((document) => document.path === affectedPath) ?? null);

  if (issue === null) {
    return (
      <aside className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
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
    <aside className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
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
