import { join } from 'node:path';
import { computeInstalledSkillHash } from './source-hash.js';
import { renderRulesToMarkdown, ruleIdToTitle } from './renderer.js';
import type { Rule, Skill, InstalledSkill } from './schemas/index.js';
import type { ToolId } from './tool-output.js';

const AGENT_SKILLS_DIR = '.agents/skills';
const CLAUDE_SKILLS_DIR = '.claude/skills';

type SkillPackageFile = {
  relativePath: string;
  content: string;
};

export type SkillPackage = {
  skillId: string;
  rootDir: string;
  files: SkillPackageFile[];
};

const buildFrontmatter = (skill: Skill): string =>
  ['---', `name: ${skill.id}`, `description: ${JSON.stringify(skill.description)}`, '---'].join('\n');

const buildSkillBody = (params: {
  skill: Skill;
  sourceRules: readonly Rule[];
  hasReferences: boolean;
  hasAssets: boolean;
  hasScripts: boolean;
}): string => {
  const sections: string[] = [buildFrontmatter(params.skill), '', `# ${ruleIdToTitle(params.skill.id)}`];

  if (params.skill.instructions) {
    sections.push('', params.skill.instructions);
  }

  const resources: string[] = [];
  if (params.hasReferences) resources.push('- `references/` contains the detailed source material for this skill.');
  if (params.hasAssets) resources.push('- `assets/` contains reusable templates or supporting artifacts.');
  if (params.hasScripts) resources.push('- `scripts/` contains executable helpers for this skill.');

  if (resources.length > 0) {
    sections.push('', '## Available Resources', '', resources.join('\n'));
  }

  if (params.sourceRules.length > 0) {
    sections.push('', '## Source Rules', '', params.sourceRules.map((rule) => `- ${rule.id}`).join('\n'));
  }

  return sections.join('\n');
};

const collectOptionalFiles = (params: { rootDir: string; dirName: string; files?: readonly { path: string; content: string }[] }) =>
  (params.files ?? []).map((file) => ({
    relativePath: join(params.rootDir, params.dirName, file.path),
    content: file.content,
  }));

const buildRootDirs = (skillId: string, toolIds: readonly ToolId[]): string[] => {
  const dirs: string[] = [];
  if (toolIds.some((toolId) => toolId === 'codex' || toolId === 'gemini')) {
    dirs.push(join(AGENT_SKILLS_DIR, skillId));
  }
  if (toolIds.includes('claude-code')) {
    dirs.push(join(CLAUDE_SKILLS_DIR, skillId));
  }
  return dirs;
};

const resolveSourceRulesForSkill = (params: {
  skill: Skill;
  allRules: readonly Rule[];
  sourceRuleIds?: readonly string[];
}): Rule[] => {
  const targetRuleIds = params.sourceRuleIds ?? params.skill.source_rules ?? [];
  const targetRuleSet = new Set(targetRuleIds);
  return params.allRules.filter((rule) => targetRuleSet.has(rule.id));
};

const normalizeSelectedTools = (skill: Skill, requestedTools: readonly ToolId[]): ToolId[] => {
  const supportedToolSet = new Set(skill.supported_tools);
  return requestedTools.filter((toolId) => supportedToolSet.has(toolId));
};

export const buildSkillInstallPlan = (params: {
  skill: Skill;
  allRules: readonly Rule[];
  requestedTools: readonly ToolId[];
  scope: InstalledSkill['scope'];
  sourceRuleIds?: readonly string[];
}): { packages: SkillPackage[]; installedSkill: InstalledSkill } => {
  const selectedTools = normalizeSelectedTools(params.skill, params.requestedTools);
  if (selectedTools.length === 0) {
    throw new Error(`Skill ${params.skill.id} does not support the requested tools`);
  }

  const sourceRules = resolveSourceRulesForSkill({
    skill: params.skill,
    allRules: params.allRules,
    sourceRuleIds: params.sourceRuleIds,
  });
  const rootDirs = buildRootDirs(params.skill.id, selectedTools);
  const skillHash = computeInstalledSkillHash({
    kind: params.skill.kind,
    description: params.skill.description,
    instructions: params.skill.instructions ?? '',
    tools: selectedTools,
    sourceRules: sourceRules.map((rule) => rule.id),
    references: (params.skill.references ?? []).map((file) => `${file.path}:${file.content}`),
    assets: (params.skill.assets ?? []).map((file) => `${file.path}:${file.content}`),
    scripts: (params.skill.scripts ?? []).map((file) => `${file.path}:${file.content}`),
  });

  const packages = rootDirs.map((rootDir) => {
    const files: SkillPackageFile[] = [
      {
        relativePath: join(rootDir, 'SKILL.md'),
        content: buildSkillBody({
          skill: params.skill,
          sourceRules,
          hasReferences: sourceRules.length > 0 || (params.skill.references ?? []).length > 0,
          hasAssets: (params.skill.assets ?? []).length > 0,
          hasScripts: (params.skill.scripts ?? []).length > 0,
        }),
      },
    ];

    if (sourceRules.length > 0) {
      files.push({
        relativePath: join(rootDir, 'references', 'source-rules.md'),
        content: renderRulesToMarkdown(sourceRules),
      });
    }

    files.push(...collectOptionalFiles({ rootDir, dirName: 'references', files: params.skill.references }));
    files.push(...collectOptionalFiles({ rootDir, dirName: 'assets', files: params.skill.assets }));
    files.push(...collectOptionalFiles({ rootDir, dirName: 'scripts', files: params.skill.scripts }));

    return {
      skillId: params.skill.id,
      rootDir,
      files,
    };
  });

  return {
    packages,
    installedSkill: {
      id: params.skill.id,
      kind: params.skill.kind,
      tools: selectedTools,
      scope: params.scope,
      installed_paths: rootDirs,
      sourceHash: skillHash,
      source_rules: sourceRules.length > 0 ? sourceRules.map((rule) => rule.id) : undefined,
    },
  };
};
