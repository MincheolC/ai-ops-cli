import { Boxes } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  selectRuntimeItem,
  type RuntimeComponentOwnership,
  type RuntimeComponentType,
  type RuntimeIntegrationComponentView,
  type RuntimeIntegrationView,
} from '@/studio-bridge/runtime-view-model';
import {
  DetailsDatum,
  formatOptionalValue,
  getInstalledBadgeVariant,
  ItemList,
  RuntimeEmptyDetails,
  TokenList,
} from './runtime-view-parts';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

type IntegrationsViewProps = {
  readonly integrations: readonly RuntimeIntegrationView[];
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

type IntegrationDetailsProps = {
  readonly integration: RuntimeIntegrationView | null;
};

type IntegrationComponentCardProps = {
  readonly component: RuntimeIntegrationComponentView;
};

const COMPONENT_TYPE_LABELS = {
  skill: 'skill',
  'codex-hook': 'codex-hook',
  'receipt-config': 'receipt-config',
} as const satisfies Record<RuntimeComponentType, string>;

const OWNERSHIP_LABELS = {
  owned: 'owned',
  'pre-existing': 'pre-existing',
  'not-installed': 'not installed',
  unknown: 'unknown',
} as const satisfies Record<RuntimeComponentOwnership, string>;

const getOwnershipBadgeVariant = (ownership: RuntimeComponentOwnership): BadgeVariant => {
  if (ownership === 'owned') {
    return 'default';
  }
  if (ownership === 'pre-existing') {
    return 'secondary';
  }
  return 'outline';
};

export function IntegrationsView({
  integrations,
  selectedRuntimeItemId,
  onSelectRuntimeItem,
}: IntegrationsViewProps): React.JSX.Element {
  const selectedIntegration = selectRuntimeItem(integrations, selectedRuntimeItemId);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <ItemList
        title="Integrations"
        items={integrations}
        selectedId={selectedIntegration?.id ?? null}
        icon={<Boxes className="size-4 text-primary" />}
        emptyLabel="No catalog integrations"
        onSelectItem={onSelectRuntimeItem}
      />
      <IntegrationDetails integration={selectedIntegration} />
    </section>
  );
}

function IntegrationDetails({ integration }: IntegrationDetailsProps): React.JSX.Element {
  if (integration === null) {
    return <RuntimeEmptyDetails title="Integration details" />;
  }

  return (
    <article className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={getInstalledBadgeVariant(integration.installed)}>
              {integration.installed ? 'installed' : 'not installed'}
            </Badge>
            <Badge variant="outline">catalog</Badge>
          </div>
          <h2 className="break-words font-mono text-base font-semibold">{integration.id}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{integration.description}</p>
        </div>
        <dl className="grid min-w-48 gap-2 text-xs">
          <DetailsDatum label="Installed at">{formatOptionalValue(integration.installedAt)}</DetailsDatum>
          <DetailsDatum label="Updated at">{formatOptionalValue(integration.updatedAt)}</DetailsDatum>
        </dl>
      </div>
      <Separator className="my-4" />
      <div className="space-y-3">
        {integration.components.map((component) => (
          <IntegrationComponentCard key={`${component.type}:${component.id}`} component={component} />
        ))}
      </div>
    </article>
  );
}

function IntegrationComponentCard({ component }: IntegrationComponentCardProps): React.JSX.Element {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{COMPONENT_TYPE_LABELS[component.type]}</Badge>
        <Badge variant={getInstalledBadgeVariant(component.installed)}>
          {component.installed ? 'installed' : 'not installed'}
        </Badge>
        <Badge variant={getOwnershipBadgeVariant(component.ownership)}>{OWNERSHIP_LABELS[component.ownership]}</Badge>
        <span className="font-mono text-xs font-medium">{component.id}</span>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <DetailsDatum label="Catalog id">{component.catalogId}</DetailsDatum>
        <DetailsDatum label="Catalog tools">
          <TokenList values={component.catalogTools} />
        </DetailsDatum>
        <DetailsDatum label="Installed tools">
          <TokenList values={component.installedTools} />
        </DetailsDatum>
        <DetailsDatum label="Command">{formatOptionalValue(component.command)}</DetailsDatum>
        {component.type === 'receipt-config' && (
          <>
            <DetailsDatum label="Catalog storage">{formatOptionalValue(component.catalogStoragePath)}</DetailsDatum>
            <DetailsDatum label="Installed storage">{formatOptionalValue(component.installedStoragePath)}</DetailsDatum>
          </>
        )}
      </dl>
    </div>
  );
}
