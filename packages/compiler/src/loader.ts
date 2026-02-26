import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { RuleSchema, PresetSchema } from './schemas/index.js';
import type { Rule, Preset } from './schemas/index.js';

// priority 내림차순 정렬 (높을수록 상단 → U-shaped attention)
export const sortRulesByPriority = (rules: readonly Rule[]): Rule[] =>
  [...rules].sort((a, b) => b.priority - a.priority);

// presets.yaml의 Record<id, {description, rules}> → Preset[] 변환
export const parseRawPresets = (raw: Record<string, { description: string; rules: string[] }>): Preset[] =>
  Object.entries(raw).map(([id, value]) => PresetSchema.parse({ id, ...value }));

// preset.rules ID 목록으로 allRules에서 필터링 + priority 정렬, 누락 시 throw
export const resolvePresetRules = (preset: Preset, allRules: readonly Rule[]): Rule[] => {
  const resolved = preset.rules.map((ruleId) => {
    const found = allRules.find((r) => r.id === ruleId);
    if (!found) throw new Error(`Rule not found: ${ruleId}`);
    return found;
  });
  return sortRulesByPriority(resolved);
};

export const loadRuleFile = (filePath: string): Rule => {
  const raw = readFileSync(filePath, 'utf-8');
  return RuleSchema.parse(parse(raw));
};

// readdirSync + .yaml 필터 + sort
export const loadAllRules = (rulesDir: string): Rule[] => {
  const files = readdirSync(rulesDir)
    .filter((f) => f.endsWith('.yaml'))
    .sort();
  return files.map((f) => loadRuleFile(resolve(rulesDir, f)));
};

export const loadPresets = (presetsPath: string): Preset[] => {
  const raw = readFileSync(presetsPath, 'utf-8');
  const data = parse(raw) as Record<string, { description: string; rules: string[] }>;
  return parseRawPresets(data);
};
