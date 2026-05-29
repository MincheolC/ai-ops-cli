import { describe, expect, it } from 'vitest';
import { buildSubagentInstallPlan } from '../../features/subagents/renderer.js';
import type { Subagent } from '../schemas/index.js';

const makeSubagent = (partial?: Partial<Subagent>): Subagent => ({
  id: 'security-gate',
  supported_tools: ['claude-code', 'codex', 'gemini'],
  source_path: 'security-gate',
  directory: '/tmp/security-gate',
  prompt: 'You are `security-gate`.\n',
  frontmatter: {
    claude: {
      raw: 'name: security-gate\ndescription: Gate changes.\nskills:\n  - spec-security-01-triage\n',
      parsed: {
        name: 'security-gate',
        description: 'Gate changes.',
        skills: ['spec-security-01-triage'],
      },
    },
    codex: {
      raw: 'name = "security-gate"\ndescription = "Gate changes."\nskill_names = ["spec-security-01-triage"]\n',
      parsed: {
        name: 'security-gate',
        description: 'Gate changes.',
        skill_names: ['spec-security-01-triage'],
      },
    },
    gemini: {
      raw: 'name: security-gate\ndescription: Gate changes.\n',
      parsed: {
        name: 'security-gate',
        description: 'Gate changes.',
      },
    },
  },
  ...partial,
});

describe('buildSubagentInstallPlan', () => {
  it('Claude output은 .claude/agents/<id>.md YAML frontmatter Markdown이다', () => {
    const result = buildSubagentInstallPlan({
      subagent: makeSubagent(),
      requestedTools: ['claude-code'],
      userBasePath: '/tmp/ai-ops-home',
    });

    expect(result.installedSubagent.installed_paths).toEqual(['.claude/agents/security-gate.md']);
    expect(result.packages[0]?.files[0]?.content).toContain('---\nname: security-gate');
    expect(result.packages[0]?.files[0]?.content).toContain('You are `security-gate`.');
  });

  it('Gemini output은 .gemini/agents/<id>.md YAML frontmatter Markdown이다', () => {
    const result = buildSubagentInstallPlan({
      subagent: makeSubagent(),
      requestedTools: ['gemini'],
      userBasePath: '/tmp/ai-ops-home',
    });

    expect(result.installedSubagent.installed_paths).toEqual(['.gemini/agents/security-gate.md']);
    expect(result.packages[0]?.files[0]?.content).toContain('---\nname: security-gate');
  });

  it('Codex output은 TOML metadata와 developer_instructions, skills.config를 포함한다', () => {
    const result = buildSubagentInstallPlan({
      subagent: makeSubagent({
        frontmatter: {
          ...makeSubagent().frontmatter,
          codex: {
            raw: 'name = "security_gate"\ndescription = "Gate changes."\nskill_names = ["spec-security-01-triage"]\n',
            parsed: {
              name: 'security_gate',
              description: 'Gate changes.',
              skill_names: ['spec-security-01-triage'],
            },
          },
        },
      }),
      requestedTools: ['codex'],
      userBasePath: '/tmp/ai-ops-home',
    });
    const content = result.packages[0]?.files[0]?.content ?? '';

    expect(result.installedSubagent.installed_paths).toEqual(['.codex/agents/security-gate.toml']);
    expect(content).toContain('name = "security_gate"');
    expect(content).toContain('developer_instructions = "You are `security-gate`."');
    expect(content).toContain('[[skills.config]]');
    expect(content).toContain('/tmp/ai-ops-home/.agents/skills/spec-security-01-triage/SKILL.md');
    expect(content).not.toContain('skill_names');
  });

  it('sourceHash는 prompt와 도구별 metadata 변경에 반응한다', () => {
    const before = buildSubagentInstallPlan({
      subagent: makeSubagent(),
      requestedTools: ['codex'],
      userBasePath: '/tmp/ai-ops-home',
    }).installedSubagent.sourceHash;
    const afterPrompt = buildSubagentInstallPlan({
      subagent: makeSubagent({ prompt: 'Changed prompt' }),
      requestedTools: ['codex'],
      userBasePath: '/tmp/ai-ops-home',
    }).installedSubagent.sourceHash;
    const afterCodexMetadata = buildSubagentInstallPlan({
      subagent: makeSubagent({
        frontmatter: {
          ...makeSubagent().frontmatter,
          codex: {
            raw: 'name = "security-gate"\ndescription = "Changed."\n',
            parsed: {
              name: 'security-gate',
              description: 'Changed.',
            },
          },
        },
      }),
      requestedTools: ['codex'],
      userBasePath: '/tmp/ai-ops-home',
    }).installedSubagent.sourceHash;

    expect(afterPrompt).not.toBe(before);
    expect(afterCodexMetadata).not.toBe(before);
  });
});
