import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sortRulesByPriority,
  parseRawPresets,
  resolvePresetRuleGroups,
  resolvePresetRules,
  excludeRules,
  loadAllRules,
  loadPresets,
} from '../loader.js';
import type { Rule } from '../schemas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../../data');

const makeRule = (id: string, priority: number): Rule => ({
  id,
  category: 'test',
  tags: [],
  priority,
  content: { constraints: [], guidelines: [] },
});

describe('sortRulesByPriority', () => {
  it('내림차순 정렬: 90,50,70 → 90,70,50', () => {
    const rules = [makeRule('a', 90), makeRule('b', 50), makeRule('c', 70)];
    const sorted = sortRulesByPriority(rules);
    expect(sorted.map((r) => r.priority)).toEqual([90, 70, 50]);
  });

  it('빈 배열 → []', () => {
    expect(sortRulesByPriority([])).toEqual([]);
  });

  it('원본 불변 확인', () => {
    const rules = [makeRule('a', 50), makeRule('b', 90)];
    sortRulesByPriority(rules);
    expect(rules[0].priority).toBe(50);
    expect(rules[1].priority).toBe(90);
  });
});

describe('parseRawPresets', () => {
  it('key→id inject + Zod 통과', () => {
    const raw = {
      'my-preset': { description: 'Test preset', rules: ['typescript'] },
    };
    const presets = parseRawPresets(raw);
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe('my-preset');
    expect(presets[0].description).toBe('Test preset');
    expect(presets[0].rules).toEqual(['typescript']);
  });

  it('description 누락 시 ZodError', () => {
    const raw = {
      'my-preset': { rules: ['typescript'] },
    } as unknown as Record<string, { description: string; rules: string[] }>;
    expect(() => parseRawPresets(raw)).toThrow();
  });
});

describe('excludeRules', () => {
  const rules = [makeRule('typescript', 65), makeRule('react-typescript', 60), makeRule('nextjs', 55)];

  it('지정한 ID 제외 후 나머지 반환', () => {
    const result = excludeRules(rules, ['react-typescript']);
    expect(result.map((r) => r.id)).toEqual(['typescript', 'nextjs']);
  });

  it('빈 excludeIds → 전체 반환', () => {
    expect(excludeRules(rules, [])).toHaveLength(3);
  });

  it('모두 제외 → 빈 배열', () => {
    expect(excludeRules(rules, ['typescript', 'react-typescript', 'nextjs'])).toHaveLength(0);
  });

  it('존재하지 않는 ID 제외 → 원본 그대로', () => {
    const result = excludeRules(rules, ['unknown']);
    expect(result).toHaveLength(3);
  });

  it('순서 유지 확인', () => {
    const result = excludeRules(rules, ['react-typescript']);
    expect(result[0].id).toBe('typescript');
    expect(result[1].id).toBe('nextjs');
  });
});

describe('resolvePresetRules', () => {
  const ruleA = makeRule('typescript', 65);
  const ruleB = makeRule('react-typescript', 60);
  const graphqlCore = makeRule('graphql-core', 48);
  const graphqlWeb = makeRule('graphql-client-web', 47);
  const graphqlApp = makeRule('graphql-client-app', 46);
  const graphqlServer = makeRule('graphql-server', 44);

  it('정상 매칭 + priority 정렬', () => {
    const preset = { id: 'test', description: 'test', rules: ['react-typescript', 'typescript'] };
    const resolved = resolvePresetRules(preset, [ruleA, ruleB]);
    expect(resolved.map((r) => r.id)).toEqual(['typescript', 'react-typescript']);
  });

  it('논리 rule(graphql)를 preset별 실제 rule로 확장한다', () => {
    const webPreset = { id: 'frontend-web', description: 'test', rules: ['graphql'] };
    const appPreset = { id: 'frontend-app', description: 'test', rules: ['graphql'] };
    const backendPreset = { id: 'backend-ts', description: 'test', rules: ['graphql'] };
    const allRules = [graphqlCore, graphqlWeb, graphqlApp, graphqlServer];

    expect(resolvePresetRules(webPreset, allRules).map((r) => r.id)).toEqual(['graphql-core', 'graphql-client-web']);
    expect(resolvePresetRules(appPreset, allRules).map((r) => r.id)).toEqual(['graphql-core', 'graphql-client-app']);
    expect(resolvePresetRules(backendPreset, allRules).map((r) => r.id)).toEqual(['graphql-core', 'graphql-server']);
  });

  it('확장 결과 중복 rule은 제거한다', () => {
    const preset = { id: 'frontend-web', description: 'test', rules: ['graphql', 'graphql-client-web'] };
    const resolved = resolvePresetRules(preset, [graphqlCore, graphqlWeb]);
    expect(resolved.map((r) => r.id)).toEqual(['graphql-core', 'graphql-client-web']);
  });

  it('missing rule → Error', () => {
    const preset = { id: 'test', description: 'test', rules: ['missing-rule'] };
    expect(() => resolvePresetRules(preset, [ruleA])).toThrow('Rule not found: missing-rule');
  });

  it('번들 확장 중 누락된 rule은 context 포함 에러를 던진다', () => {
    const preset = { id: 'frontend-web', description: 'test', rules: ['graphql'] };
    expect(() => resolvePresetRules(preset, [graphqlCore])).toThrow(
      'Rule not found: graphql-client-web (from frontend-web:graphql)',
    );
  });
});

describe('resolvePresetRuleGroups', () => {
  const graphqlCore = makeRule('graphql-core', 48);
  const graphqlWeb = makeRule('graphql-client-web', 47);
  const typescript = makeRule('typescript', 65);

  it('논리 rule ID를 그룹 단위로 유지한다', () => {
    const preset = { id: 'frontend-web', description: 'test', rules: ['graphql', 'typescript'] };
    const groups = resolvePresetRuleGroups(preset, [graphqlCore, graphqlWeb, typescript]);

    expect(groups.map((group) => group.id)).toEqual(['graphql', 'typescript']);
    expect(groups[0]?.rules.map((rule) => rule.id)).toEqual(['graphql-core', 'graphql-client-web']);
    expect(groups[1]?.rules.map((rule) => rule.id)).toEqual(['typescript']);
  });
});

describe('I/O', () => {
  it('loadAllRules: 실제 data/rules/ 27개 로드', () => {
    const rules = loadAllRules(resolve(dataDir, 'rules'));
    expect(rules).toHaveLength(27);
  });

  it('loadPresets: 실제 data/presets.yaml 4개 로드', () => {
    const presets = loadPresets(resolve(dataDir, 'presets.yaml'));
    expect(presets).toHaveLength(4);
  });
});
