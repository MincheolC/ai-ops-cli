import type { Manifest, Preset, Rule, Skill } from './schemas/index.js';
import { resolvePresetRules } from './loader.js';
import type { ToolId } from './tool-output.js';

const LEGACY_SKILL_ID_MAP = {
  'engineering-standards-pack': 'backend-service-standards',
} as const;

const LEGACY_EXTERNALIZED_RULE_SKILL_MAP = {
  'engineering-standards': 'backend-service-standards',
  typescript: 'typescript-language',
  python: 'python-language',
  'react-typescript': 'frontend-web-react-next-runtime',
  nextjs: 'frontend-web-react-next-runtime',
  'libs-frontend-web': 'frontend-web-react-next-runtime',
  'shadcn-ui': 'frontend-web-shadcn-ui',
  flutter: 'frontend-app-flutter-runtime',
  'libs-frontend-app': 'frontend-app-flutter-runtime',
  nestjs: 'backend-ts-nestjs-runtime',
  'libs-backend-ts': 'backend-ts-nestjs-runtime',
  fastapi: 'backend-python-fastapi-runtime',
  'libs-backend-python': 'backend-python-fastapi-runtime',
  'graphql-core': 'graphql-contract',
  'graphql-client-web': 'graphql-client-integration',
  'graphql-client-app': 'graphql-client-integration',
  'graphql-server': 'graphql-server-runtime',
  'nestjs-graphql': 'graphql-server-runtime',
  'prisma-postgresql': 'db-prisma-postgresql',
  sqlalchemy: 'db-sqlalchemy-postgresql',
  'ai-llm-python': 'ai-llm-python-runtime',
  'data-pipeline-python': 'data-pipeline-python-performance',
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

export type ResolvedProjectSkillTarget = {
  skill: Skill;
  requestedTools: ToolId[];
};

export const resolveManifestProjectSkills = (params: {
  manifest: Manifest;
  allSkills: readonly Skill[];
}): ResolvedProjectSkillTarget[] => {
  const { manifest, allSkills } = params;
  const skillMap = new Map(allSkills.map((skill) => [skill.id, skill]));
  const targets: ResolvedProjectSkillTarget[] = [];
  const seen = new Set<string>();

  for (const installedSkill of manifest.installed_skills ?? []) {
    const canonicalSkillId = resolveCanonicalSkillId(installedSkill.id);
    const skill = skillMap.get(canonicalSkillId);
    if (!skill) {
      throw new Error(`Skill not found during manifest resolution: ${installedSkill.id}`);
    }
    if (seen.has(skill.id)) {
      continue;
    }

    seen.add(skill.id);
    targets.push({
      skill,
      requestedTools: [...installedSkill.tools] as ToolId[],
    });
  }

  for (const ruleId of manifest.installed_rules) {
    const mappedSkillId = LEGACY_EXTERNALIZED_RULE_SKILL_MAP[ruleId as keyof typeof LEGACY_EXTERNALIZED_RULE_SKILL_MAP];
    if (!mappedSkillId || seen.has(mappedSkillId)) {
      continue;
    }

    const skill = skillMap.get(mappedSkillId);
    if (!skill) {
      throw new Error(`Skill not found during legacy rule migration: ${mappedSkillId}`);
    }

    seen.add(mappedSkillId);
    targets.push({
      skill,
      requestedTools: [...manifest.tools] as ToolId[],
    });
  }

  return targets;
};
