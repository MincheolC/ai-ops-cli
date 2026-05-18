import type { Manifest, Preset, Rule } from './schemas/index.js';
import { resolvePresetRules } from './loader.js';

const LEGACY_SKILL_ID_MAP = {
  'engineering-standards-pack': 'backend-service-standards',
} as const;

export const resolveCanonicalSkillId = (skillId: string): string =>
  LEGACY_SKILL_ID_MAP[skillId as keyof typeof LEGACY_SKILL_ID_MAP] ?? skillId;

const resolveRulesFromIds = (ruleIds: readonly string[], allRules: readonly Rule[]): Rule[] => {
  const ruleMap = new Map(allRules.map((rule) => [rule.id, rule]));
  const seen = new Set<string>();
  const resolved = ruleIds.flatMap((ruleId) => {
    const rule = ruleMap.get(ruleId);
    if (!rule || seen.has(rule.id)) {
      return [];
    }
    seen.add(rule.id);
    return [rule];
  });

  return [...resolved].sort((a, b) => b.priority - a.priority);
};

const resolvePresetById = (presetId: string | undefined, presets: readonly Preset[]): Preset | undefined => {
  if (presetId === undefined) {
    return undefined;
  }

  return presets.find((preset) => preset.id === presetId);
};

export const resolveManifestRules = (params: {
  manifest: Manifest;
  allRules: readonly Rule[];
  presets: readonly Preset[];
}): {
  installedRules: Rule[];
  workspaces?: Record<string, { preset: string; rules: string[] }>;
} => {
  const { manifest, allRules, presets } = params;

  if (manifest.workspaces) {
    const resolvedWorkspaces = Object.fromEntries(
      Object.entries(manifest.workspaces).map(([workspacePath, entry]) => {
        const preset = resolvePresetById(entry.preset, presets);
        const rules = preset ? resolvePresetRules(preset, allRules) : resolveRulesFromIds(entry.rules, allRules);

        return [
          workspacePath,
          {
            preset: entry.preset,
            rules: rules.map((rule) => rule.id),
          },
        ];
      }),
    );

    const installedRules = resolveRulesFromIds(
      Object.values(resolvedWorkspaces).flatMap((entry) => entry.rules),
      allRules,
    );

    return {
      installedRules,
      workspaces: resolvedWorkspaces,
    };
  }

  const preset = resolvePresetById(manifest.preset, presets);
  const installedRules = preset
    ? resolvePresetRules(preset, allRules)
    : resolveRulesFromIds(manifest.installed_rules, allRules);

  return {
    installedRules,
  };
};
