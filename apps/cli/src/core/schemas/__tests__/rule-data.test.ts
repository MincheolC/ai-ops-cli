import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { RuleSchema } from '../rule.schema.js';
import type { Rule } from '../rule.schema.js';
import { parseRawPresets, resolvePresetRules } from '../../loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesDir = resolve(__dirname, '../../../../data/rules');

const loadYaml = (filename: string): unknown => {
  const raw = readFileSync(resolve(rulesDir, filename), 'utf-8');
  return parse(raw);
};

const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith('.yaml'));

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
