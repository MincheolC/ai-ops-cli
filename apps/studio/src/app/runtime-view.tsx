import { IntegrationsView } from './runtime-integrations-view';
import { HooksView } from './runtime-hooks-view';
import { SkillsView } from './runtime-skills-view';
import { SubagentsView } from './runtime-subagents-view';
import { RuntimeSummary } from './runtime-summary-view';
import type { RuntimeViewModel } from '@/studio-bridge/runtime-view-model';
import type { StudioRuntimeView } from '@/stores/studio-shell-store';

type RuntimeViewProps = {
  readonly view: StudioRuntimeView;
  readonly viewModel: RuntimeViewModel;
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

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

export { RuntimeView };
