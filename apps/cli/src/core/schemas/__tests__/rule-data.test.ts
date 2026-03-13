import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { parseMarkdownFrontmatter } from '../../frontmatter.js';
import { RuleSchema } from '../rule.schema.js';
import { SkillCatalogSchema } from '../skill-catalog.schema.js';
import { SkillFrontmatterSchema } from '../skill.schema.js';
import type { Rule } from '../rule.schema.js';
import { parseRawPresets, resolvePresetRules } from '../../loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesDir = resolve(__dirname, '../../../../data/rules');
const skillsDir = resolve(__dirname, '../../../../data/skills');
const skillCatalogPath = resolve(skillsDir, 'skill-registry.json');

const loadYaml = (filename: string): unknown => {
  const raw = readFileSync(resolve(rulesDir, filename), 'utf-8');
  return parse(raw);
};

const skillCatalog = SkillCatalogSchema.parse(JSON.parse(readFileSync(skillCatalogPath, 'utf-8')));

const loadSkillFrontmatter = (sourcePath: string): unknown => {
  const raw = readFileSync(resolve(skillsDir, sourcePath, 'SKILL.md'), 'utf-8');
  return parseMarkdownFrontmatter(raw).frontmatter;
};

const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith('.yaml'));
const skillEntries = [...skillCatalog.skills].sort((a, b) => a.id.localeCompare(b.id));
const presetIds = Object.keys(
  parse(readFileSync(resolve(__dirname, '../../../../data/presets.yaml'), 'utf-8')) as Record<string, unknown>,
).sort();

describe('rule data files', () => {
  describe('각 YAML이 RuleSchema를 통과한다', () => {
    for (const filename of ruleFiles) {
      it(filename, () => {
        const data = loadYaml(filename);
        expect(() => RuleSchema.parse(data)).not.toThrow();
      });
    }
  });

  it('모든 rule id가 유일하다', () => {
    const rules = ruleFiles.map((f) => RuleSchema.parse(loadYaml(f)) as Rule);
    const ids = rules.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('모든 rule의 priority가 유일하다', () => {
    const rules = ruleFiles.map((f) => RuleSchema.parse(loadYaml(f)) as Rule);
    const priorities = rules.map((r) => r.priority);
    const unique = new Set(priorities);
    expect(unique.size).toBe(priorities.length);
  });
});

describe('skill data files', () => {
  it('skill-registry.json이 SkillCatalogSchema를 통과한다', () => {
    expect(() => SkillCatalogSchema.parse(JSON.parse(readFileSync(skillCatalogPath, 'utf-8')))).not.toThrow();
  });

  describe('각 registry source_path의 SKILL.md frontmatter가 SkillFrontmatterSchema를 통과한다', () => {
    for (const entry of skillEntries) {
      it(entry.id, () => {
        expect(() => SkillFrontmatterSchema.parse(loadSkillFrontmatter(entry.source_path))).not.toThrow();
      });
    }
  });

  it('reference skill은 references/reference.md를 가진다', () => {
    for (const entry of skillEntries) {
      if (entry.kind !== 'reference') {
        continue;
      }

      expect(existsSync(resolve(skillsDir, entry.source_path, 'references', 'reference.md'))).toBe(true);
    }
  });

  it('registry source_path가 실제 디렉토리를 가리킨다', () => {
    for (const entry of skillEntries) {
      expect(existsSync(resolve(skillsDir, entry.source_path, 'SKILL.md'))).toBe(true);
    }
  });

  it('included_in_presets는 실제 preset id만 참조한다', () => {
    const presetIdSet = new Set(presetIds);

    for (const entry of skillEntries) {
      for (const presetId of entry.included_in_presets) {
        expect(presetIdSet.has(presetId)).toBe(true);
      }
    }
  });
});

describe('presets.yaml', () => {
  const presetsPath = resolve(__dirname, '../../../../data/presets.yaml');
  const presetsRaw = readFileSync(presetsPath, 'utf-8');
  const presetsData = parse(presetsRaw) as Record<string, { description: string; rules: string[] }>;
  const allRules = ruleFiles.map((f) => RuleSchema.parse(loadYaml(f)) as Rule);
  const parsedPresets = parseRawPresets(presetsData);

  it('presets.yaml이 로드된다', () => {
    expect(presetsData).toBeTruthy();
    expect(Object.keys(presetsData).length).toBeGreaterThan(0);
  });

  for (const preset of parsedPresets) {
    describe(`preset: ${preset.id}`, () => {
      it('rules 배열이 존재한다', () => {
        expect(Array.isArray(preset.rules)).toBe(true);
        expect(preset.rules.length).toBeGreaterThan(0);
      });

      it('preset의 rule ID들이 실제 rule로 해석된다', () => {
        const resolved = resolvePresetRules(preset, allRules);
        expect(resolved.length).toBeGreaterThan(0);
      });
    });
  }
});
