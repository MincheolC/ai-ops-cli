import type { Rule, DecisionTableEntry } from './schemas/index.js';

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
