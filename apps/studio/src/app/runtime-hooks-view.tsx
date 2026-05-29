import { Cable } from 'lucide-react';
import { selectRuntimeItem, type RuntimeHookView } from '@/studio-bridge/runtime-view-model';
import {
  DetailsDatum,
  formatOptionalValue,
  ItemList,
  RuntimeEmptyDetails,
  RuntimeItemHeader,
  TokenList,
} from './runtime-view-parts';

type HooksViewProps = {
  readonly hooks: readonly RuntimeHookView[];
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

type HookDetailsProps = {
  readonly hook: RuntimeHookView | null;
};

export function HooksView({ hooks, selectedRuntimeItemId, onSelectRuntimeItem }: HooksViewProps): React.JSX.Element {
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
        <DetailsDatum label="Trust review">{formatOptionalValue(hook.trustReviewHint)}</DetailsDatum>
        <DetailsDatum label="Related integrations">
          <TokenList values={hook.relatedIntegrationIds} />
        </DetailsDatum>
      </dl>
    </article>
  );
}
