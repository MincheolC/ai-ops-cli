import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { RuleSchema } from '../rule.schema.js';
import type { Rule } from '../rule.schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesDir = resolve(__dirname, '../../../data/rules');

const loadYaml = (filename: string): unknown => {
  const raw = readFileSync(resolve(rulesDir, filename), 'utf-8');
  return parse(raw);
};

const ruleFiles = [
  'role-persona.yaml',
  'communication.yaml',
  'code-philosophy.yaml',
  'naming-convention.yaml',
  'typescript.yaml',
  'react-typescript.yaml',
  'nextjs.yaml',
] as const;

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
