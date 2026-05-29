import { CircleDashed } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { RuntimeInstalledPathState } from '@/studio-bridge/runtime-view-model';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

export type SelectableItem = {
  readonly id: string;
  readonly installed: boolean;
  readonly description?: string;
};

type RuntimeMetricProps = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
};

type ItemListProps<T extends SelectableItem> = {
  readonly title: string;
  readonly items: readonly T[];
  readonly selectedId: string | null;
  readonly icon: ReactNode;
  readonly emptyLabel: string;
  readonly onSelectItem: (itemId: string | null) => void;
  readonly renderMeta?: (item: T) => ReactNode;
};

type RuntimeItemHeaderProps = {
  readonly title: string;
  readonly description: string;
  readonly installed: boolean;
  readonly secondaryBadge?: string;
};

type RuntimeCapabilityDetailsProps = {
  readonly supportedTools: readonly string[];
  readonly installedTools: readonly string[];
  readonly installedPaths: readonly RuntimeInstalledPathState[];
  readonly sourceHash: string | null;
  readonly children?: ReactNode;
};

type InstalledPathListProps = {
  readonly paths: readonly RuntimeInstalledPathState[];
};

type DetailsDatumProps = {
  readonly label: string;
  readonly children: ReactNode;
};

type TokenListProps = {
  readonly values: readonly string[];
};

type RuntimeEmptyDetailsProps = {
  readonly title: string;
};

export const getInstalledBadgeVariant = (installed: boolean): BadgeVariant => (installed ? 'default' : 'outline');

export const formatOptionalValue = (value: string | null): string => value ?? 'not available';

export function RuntimeMetric({ label, value, helper }: RuntimeMetricProps): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

export function ItemList<T extends SelectableItem>({
  title,
  items,
  selectedId,
  icon,
  emptyLabel,
  onSelectItem,
  renderMeta,
}: ItemListProps<T>): React.JSX.Element {
  return (
    <aside className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2 px-1">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="shell-scrollbar max-h-[72vh] space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const selected = item.id === selectedId;

          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Select ${title.toLowerCase()} ${item.id}`}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left transition-colors',
                selected ? 'border-primary bg-secondary' : 'bg-background hover:bg-accent hover:text-accent-foreground',
              )}
              onClick={() => {
                onSelectItem(item.id);
              }}
            >
              <span className="block truncate font-mono text-xs font-medium">{item.id}</span>
              {item.description !== undefined && (
                <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{item.description}</span>
              )}
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={getInstalledBadgeVariant(item.installed)}>
                  {item.installed ? 'installed' : 'not installed'}
                </Badge>
                {renderMeta?.(item)}
              </span>
            </button>
          );
        })}
        {items.length === 0 && <p className="px-1 text-sm text-muted-foreground">{emptyLabel}</p>}
      </div>
    </aside>
  );
}

export function RuntimeItemHeader({
  title,
  description,
  installed,
  secondaryBadge,
}: RuntimeItemHeaderProps): React.JSX.Element {
  return (
    <header className="mb-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={getInstalledBadgeVariant(installed)}>{installed ? 'installed' : 'not installed'}</Badge>
        {secondaryBadge !== undefined && <Badge variant="outline">{secondaryBadge}</Badge>}
      </div>
      <h2 className="break-words font-mono text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </header>
  );
}

export function RuntimeCapabilityDetails({
  supportedTools,
  installedTools,
  installedPaths,
  sourceHash,
  children,
}: RuntimeCapabilityDetailsProps): React.JSX.Element {
  return (
    <>
      <Separator className="my-4" />
      <dl className="grid gap-4 md:grid-cols-2">
        <DetailsDatum label="Supported tools">
          <TokenList values={supportedTools} />
        </DetailsDatum>
        <DetailsDatum label="Installed tools">
          <TokenList values={installedTools} />
        </DetailsDatum>
        <DetailsDatum label="sourceHash">{formatOptionalValue(sourceHash)}</DetailsDatum>
        {children}
      </dl>
      <InstalledPathList paths={installedPaths} />
    </>
  );
}

function InstalledPathList({ paths }: InstalledPathListProps): React.JSX.Element {
  return (
    <div className="mt-5">
      <h3 className="mb-3 text-sm font-semibold">Installed paths</h3>
      <div className="space-y-2">
        {paths.map((path) => (
          <div
            key={path.path}
            className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
          >
            <Badge variant={path.exists ? 'outline' : 'destructive'}>{path.exists ? 'exists' : 'missing'}</Badge>
            <span className="min-w-0 break-words font-mono text-xs text-muted-foreground">{path.path}</span>
          </div>
        ))}
        {paths.length === 0 && <p className="text-sm text-muted-foreground">none</p>}
      </div>
    </div>
  );
}

export function DetailsDatum({ label, children }: DetailsDatumProps): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

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

export function RuntimeEmptyDetails({ title }: RuntimeEmptyDetailsProps): React.JSX.Element {
  return (
    <aside className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-muted p-2 text-muted-foreground">
          <CircleDashed className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">No runtime item selected.</p>
        </div>
      </div>
    </aside>
  );
}
