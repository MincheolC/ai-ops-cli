import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { RuleSchema, PresetSchema } from './schemas/index.js';
import type { Rule, Preset } from './schemas/index.js';

type PresetRuleBundles = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

export const PRESET_RULE_BUNDLES: PresetRuleBundles = {
  'frontend-web': {
    graphql: ['graphql-core', 'graphql-client-web'],
  },
  'frontend-app': {
    graphql: ['graphql-core', 'graphql-client-app'],
  },
  'backend-ts': {
    graphql: ['graphql-core', 'graphql-server'],
  },
} as const;

export type PresetRuleGroup = {
  id: string;
  rules: Rule[];
};

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

const resolveBundledRuleIds = (presetId: string, logicalRuleId: string): readonly string[] => {
  const presetBundles = PRESET_RULE_BUNDLES[presetId];
  if (!presetBundles) return [logicalRuleId];
  return presetBundles[logicalRuleId] ?? [logicalRuleId];
};

const resolveRuleById = (ruleId: string, allRules: readonly Rule[], context?: string): Rule => {
  const found = allRules.find((rule) => rule.id === ruleId);
  if (!found) {
    const suffix = context ? ` (from ${context})` : '';
    throw new Error(`Rule not found: ${ruleId}${suffix}`);
  }
  return found;
};

// presets.yaml의 Record<id, {description, rules}> → Preset[] 변환
export const parseRawPresets = (raw: Record<string, { description: string; rules: string[] }>): Preset[] =>
  Object.entries(raw).map(([id, value]) => PresetSchema.parse({ id, ...value }));

export const resolvePresetRuleGroups = (preset: Preset, allRules: readonly Rule[]): PresetRuleGroup[] =>
  preset.rules.map((logicalRuleId) => {
    const bundledRuleIds = resolveBundledRuleIds(preset.id, logicalRuleId);
    const rules = bundledRuleIds.map((ruleId) => resolveRuleById(ruleId, allRules, `${preset.id}:${logicalRuleId}`));
    return { id: logicalRuleId, rules };
  });

// TUI 세부조정: 사용자가 해제한 rule ID 목록을 제외 (순서 유지)
export const excludeRules = (rules: readonly Rule[], excludeIds: readonly string[]): Rule[] => {
  const excludeSet = new Set(excludeIds);
  return rules.filter((r) => !excludeSet.has(r.id));
};

// preset.rules(논리 ID 포함) 목록을 실제 rule로 확장 + priority 정렬, 누락 시 throw
export const resolvePresetRules = (preset: Preset, allRules: readonly Rule[]): Rule[] => {
  const groups = resolvePresetRuleGroups(preset, allRules);
  const resolved = deduplicateRulesById(groups.flatMap((group) => group.rules));
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
