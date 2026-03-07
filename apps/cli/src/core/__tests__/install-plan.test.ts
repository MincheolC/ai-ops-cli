import { describe, it, expect } from 'vitest';
import { buildInstallPlan } from '../install-plan.js';
import { isManagedFile } from '../managed-header.js';
import type { ToolRenderResult } from '../renderer.js';

const META = { sourceHash: 'a1b2c3', generatedAt: '2026-02-27T00:00:00.000Z' };

describe('buildInstallPlan - claude-code', () => {
  const renderResult: ToolRenderResult = {
    tool: 'claude-code',
    files: [
      { relativePath: '.claude/rules/typescript.md', content: '# Typescript\n\n- Use strict mode' },
      { relativePath: '.claude/rules/react-typescript.md', content: '# React Typescript\n\n- Use FC' },
    ],
  };

  it('maps files to .claude/rules/ paths', () => {
    const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta: META });
    expect(actions).toHaveLength(2);
    expect(actions[0].relativePath).toBe('.claude/rules/typescript.md');
    expect(actions[1].relativePath).toBe('.claude/rules/react-typescript.md');
  });

  it('includes managed header in content', () => {
    const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta: META });
    for (const action of actions) {
      expect(isManagedFile(action.content)).toBe(true);
    }
  });
});

describe('buildInstallPlan - codex', () => {
  it('produces 2 FileActions when both root and domain content present', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '# Global Rules',
      domainContent: '# Domain Rules',
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    expect(actions).toHaveLength(2);
    expect(actions[0].relativePath).toBe('AGENTS.md');
    expect(actions[1].relativePath).toBe('AGENTS.override.md');
  });

  it('produces 1 FileAction when domainContent is empty', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '# Global Rules',
      domainContent: '',
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    expect(actions).toHaveLength(1);
    expect(actions[0].relativePath).toBe('AGENTS.md');
  });

  it('appends plan section to AGENTS.md root content', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '# Global Rules',
      domainContent: '',
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    expect(actions[0].content).toContain('## Plan Snapshot');
    expect(actions[0].content).toContain('.codex/plans/YYYYMMDD_<topic>.md');
  });

  it('includes managed header in all content', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '# Global',
      domainContent: '# Domain',
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    for (const action of actions) {
      expect(isManagedFile(action.content)).toBe(true);
    }
  });
});

describe('buildInstallPlan - gemini', () => {
  it('maps to .gemini/GEMINI.md for both root and domain', () => {
    const renderResult: ToolRenderResult = {
      tool: 'gemini',
      rootContent: '# Global Rules',
      domainContent: '# Domain Rules',
    };
    const actions = buildInstallPlan({ toolId: 'gemini', renderResult, meta: META });
    expect(actions).toHaveLength(2);
    expect(actions[0].relativePath).toBe('.gemini/GEMINI.md');
    expect(actions[1].relativePath).toBe('.gemini/GEMINI.md');
  });

  it('omits empty rootContent', () => {
    const renderResult: ToolRenderResult = {
      tool: 'gemini',
      rootContent: '',
      domainContent: '# Domain',
    };
    const actions = buildInstallPlan({ toolId: 'gemini', renderResult, meta: META });
    expect(actions).toHaveLength(1);
    expect(actions[0].relativePath).toBe('.gemini/GEMINI.md');
  });
});
