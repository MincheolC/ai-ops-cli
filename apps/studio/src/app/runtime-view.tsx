import { Boxes, Cable, CircleDashed, FileWarning, SearchCode, ShieldCheck, Wrench } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  selectRuntimeItem,
  type RuntimeComponentOwnership,
  type RuntimeComponentType,
  type RuntimeHookView,
  type RuntimeInstalledPathState,
  type RuntimeIntegrationComponentView,
  type RuntimeIntegrationView,
  type RuntimeSkillGroup,
  type RuntimeSkillView,
  type RuntimeSourceSummary,
  type RuntimeSourceSummaryState,
  type RuntimeSubagentView,
  type RuntimeViewModel,
} from '@/studio-bridge/runtime-view-model';
import type { StudioRuntimeView } from '@/stores/studio-shell-store';

type RuntimeViewProps = {
  readonly view: StudioRuntimeView;
  readonly viewModel: RuntimeViewModel;
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

type SelectableItem = {
  readonly id: string;
  readonly installed: boolean;
  readonly description?: string;
};

const RUNTIME_VIEW_LABELS = {
  integrations: 'Integrations',
  skills: 'Skills',
  subagents: 'Subagents',
  hooks: 'Hooks',
} as const satisfies Record<StudioRuntimeView, string>;

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

const SOURCE_STATE_LABELS = {
  ready: 'ready',
  missing: 'missing',
  invalid: 'invalid',
  unavailable: 'unavailable',
  unknown: 'unknown',
} as const satisfies Record<RuntimeSourceSummaryState, string>;

const getInstalledBadgeVariant = (installed: boolean): ComponentProps<typeof Badge>['variant'] =>
  installed ? 'default' : 'outline';

const getSourceBadgeVariant = (state: RuntimeSourceSummaryState): ComponentProps<typeof Badge>['variant'] => {
  if (state === 'ready') {
    return 'default';
  }
  if (state === 'invalid' || state === 'unavailable') {
    return 'destructive';
  }
  return 'secondary';
};

const getOwnershipBadgeVariant = (ownership: RuntimeComponentOwnership): ComponentProps<typeof Badge>['variant'] => {
  if (ownership === 'owned') {
    return 'default';
  }
  if (ownership === 'pre-existing') {
    return 'secondary';
  }
  return 'outline';
};

const formatOptionalValue = (value: string | null): string => value ?? 'not available';

function RuntimeView({
  view,
  viewModel,
  selectedRuntimeItemId,
  onSelectRuntimeItem,
}: RuntimeViewProps): React.JSX.Element {
  return (
    <div className="space-y-5">
      <RuntimeSummary view={view} viewModel={viewModel} />
      {view === 'integrations' && (
        <IntegrationsView
          integrations={viewModel.integrations}
          selectedRuntimeItemId={selectedRuntimeItemId}
          onSelectRuntimeItem={onSelectRuntimeItem}
        />
      )}
      {view === 'skills' && (
        <SkillsView
          skillGroups={viewModel.skillGroups}
          selectedRuntimeItemId={selectedRuntimeItemId}
          onSelectRuntimeItem={onSelectRuntimeItem}
        />
      )}
      {view === 'subagents' && (
        <SubagentsView
          subagents={viewModel.subagents}
          selectedRuntimeItemId={selectedRuntimeItemId}
          onSelectRuntimeItem={onSelectRuntimeItem}
        />
      )}
      {view === 'hooks' && (
        <HooksView
          hooks={viewModel.hooks}
          selectedRuntimeItemId={selectedRuntimeItemId}
          onSelectRuntimeItem={onSelectRuntimeItem}
        />
      )}
    </div>
  );
}

type RuntimeSummaryProps = {
  readonly view: StudioRuntimeView;
  readonly viewModel: RuntimeViewModel;
};

function RuntimeSummary({ view, viewModel }: RuntimeSummaryProps): React.JSX.Element {
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

type RuntimeMetricProps = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
};

function RuntimeMetric({ label, value, helper }: RuntimeMetricProps): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

type RuntimeManifestStatesProps = {
  readonly states: readonly RuntimeSourceSummary[];
};

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

type MissingInstalledPathsProps = {
  readonly paths: readonly {
    readonly kind: 'skill' | 'subagent';
    readonly id: string;
    readonly path: string;
  }[];
};

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

type ItemListProps<T extends SelectableItem> = {
  readonly title: string;
  readonly items: readonly T[];
  readonly selectedId: string | null;
  readonly icon: ReactNode;
  readonly emptyLabel: string;
  readonly onSelectItem: (itemId: string | null) => void;
  readonly renderMeta?: (item: T) => ReactNode;
};

function ItemList<T extends SelectableItem>({
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

type IntegrationsViewProps = {
  readonly integrations: readonly RuntimeIntegrationView[];
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

function IntegrationsView({
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

type IntegrationDetailsProps = {
  readonly integration: RuntimeIntegrationView | null;
};

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

type IntegrationComponentCardProps = {
  readonly component: RuntimeIntegrationComponentView;
};

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

type SkillsViewProps = {
  readonly skillGroups: readonly RuntimeSkillGroup[];
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

function SkillsView({ skillGroups, selectedRuntimeItemId, onSelectRuntimeItem }: SkillsViewProps): React.JSX.Element {
  const skills = skillGroups.flatMap((group) => group.skills);
  const selectedSkill = selectRuntimeItem(skills, selectedRuntimeItemId);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
      <aside className="space-y-4">
        {skillGroups.map((group) => (
          <SkillGroupList
            key={group.kind}
            group={group}
            selectedId={selectedSkill?.id ?? null}
            onSelectRuntimeItem={onSelectRuntimeItem}
          />
        ))}
      </aside>
      <SkillDetails skill={selectedSkill} />
    </section>
  );
}

type SkillGroupListProps = {
  readonly group: RuntimeSkillGroup;
  readonly selectedId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

function SkillGroupList({ group, selectedId, onSelectRuntimeItem }: SkillGroupListProps): React.JSX.Element {
  return (
    <ItemList
      title={`${group.kind} skills`}
      items={group.skills}
      selectedId={selectedId}
      icon={<Wrench className="size-4 text-primary" />}
      emptyLabel={`No ${group.kind} skills`}
      onSelectItem={onSelectRuntimeItem}
      renderMeta={() => <Badge variant="secondary">{`${group.installed}/${group.total}`}</Badge>}
    />
  );
}

type SkillDetailsProps = {
  readonly skill: RuntimeSkillView | null;
};

function SkillDetails({ skill }: SkillDetailsProps): React.JSX.Element {
  if (skill === null) {
    return <RuntimeEmptyDetails title="Skill details" />;
  }

  return (
    <article className="rounded-lg border bg-card p-5 shadow-sm">
      <RuntimeItemHeader
        title={skill.id}
        description={skill.description}
        installed={skill.installed}
        secondaryBadge={skill.kind}
      />
      <RuntimeCapabilityDetails
        supportedTools={skill.supportedTools}
        installedTools={skill.installedTools}
        installedPaths={skill.installedPaths}
        sourceHash={skill.sourceHash}
      >
        <DetailsDatum label="Groups">
          <TokenList values={skill.groups} />
        </DetailsDatum>
      </RuntimeCapabilityDetails>
    </article>
  );
}

type SubagentsViewProps = {
  readonly subagents: readonly RuntimeSubagentView[];
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

function SubagentsView({
  subagents,
  selectedRuntimeItemId,
  onSelectRuntimeItem,
}: SubagentsViewProps): React.JSX.Element {
  const selectedSubagent = selectRuntimeItem(subagents, selectedRuntimeItemId);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <ItemList
        title="Subagents"
        items={subagents}
        selectedId={selectedSubagent?.id ?? null}
        icon={<SearchCode className="size-4 text-primary" />}
        emptyLabel="No catalog subagents"
        onSelectItem={onSelectRuntimeItem}
      />
      <SubagentDetails subagent={selectedSubagent} />
    </section>
  );
}

type SubagentDetailsProps = {
  readonly subagent: RuntimeSubagentView | null;
};

function SubagentDetails({ subagent }: SubagentDetailsProps): React.JSX.Element {
  if (subagent === null) {
    return <RuntimeEmptyDetails title="Subagent details" />;
  }

  return (
    <article className="rounded-lg border bg-card p-5 shadow-sm">
      <RuntimeItemHeader title={subagent.id} description={subagent.description} installed={subagent.installed} />
      <RuntimeCapabilityDetails
        supportedTools={subagent.supportedTools}
        installedTools={subagent.installedTools}
        installedPaths={subagent.installedPaths}
        sourceHash={subagent.sourceHash}
      />
    </article>
  );
}

type HooksViewProps = {
  readonly hooks: readonly RuntimeHookView[];
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

function HooksView({ hooks, selectedRuntimeItemId, onSelectRuntimeItem }: HooksViewProps): React.JSX.Element {
  const selectedHook = selectRuntimeItem(hooks, selectedRuntimeItemId);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <ItemList
        title="Hooks"
        items={hooks}
        selectedId={selectedHook?.id ?? null}
        icon={<Cable className="size-4 text-primary" />}
        emptyLabel="No known hooks"
        onSelectItem={onSelectRuntimeItem}
      />
      <HookDetails hook={selectedHook} />
    </section>
  );
}

type HookDetailsProps = {
  readonly hook: RuntimeHookView | null;
};

function HookDetails({ hook }: HookDetailsProps): React.JSX.Element {
  if (hook === null) {
    return <RuntimeEmptyDetails title="Hook details" />;
  }

  return (
    <article className="rounded-lg border bg-card p-5 shadow-sm">
      <RuntimeItemHeader title={hook.id} description={hook.statusMessage} installed={hook.installed} />
      {hook.error !== null && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {hook.error}
        </div>
      )}
      <dl className="grid gap-4 md:grid-cols-2">
        <DetailsDatum label="hooksPath">{formatOptionalValue(hook.hooksPath)}</DetailsDatum>
        <DetailsDatum label="Related integrations">
          <TokenList values={hook.relatedIntegrationIds} />
        </DetailsDatum>
      </dl>
    </article>
  );
}

type RuntimeItemHeaderProps = {
  readonly title: string;
  readonly description: string;
  readonly installed: boolean;
  readonly secondaryBadge?: string;
};

function RuntimeItemHeader({
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

type RuntimeCapabilityDetailsProps = {
  readonly supportedTools: readonly string[];
  readonly installedTools: readonly string[];
  readonly installedPaths: readonly RuntimeInstalledPathState[];
  readonly sourceHash: string | null;
  readonly children?: ReactNode;
};

function RuntimeCapabilityDetails({
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

type InstalledPathListProps = {
  readonly paths: readonly RuntimeInstalledPathState[];
};

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

type DetailsDatumProps = {
  readonly label: string;
  readonly children: ReactNode;
};

function DetailsDatum({ label, children }: DetailsDatumProps): React.JSX.Element {
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

function TokenList({ values }: TokenListProps): React.JSX.Element {
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

type RuntimeEmptyDetailsProps = {
  readonly title: string;
};

function RuntimeEmptyDetails({ title }: RuntimeEmptyDetailsProps): React.JSX.Element {
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

export { RuntimeView };
