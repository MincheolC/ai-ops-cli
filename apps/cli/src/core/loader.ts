import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { parseMarkdownFrontmatter } from './frontmatter.js';
import { RuleSchema, PresetSchema, SkillFrontmatterSchema } from './schemas/index.js';
import type { Rule, Preset, Skill } from './schemas/index.js';

// priority 내림차순 정렬 (높을수록 상단 → U-shaped attention)
export const sortRulesByPriority = (rules: readonly Rule[]): Rule[] =>
  [...rules].sort((a, b) => b.priority - a.priority);

const deduplicateRulesById = (rules: readonly Rule[]): Rule[] => {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    if (seen.has(rule.id)) return false;
    seen.add(rule.id);
    return true;
  });
};

const resolveRuleById = (ruleId: string, allRules: readonly Rule[], context?: string): Rule => {
  const found = allRules.find((rule) => rule.id === ruleId);
  if (!found) {
    const suffix = context ? ` (from ${context})` : '';
    throw new Error(`Rule not found: ${ruleId}${suffix}`);
  }
  return found;
};

const resolveSkillById = (skillId: string, allSkills: readonly Skill[], context?: string): Skill => {
  const found = allSkills.find((skill) => skill.id === skillId);
  if (!found) {
    const suffix = context ? ` (from ${context})` : '';
    throw new Error(`Skill not found: ${skillId}${suffix}`);
  }
  return found;
};

// presets.yaml의 Record<id, {description, rules, skills}> → Preset[] 변환
export const parseRawPresets = (
  raw: Record<string, { description: string; rules: string[]; skills?: string[] }>,
): Preset[] =>
  Object.entries(raw).map(([id, value]) => PresetSchema.parse({ id, ...value }));

// preset.rules 목록을 실제 core rule로 해석 + priority 정렬, 누락 시 throw
export const resolvePresetRules = (preset: Preset, allRules: readonly Rule[]): Rule[] => {
  const resolved = preset.rules.map((ruleId) => resolveRuleById(ruleId, allRules, preset.id));
  return sortRulesByPriority(deduplicateRulesById(resolved));
};

export const resolvePresetSkills = (preset: Preset, allSkills: readonly Skill[]): Skill[] => {
  const seen = new Set<string>();
  return preset.skills.filter((skillId) => {
    if (seen.has(skillId)) return false;
    seen.add(skillId);
    return true;
  }).map((skillId) => resolveSkillById(skillId, allSkills, preset.id));
};

export const loadRuleFile = (filePath: string): Rule => {
  const raw = readFileSync(filePath, 'utf-8');
  return RuleSchema.parse(parse(raw));
};

const loadSkillDirectoryFiles = (skillDir: string): Skill['files'] => {
  const files: Skill['files'] = [];

  const walk = (relativeDir = ''): void => {
    const absDir = relativeDir.length > 0 ? join(skillDir, relativeDir) : skillDir;
    const entries = readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const nextRelativePath = relativeDir.length > 0 ? join(relativeDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(nextRelativePath);
        continue;
      }

      files.push({
        path: nextRelativePath,
        content: readFileSync(join(skillDir, nextRelativePath), 'utf-8'),
      });
    }
  };

  walk();
  return files;
};

// readdirSync + .yaml 필터 + 파일명 sort(결정적 로딩) → priority 내림차순
export const loadAllRules = (rulesDir: string): Rule[] => {
  const files = readdirSync(rulesDir)
    .filter((f) => f.endsWith('.yaml'))
    .sort();
  const rules = files.map((f) => loadRuleFile(resolve(rulesDir, f)));
  return sortRulesByPriority(rules);
};

export const loadAllSkills = (skillsDir: string): Skill[] => {
  const dirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return dirs.map((dirName) => {
    const directory = resolve(skillsDir, dirName);
    const skillMdPath = join(directory, 'SKILL.md');
    const rawSkillMd = readFileSync(skillMdPath, 'utf-8');
    const { frontmatter } = parseMarkdownFrontmatter(rawSkillMd);
    const parsed = SkillFrontmatterSchema.parse(frontmatter);
    if (parsed.name !== dirName) {
      throw new Error(`Skill directory and frontmatter name mismatch: ${dirName} != ${parsed.name}`);
    }

    const files = loadSkillDirectoryFiles(directory);
    if (
      parsed.kind === 'reference' &&
      !files.some((file) => file.path === 'references/reference.md')
    ) {
      throw new Error(`Reference skill must include references/reference.md: ${parsed.name}`);
    }

    return {
      id: parsed.name,
      kind: parsed.kind,
      description: parsed.description,
      supported_tools: parsed.supported_tools,
      install_scopes: parsed.install_scopes,
      directory,
      files,
    };
  });
};

export const loadPresets = (presetsPath: string): Preset[] => {
  const raw = readFileSync(presetsPath, 'utf-8');
  const data = parse(raw) as Record<string, { description: string; rules: string[]; skills?: string[] }>;
  return parseRawPresets(data);
};
