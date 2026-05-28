import { SearchCode } from 'lucide-react';
import { selectRuntimeItem, type RuntimeSubagentView } from '@/studio-bridge/runtime-view-model';
import {
  ItemList,
  RuntimeCapabilityDetails,
  RuntimeEmptyDetails,
  RuntimeItemHeader,
} from './runtime-view-parts';

type SubagentsViewProps = {
  readonly subagents: readonly RuntimeSubagentView[];
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

type SubagentDetailsProps = {
  readonly subagent: RuntimeSubagentView | null;
};

export function SubagentsView({
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
