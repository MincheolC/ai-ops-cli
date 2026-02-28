import type { Rule, DecisionTableEntry } from './schemas/index.js';
import { GLOBAL_CATEGORIES, CLAUDE_CODE_PATH_GLOBS, TOOL_OUTPUT_MAP } from './tool-output.js';
import type { ToolId } from './tool-output.js';

// "react-typescript" → "React Typescript"
export const ruleIdToTitle = (id: string): string =>
  id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

// DecisionTableEntry[] → Markdown 테이블 (pipe 문자 &#124; escape)
export const renderDecisionTable = (entries: readonly DecisionTableEntry[]): string => {
  const escape = (s: string) => s.replace(/\|/g, '&#124;');
  const hasAvoid = entries.some((e) => e.avoid !== undefined);

  const header = hasAvoid ? '| When | Then | Avoid |\n|------|------|-------|' : '| When | Then |\n|------|------|';

  const rows = entries.map((e) => {
    const when = escape(e.when);
    const then = escape(e.then);
    if (hasAvoid) {
      const avoid = e.avoid ? escape(e.avoid) : '';
      return `| ${when} | ${then} | ${avoid} |`;
    }
    return `| ${when} | ${then} |`;
  });

  return [header, ...rows].join('\n');
};

// 단일 Rule → Markdown (빈 섹션 생략)
export const renderRuleToMarkdown = (rule: Rule): string => {
  const sections: string[] = [`# ${ruleIdToTitle(rule.id)}`];

  if (rule.content.constraints.length > 0) {
    sections.push('## Constraints');
    sections.push(rule.content.constraints.map((c) => `- ${c}`).join('\n'));
  }

  if (rule.content.guidelines.length > 0) {
    sections.push('## Guidelines');
    sections.push(rule.content.guidelines.map((g) => `- ${g}`).join('\n'));
  }

  if (rule.content.decision_table && rule.content.decision_table.length > 0) {
    sections.push('## Decision Table');
    sections.push(renderDecisionTable(rule.content.decision_table));
  }

  return sections.join('\n\n');
};

// Rule[] → 단일 Markdown (--- separator, single-file 모드용)
export const renderRulesToMarkdown = (rules: readonly Rule[]): string =>
  rules.map(renderRuleToMarkdown).join('\n\n---\n\n');

// Rule이 global 카테고리에 속하는지 판별
export const isGlobalRule = (rule: Rule): boolean => (GLOBAL_CATEGORIES as readonly string[]).includes(rule.category);

// Rule[] → { global, domain } 분리
export const partitionRules = (rules: readonly Rule[]): { global: Rule[]; domain: Rule[] } => {
  const global: Rule[] = [];
  const domain: Rule[] = [];
  for (const rule of rules) {
    if (isGlobalRule(rule)) {
      global.push(rule);
    } else {
      domain.push(rule);
    }
  }
  return { global, domain };
};

// glob 배열 → YAML frontmatter 블록
export const renderFrontmatter = (paths: readonly string[]): string => {
  const lines = paths.map((p) => `  - "${p}"`).join('\n');
  return `---\npaths:\n${lines}\n---`;
};

// 모노레포에서 rule이 포함된 워크스페이스별 scoped glob 생성
// e.g. typescript rule + ['backend-ts', 'web'] → ['backend-ts/**/*.ts', 'web/**/*.ts', ...]
export type WorkspaceMapping = {
  path: string;
  ruleIds: readonly string[];
};

const buildScopedGlobs = (rule: Rule, workspaceMappings: readonly WorkspaceMapping[]): readonly string[] | undefined => {
  const baseGlobs = CLAUDE_CODE_PATH_GLOBS[rule.id];
  if (!baseGlobs) return undefined;

  const relevant = workspaceMappings.filter((ws) => ws.ruleIds.includes(rule.id));
  if (relevant.length === 0) return baseGlobs;

  return relevant.flatMap((ws) => baseGlobs.map((g) => `${ws.path}/${g}`));
};

// 단일 Rule → Claude Code용 Markdown
// domain 룰이면서 glob 매핑이 있으면 paths: frontmatter 추가
// global 룰 또는 매핑 없는 domain 룰 → frontmatter 없음 (안전 fallback)
export const renderClaudeCodeRule = (rule: Rule, scopedGlobs?: readonly string[]): string => {
  const globs = scopedGlobs ?? CLAUDE_CODE_PATH_GLOBS[rule.id];
  if (!isGlobalRule(rule) && globs !== undefined) {
    return `${renderFrontmatter(globs)}\n\n${renderRuleToMarkdown(rule)}`;
  }
  return renderRuleToMarkdown(rule);
};

// 도구별 렌더링 결과 타입 (tagged union)
export type ClaudeCodeRenderResult = {
  tool: 'claude-code';
  files: { fileName: string; content: string }[];
};

export type CodexRenderResult = {
  tool: 'codex';
  rootContent: string;
  domainContent: string;
};

export type GeminiRenderResult = {
  tool: 'gemini';
  rootContent: string;
  domainContent: string;
};

export type ToolRenderResult = ClaudeCodeRenderResult | CodexRenderResult | GeminiRenderResult;

// CLI 진입점: toolId + rules → 도구별 렌더링 결과
// workspaceMappings 전달 시 claude-code frontmatter에 workspace-prefixed glob 생성
export const renderForTool = (
  toolId: ToolId,
  rules: readonly Rule[],
  workspaceMappings?: readonly WorkspaceMapping[],
): ToolRenderResult => {
  const { global, domain } = partitionRules(rules);
  const config = TOOL_OUTPUT_MAP[toolId];

  if (toolId === 'claude-code') {
    const { fileExtension } = config as (typeof TOOL_OUTPUT_MAP)['claude-code'];
    const files = rules.map((rule) => {
      const scopedGlobs = workspaceMappings ? buildScopedGlobs(rule, workspaceMappings) : undefined;
      return {
        fileName: `${rule.id}${fileExtension}`,
        content: renderClaudeCodeRule(rule, scopedGlobs),
      };
    });
    return { tool: 'claude-code', files };
  }

  const rootContent = renderRulesToMarkdown(global);
  const domainContent = renderRulesToMarkdown(domain);

  if (toolId === 'codex') {
    return { tool: 'codex', rootContent, domainContent };
  }

  // gemini
  return { tool: 'gemini', rootContent, domainContent };
};
