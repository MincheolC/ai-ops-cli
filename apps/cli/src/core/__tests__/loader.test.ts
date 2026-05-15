import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sortRulesByPriority,
  parseRawPresets,
  resolvePresetRules,
  resolvePresetSkills,
  loadAllRules,
  loadAllSkills,
  loadSkillCatalog,
  loadPresets,
} from '../loader.js';
import type { Rule, Skill } from '../schemas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../../data');

const makeRule = (id: string, priority: number): Rule => ({
  id,
  category: 'test',
  tags: [],
  priority,
  supported_tools: ['claude-code', 'codex', 'gemini'],
  content: { constraints: [], guidelines: [] },
});

const makeSkill = (id: string): Skill => ({
  id,
  kind: 'reference',
  description: `${id} description`,
  supported_tools: ['claude-code', 'codex', 'gemini'],
  groups: ['frontend-web'],
  included_in_presets: ['frontend-web'],
  directory: `/tmp/${id}`,
  files: [
    {
      path: 'SKILL.md',
      content: `---\nname: ${id}\ndescription: ${id} description\n---\n# ${id}\n\nRead references/reference.md.`,
    },
    {
      path: 'references/reference.md',
      content: `${id} reference`,
    },
  ],
});

describe('sortRulesByPriority', () => {
  it('내림차순 정렬: 90,50,70 -> 90,70,50', () => {
    const rules = [makeRule('a', 90), makeRule('b', 50), makeRule('c', 70)];
    const sorted = sortRulesByPriority(rules);
    expect(sorted.map((r) => r.priority)).toEqual([90, 70, 50]);
  });

  it('빈 배열 -> []', () => {
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
  it('key->id inject + Zod 통과', () => {
    const raw = {
      'my-preset': {
        description: 'Test preset',
        rules: ['role-persona'],
      },
    };
    const presets = parseRawPresets(raw);
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe('my-preset');
    expect(presets[0].description).toBe('Test preset');
    expect(presets[0].rules).toEqual(['role-persona']);
  });

  it('description 누락 시 ZodError', () => {
    const raw = {
      'my-preset': { rules: ['role-persona'] },
    } as unknown as Record<string, { description: string; rules: string[]; skills?: string[] }>;
    expect(() => parseRawPresets(raw)).toThrow();
  });
});

describe('resolvePresetRules', () => {
  const ruleA = makeRule('communication', 85);
  const ruleB = makeRule('role-persona', 90);

  it('정상 매칭 + priority 정렬', () => {
    const preset = { id: 'test', description: 'test', rules: ['communication', 'role-persona'] };
    const resolved = resolvePresetRules(preset, [ruleA, ruleB]);
    expect(resolved.map((r) => r.id)).toEqual(['role-persona', 'communication']);
  });

  it('missing rule -> Error', () => {
    const preset = { id: 'test', description: 'test', rules: ['missing-rule'] };
    expect(() => resolvePresetRules(preset, [ruleA])).toThrow('Rule not found: missing-rule');
  });
});

describe('resolvePresetSkills', () => {
  it('registry의 included_in_presets로 installable skill을 해석한다', () => {
    const preset = {
      id: 'frontend-web',
      description: 'test',
      rules: ['role-persona'],
    };
    const skills = [
      makeSkill('typescript-language'),
      makeSkill('frontend-web-react-next-runtime'),
      {
        ...makeSkill('skill-load-check'),
        kind: 'task' as const,
        groups: [],
        included_in_presets: [],
      },
    ];

    expect(resolvePresetSkills(preset, skills).map((skill) => skill.id)).toEqual([
      'frontend-web-react-next-runtime',
      'typescript-language',
    ]);
  });

  it('preset와 연결된 skill이 없으면 빈 배열', () => {
    const preset = {
      id: 'frontend-web',
      description: 'test',
      rules: ['role-persona'],
    };

    expect(resolvePresetSkills(preset, [])).toEqual([]);
  });
});

describe('I/O', () => {
  it('loadAllRules: 실제 data/rules/ 5개 로드', () => {
    const rules = loadAllRules(resolve(dataDir, 'rules'));
    expect(rules).toHaveLength(5);
  });

  it('loadSkillCatalog: 실제 skill-registry.json 로드', () => {
    const catalog = loadSkillCatalog(resolve(dataDir, 'skills'));
    expect(catalog.skills.length).toBeGreaterThan(0);
  });

  it('loadAllSkills: 실제 data/skills/ 16개 로드', () => {
    const skills = loadAllSkills(resolve(dataDir, 'skills'));
    expect(skills).toHaveLength(16);
  });

  it('loadPresets: 실제 data/presets.yaml 4개 로드', () => {
    const presets = loadPresets(resolve(dataDir, 'presets.yaml'));
    expect(presets).toHaveLength(4);
  });
});
