import { resolveCanonicalSkillId } from '@/core/index.js';
import type { InstalledSkill, Manifest, SkillRegistry, ToolId } from '@/core/index.js';

export type SkillScope = InstalledSkill['scope'];

export const resolveSkillScope = (params: {
  global?: boolean;
  project?: boolean;
  scope?: string;
}): SkillScope => {
  if (params.scope !== undefined) {
    if (params.scope === 'user') return 'user';
    if (params.scope === 'project') return 'project';
    throw new Error(`Unsupported scope: ${params.scope}`);
  }

  if (params.project) return 'project';
  return 'user';
};

export const resolveRequestedTools = (params: {
  requested?: readonly string[];
  supported: readonly string[];
}): ToolId[] => {
  if (params.requested === undefined || params.requested.length === 0) {
    return [...params.supported] as ToolId[];
  }

  const supportedSet = new Set(params.supported);
  const invalid = params.requested.filter((tool) => !supportedSet.has(tool));
  if (invalid.length > 0) {
    throw new Error(`Unsupported tools requested: ${invalid.join(', ')}`);
  }

  return [...params.requested] as ToolId[];
};

export const upsertInstalledSkill = (
  installedSkills: readonly InstalledSkill[],
  nextSkill: InstalledSkill,
): InstalledSkill[] => {
  const nextSkillId = resolveCanonicalSkillId(nextSkill.id);
  const remaining = installedSkills.filter((skill) => resolveCanonicalSkillId(skill.id) !== nextSkillId);
  return [...remaining, nextSkill];
};

export const removeInstalledSkill = (
  installedSkills: readonly InstalledSkill[],
  skillId: string,
): InstalledSkill[] => {
  const targetSkillId = resolveCanonicalSkillId(skillId);
  return installedSkills.filter((skill) => resolveCanonicalSkillId(skill.id) !== targetSkillId);
};

export const findInstalledSkill = (
  installedSkills: readonly InstalledSkill[],
  skillId: string,
): InstalledSkill | undefined => {
  const targetSkillId = resolveCanonicalSkillId(skillId);
  return installedSkills.find((skill) => resolveCanonicalSkillId(skill.id) === targetSkillId);
};

export const buildProjectManifestForSkill = (params: {
  previous: Manifest | null;
  nextInstalledSkill: InstalledSkill;
  currentSourceHash: string;
  cliVersion: string;
}): Manifest => {
  const previous = params.previous;
  const mergedTools = previous
    ? [...new Set([...previous.tools, ...params.nextInstalledSkill.tools])]
    : [...params.nextInstalledSkill.tools];

  const nextInstalledSkills = upsertInstalledSkill(previous?.installed_skills ?? [], params.nextInstalledSkill);

  return {
    tools: mergedTools,
    scope: 'project',
    preset: previous?.preset,
    workspaces: previous?.workspaces,
    installed_rules: previous?.installed_rules ?? [],
    installed_files: previous?.installed_files,
    installed_skills: nextInstalledSkills,
    appended_files: previous?.appended_files,
    settings: previous?.settings,
    cliVersion: params.cliVersion,
    sourceHash: params.currentSourceHash,
    generatedAt: new Date().toISOString(),
  };
};

export const buildSkillRegistry = (params: {
  previous: SkillRegistry | null;
  nextInstalledSkill: InstalledSkill;
  cliVersion: string;
}): SkillRegistry => ({
  skills: upsertInstalledSkill(params.previous?.skills ?? [], params.nextInstalledSkill),
  cliVersion: params.cliVersion,
  generatedAt: new Date().toISOString(),
});
