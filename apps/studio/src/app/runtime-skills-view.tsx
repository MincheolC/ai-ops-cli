import { Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  selectRuntimeItem,
  type RuntimeSkillGroup,
  type RuntimeSkillView,
} from '@/studio-bridge/runtime-view-model';
import {
  DetailsDatum,
  ItemList,
  RuntimeCapabilityDetails,
  RuntimeEmptyDetails,
  RuntimeItemHeader,
  TokenList,
} from './runtime-view-parts';

type SkillsViewProps = {
  readonly skillGroups: readonly RuntimeSkillGroup[];
  readonly selectedRuntimeItemId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

type SkillGroupListProps = {
  readonly group: RuntimeSkillGroup;
  readonly selectedId: string | null;
  readonly onSelectRuntimeItem: (itemId: string | null) => void;
};

type SkillDetailsProps = {
  readonly skill: RuntimeSkillView | null;
};

export function SkillsView({
  skillGroups,
  selectedRuntimeItemId,
  onSelectRuntimeItem,
}: SkillsViewProps): React.JSX.Element {
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
