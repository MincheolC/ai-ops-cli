import { join } from 'node:path';
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

export type WorkspaceMapping = {
  path: string;
  ruleIds: readonly string[];
};

// 단일 Rule → Claude Code용 Markdown
// domain 룰이면서 glob 매핑이 있으면 paths: frontmatter 추가 (단일 프로젝트 전용)
// global 룰 또는 매핑 없는 domain 룰 → frontmatter 없음
export const renderClaudeCodeRule = (rule: Rule): string => {
  const globs = CLAUDE_CODE_PATH_GLOBS[rule.id];
  if (!isGlobalRule(rule) && globs !== undefined) {
    return `${renderFrontmatter(globs)}\n\n${renderRuleToMarkdown(rule)}`;
  }
  return renderRuleToMarkdown(rule);
};

// 도구별 렌더링 결과 타입 (tagged union)
export type ClaudeCodeRenderResult = {
  tool: 'claude-code';
  files: { relativePath: string; content: string }[];
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
export const renderForTool = (
  toolId: ToolId,
  rules: readonly Rule[],
  workspaceMappings?: readonly WorkspaceMapping[],
): ToolRenderResult => {
  const config = TOOL_OUTPUT_MAP[toolId];

  if (toolId === 'claude-code') {
    const { rulesDir, fileExtension } = config as (typeof TOOL_OUTPUT_MAP)['claude-code'];

    if (!workspaceMappings || workspaceMappings.length === 0) {
      // 단일 프로젝트: domain 룰에 paths: frontmatter (path-scoped)
      const files = rules.map((rule) => ({
        relativePath: join(rulesDir, `${rule.id}${fileExtension}`),
        content: renderClaudeCodeRule(rule),
      }));
      return { tool: 'claude-code', files };
    }

    // 모노레포: global → .claude/rules/, domain → {workspace}/CLAUDE.md (진짜 지연 로딩)
    const { global, domain } = partitionRules(rules);

    const globalFiles = global.map((rule) => ({
      relativePath: join(rulesDir, `${rule.id}${fileExtension}`),
      content: renderRuleToMarkdown(rule), // global은 frontmatter 불필요
    }));

    const workspaceFiles: { relativePath: string; content: string }[] = [];
    for (const ws of workspaceMappings) {
      const wsRules = domain.filter((r) => ws.ruleIds.includes(r.id));
      if (wsRules.length === 0) continue;
      workspaceFiles.push({
        relativePath: join(ws.path, 'CLAUDE.md'),
        content: renderRulesToMarkdown(wsRules),
      });
    }

    return { tool: 'claude-code', files: [...globalFiles, ...workspaceFiles] };
  }

  const { global, domain } = partitionRules(rules);
  const rootContent = renderRulesToMarkdown(global);
  const domainContent = renderRulesToMarkdown(domain);

  if (toolId === 'codex') {
    return { tool: 'codex', rootContent, domainContent };
  }

  // gemini
  return { tool: 'gemini', rootContent, domainContent };
};
