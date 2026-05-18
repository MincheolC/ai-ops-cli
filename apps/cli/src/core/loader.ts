import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { parseMarkdownFrontmatter } from './frontmatter.js';
import { parseFlatToml } from './subagent-toml.js';
import {
  CodexSubagentFrontmatterSchema,
  IntegrationCatalogSchema,
  RuleSchema,
  PresetSchema,
  SkillCatalogSchema,
  SkillFrontmatterSchema,
  SubagentCatalogSchema,
  SubagentMarkdownFrontmatterSchema,
} from './schemas/index.js';
import type { Rule, Preset, Skill, SkillCatalog, Subagent, SubagentCatalog } from './schemas/index.js';
import type { IntegrationCatalog, IntegrationCatalogEntry } from './schemas/index.js';

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

// legacy preset Record<id, {description, rules}> → Preset[] 변환
export const parseRawPresets = (raw: Record<string, { description: string; rules: string[] }>): Preset[] =>
  Object.entries(raw).map(([id, value]) => PresetSchema.parse({ id, ...value }));

// preset.rules 목록을 실제 core rule로 해석 + priority 정렬, 누락 시 throw
export const resolvePresetRules = (preset: Preset, allRules: readonly Rule[]): Rule[] => {
  const resolved = preset.rules.map((ruleId) => resolveRuleById(ruleId, allRules, preset.id));
  return sortRulesByPriority(deduplicateRulesById(resolved));
};

export const resolvePresetSkills = (preset: Preset, allSkills: readonly Skill[]): Skill[] => {
  return allSkills
    .filter((skill) => skill.included_in_presets.includes(preset.id))
    .sort((a, b) => a.id.localeCompare(b.id));
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

export const loadSkillCatalog = (skillsDir: string): SkillCatalog =>
  SkillCatalogSchema.parse(JSON.parse(readFileSync(resolve(skillsDir, 'skill-registry.json'), 'utf-8')));

export const loadAllSkills = (skillsDir: string): Skill[] => {
  const catalog = loadSkillCatalog(skillsDir);
  const entries = [...catalog.skills].sort((a, b) => a.id.localeCompare(b.id));

  return entries.map((entry) => {
    const directory = resolve(skillsDir, entry.source_path);
    const skillMdPath = join(directory, 'SKILL.md');
    const rawSkillMd = readFileSync(skillMdPath, 'utf-8');
    const { frontmatter } = parseMarkdownFrontmatter(rawSkillMd);
    const parsed = SkillFrontmatterSchema.parse(frontmatter);
    if (parsed.name !== entry.id) {
      throw new Error(`Skill directory and frontmatter name mismatch: ${entry.id} != ${parsed.name}`);
    }

    const files = loadSkillDirectoryFiles(directory);
    if (entry.kind === 'reference' && !files.some((file) => file.path === 'references/reference.md')) {
      throw new Error(`Reference skill must include references/reference.md: ${parsed.name}`);
    }

    return {
      id: entry.id,
      kind: entry.kind,
      description: parsed.description,
      supported_tools: [...entry.supported_tools],
      groups: [...entry.groups],
      included_in_presets: [...entry.included_in_presets],
      directory,
      files,
    };
  });
};

const readRequiredTextFile = (filePath: string): string => {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    const cause = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`Required subagent source file is missing: ${filePath}${cause}`);
  }
};

const assertSubagentFrontmatterName = (params: { id: string; tool: string; name: string }): void => {
  if (params.name !== params.id) {
    throw new Error(`Subagent ${params.tool} frontmatter name mismatch: ${params.id} != ${params.name}`);
  }
};

export const loadSubagentCatalog = (subagentsDir: string): SubagentCatalog =>
  SubagentCatalogSchema.parse(JSON.parse(readFileSync(resolve(subagentsDir, 'subagent-registry.json'), 'utf-8')));

export const loadIntegrationCatalog = (integrationsDir: string): IntegrationCatalog =>
  IntegrationCatalogSchema.parse(
    JSON.parse(readFileSync(resolve(integrationsDir, 'integration-registry.json'), 'utf-8')),
  );

export const loadAllIntegrations = (integrationsDir: string): IntegrationCatalogEntry[] =>
  [...loadIntegrationCatalog(integrationsDir).integrations].sort((a, b) => a.id.localeCompare(b.id));

export const loadAllSubagents = (subagentsDir: string): Subagent[] => {
  const catalog = loadSubagentCatalog(subagentsDir);
  const entries = [...catalog.subagents].sort((a, b) => a.id.localeCompare(b.id));

  return entries.map((entry) => {
    const directory = resolve(subagentsDir, entry.source_path);
    const prompt = readRequiredTextFile(join(directory, 'PROMPT.md'));
    const claudeRaw = readRequiredTextFile(join(directory, 'claude.frontmatter.yaml'));
    const codexRaw = readRequiredTextFile(join(directory, 'codex.frontmatter.toml'));
    const geminiRaw = readRequiredTextFile(join(directory, 'gemini.frontmatter.yaml'));
    const claude = SubagentMarkdownFrontmatterSchema.parse(parse(claudeRaw));
    const codex = CodexSubagentFrontmatterSchema.parse(parseFlatToml(codexRaw));
    const gemini = SubagentMarkdownFrontmatterSchema.parse(parse(geminiRaw));

    assertSubagentFrontmatterName({ id: entry.id, tool: 'claude', name: claude.name });
    assertSubagentFrontmatterName({ id: entry.id, tool: 'codex', name: codex.name });
    assertSubagentFrontmatterName({ id: entry.id, tool: 'gemini', name: gemini.name });

    return {
      id: entry.id,
      supported_tools: [...entry.supported_tools],
      source_path: entry.source_path,
      directory,
      prompt,
      frontmatter: {
        claude: {
          raw: claudeRaw,
          parsed: claude,
        },
        codex: {
          raw: codexRaw,
          parsed: codex,
        },
        gemini: {
          raw: geminiRaw,
          parsed: gemini,
        },
      },
    };
  });
};

export const loadPresets = (presetsPath: string): Preset[] => {
  const raw = readFileSync(presetsPath, 'utf-8');
  const data = parse(raw) as Record<string, { description: string; rules: string[] }>;
  return parseRawPresets(data);
};
