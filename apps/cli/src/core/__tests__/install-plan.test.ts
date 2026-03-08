import { describe, it, expect } from 'vitest';
import { buildInstallPlan } from '../install-plan.js';
import { hasAiOpsSection } from '../managed-header.js';
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
      expect(hasAiOpsSection(action.content)).toBe(true);
    }
  });
});

describe('buildInstallPlan - codex', () => {
  it('produces 2 FileActions when both root and domain content present', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '# Global Rules',
      domainFiles: [{ workspacePath: '.', content: '# Domain Rules' }],
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    expect(actions).toHaveLength(2);
    expect(actions[0].relativePath).toBe('AGENTS.md');
    expect(actions[1].relativePath).toBe('AGENTS.override.md');
  });

  it('produces 1 FileAction when domainFiles is empty', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '# Global Rules',
      domainFiles: [],
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    expect(actions).toHaveLength(1);
    expect(actions[0].relativePath).toBe('AGENTS.md');
  });

  it('always produces AGENTS.md even when rootContent is empty', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '',
      domainFiles: [],
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    expect(actions).toHaveLength(1);
    expect(actions[0].relativePath).toBe('AGENTS.md');
    expect(actions[0].content).toContain('## Plan Snapshot');
    expect(actions[0].content).toContain('.codex/plans/YYYYMMDD_<topic>.md');
  });

  it('appends plan section to AGENTS.md root content', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '# Global Rules',
      domainFiles: [],
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    expect(actions[0].content).toContain('## Plan Snapshot');
    expect(actions[0].content).toContain('.codex/plans/YYYYMMDD_<topic>.md');
  });

  it('includes managed header in all content', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '# Global',
      domainFiles: [{ workspacePath: '.', content: '# Domain' }],
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    for (const action of actions) {
      expect(hasAiOpsSection(action.content)).toBe(true);
    }
  });

  it('produces per-workspace AGENTS.override.md for monorepo', () => {
    const renderResult: ToolRenderResult = {
      tool: 'codex',
      rootContent: '# Global Rules',
      domainFiles: [
        { workspacePath: 'apps/backend', content: '# Backend Rules' },
        { workspacePath: 'apps/frontend', content: '# Frontend Rules' },
      ],
    };
    const actions = buildInstallPlan({ toolId: 'codex', renderResult, meta: META });
    expect(actions).toHaveLength(3);
    expect(actions[0].relativePath).toBe('AGENTS.md');
    expect(actions[1].relativePath).toBe('apps/backend/AGENTS.override.md');
    expect(actions[2].relativePath).toBe('apps/frontend/AGENTS.override.md');
  });
});

describe('buildInstallPlan - gemini', () => {
  it('maps to root GEMINI.md for single-repo (domainFiles empty)', () => {
    const renderResult: ToolRenderResult = {
      tool: 'gemini',
      rootContent: '# All Rules',
      domainFiles: [],
    };
    const actions = buildInstallPlan({ toolId: 'gemini', renderResult, meta: META });
    expect(actions).toHaveLength(1);
    expect(actions[0].relativePath).toBe('GEMINI.md');
  });

  it('omits empty rootContent', () => {
    const renderResult: ToolRenderResult = {
      tool: 'gemini',
      rootContent: '',
      domainFiles: [{ workspacePath: '.', content: '# Domain' }],
    };
    const actions = buildInstallPlan({ toolId: 'gemini', renderResult, meta: META });
    expect(actions).toHaveLength(1);
    expect(actions[0].relativePath).toBe('GEMINI.md');
  });

  it('produces per-workspace GEMINI.md for monorepo', () => {
    const renderResult: ToolRenderResult = {
      tool: 'gemini',
      rootContent: '# Global Rules',
      domainFiles: [
        { workspacePath: 'apps/backend', content: '# Backend Rules' },
        { workspacePath: 'apps/frontend', content: '# Frontend Rules' },
      ],
    };
    const actions = buildInstallPlan({ toolId: 'gemini', renderResult, meta: META });
    expect(actions).toHaveLength(3);
    expect(actions[0].relativePath).toBe('GEMINI.md');
    expect(actions[1].relativePath).toBe('apps/backend/GEMINI.md');
    expect(actions[2].relativePath).toBe('apps/frontend/GEMINI.md');
  });
});
