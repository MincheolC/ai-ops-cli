import { describe, it, expect } from 'vitest';
import { buildSpecInitPlan } from '../spec-plan.js';

describe('buildSpecInitPlan', () => {
  it('returns exactly 3 FileActions', () => {
    const actions = buildSpecInitPlan();
    expect(actions).toHaveLength(3);
  });

  it('includes specs/README.md', () => {
    const actions = buildSpecInitPlan();
    expect(actions[0].relativePath).toBe('specs/README.md');
  });

  it('includes specs/baseline/.gitkeep', () => {
    const actions = buildSpecInitPlan();
    expect(actions[1].relativePath).toBe('specs/baseline/.gitkeep');
  });

  it('includes specs/delta/.gitkeep', () => {
    const actions = buildSpecInitPlan();
    expect(actions[2].relativePath).toBe('specs/delta/.gitkeep');
  });

  it('README content is non-empty', () => {
    const actions = buildSpecInitPlan();
    expect(actions[0].content.length).toBeGreaterThan(0);
  });

  it('.gitkeep files have empty content', () => {
    const actions = buildSpecInitPlan();
    expect(actions[1].content).toBe('');
    expect(actions[2].content).toBe('');
  });
});
