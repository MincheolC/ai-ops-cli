import { FileText, Hash, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectViewModel } from '@/studio-bridge/project-view-model';
import { ContextLayerEmptyState } from './project-shared-components';
import { getStatusBadgeVariant } from './project-view-utils';

type ContextGraphViewProps = {
  readonly viewModel: ProjectViewModel;
  readonly onOpenDocument: (path: string) => void;
};

export function ContextGraphView({ viewModel, onOpenDocument }: ContextGraphViewProps): React.JSX.Element {
  if (viewModel.documents.length === 0) {
    return <ContextLayerEmptyState />;
  }

  return (
    <section className="space-y-4">
      {viewModel.graph.map((statusGroup) => (
        <div key={statusGroup.status} className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
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
