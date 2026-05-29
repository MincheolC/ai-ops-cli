import { BookOpenText, ShieldCheck, TriangleAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { selectProjectDocument, type ProjectDocumentView } from '@/studio-bridge/project-view-model';
import { ContextLayerEmptyState, InspectorDatum, TokenList } from './project-shared-components';
import { getHashMatchLabel, getStatusBadgeVariant } from './project-view-utils';

type MarkdownAstNode = {
  readonly type?: unknown;
  children?: MarkdownAstNode[];
};

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

type DocumentsViewProps = {
  readonly documents: readonly ProjectDocumentView[];
  readonly selectedDocumentPath: string | null;
  readonly onSelectDocument: (path: string | null) => void;
};

export function DocumentsView({
  documents,
  selectedDocumentPath,
  onSelectDocument,
}: DocumentsViewProps): React.JSX.Element {
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
    <aside className="studio-density-card rounded-lg border bg-card p-3 shadow-sm">
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
    <aside className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
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
