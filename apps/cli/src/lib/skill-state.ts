import { resolveCanonicalSkillId, SKILL_TOOL } from '@/core/index.js';
import type { InstalledSkill, ToolId } from '@/core/index.js';

export type SkillScope = InstalledSkill['scope'];

export const resolveSkillScope = (params: { global?: boolean; project?: boolean; scope?: string }): SkillScope => {
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

const TOOL_ORDER = [SKILL_TOOL.CLAUDE_CODE, SKILL_TOOL.CODEX, SKILL_TOOL.GEMINI] as const;

export const mergeSkillTools = (params: { existing?: readonly string[]; requested: readonly ToolId[] }): ToolId[] => {
  const merged = new Set([...(params.existing ?? []), ...params.requested]);
  return TOOL_ORDER.filter((tool) => merged.has(tool));
};

export const subtractSkillTools = (params: {
  requested: readonly ToolId[];
  installed?: readonly string[];
}): ToolId[] => {
  const installed = new Set(params.installed ?? []);
  return params.requested.filter((tool) => !installed.has(tool));
};

export const upsertInstalledSkill = (
  installedSkills: readonly InstalledSkill[],
  nextSkill: InstalledSkill,
): InstalledSkill[] => {
  const nextSkillId = resolveCanonicalSkillId(nextSkill.id);
  const remaining = installedSkills.filter((skill) => resolveCanonicalSkillId(skill.id) !== nextSkillId);
  return [...remaining, nextSkill];
};

export const removeInstalledSkill = (installedSkills: readonly InstalledSkill[], skillId: string): InstalledSkill[] => {
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
