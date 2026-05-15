const MANAGED_MARKER = '<!-- managed by ai-ops -->';
const META_PATTERN = /^<!-- sourceHash: ([a-f0-9]{6}) \| generatedAt: (.+) -->$/;

const SECTION_START = '<!-- ai-ops:start -->';
const SECTION_END = '<!-- ai-ops:end -->';

export const hasLegacyHeader = (content: string): boolean => content.includes(MANAGED_MARKER);

export const wrapWithSection = (content: string, meta: { sourceHash: string; generatedAt: string }): string => {
  const metaLine = `<!-- sourceHash: ${meta.sourceHash} | generatedAt: ${meta.generatedAt} -->`;
  return `${SECTION_START}\n${metaLine}\n\n${content}\n${SECTION_END}`;
};

export const hasAiOpsSection = (content: string): boolean =>
  content.includes(SECTION_START) && content.includes(SECTION_END);

export const stripAiOpsSection = (content: string): string => {
  const startIdx = content.indexOf(SECTION_START);
  const endIdx = content.indexOf(SECTION_END);
  if (startIdx === -1 || endIdx === -1) return content;

  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(endIdx + SECTION_END.length).trimStart();
  return before + (after ? '\n\n' + after : '') + '\n';
};

export const extractAiOpsSectionContent = (content: string): string | null => {
  const startIdx = content.indexOf(SECTION_START);
  const endIdx = content.indexOf(SECTION_END);
  if (startIdx === -1 || endIdx === -1) return null;

  const section = content.slice(startIdx + SECTION_START.length, endIdx).trim();
  const lines = section.split('\n');
  const [, ...contentLines] = lines;
  return contentLines.join('\n').trimStart();
};

export const replaceAiOpsSection = (existing: string, newSection: string): string => {
  const startIdx = existing.indexOf(SECTION_START);
  const endIdx = existing.indexOf(SECTION_END);
  if (startIdx === -1 || endIdx === -1) return existing;

  const before = existing.slice(0, startIdx).trimEnd();
  const after = existing.slice(endIdx + SECTION_END.length).trimStart();

  // filter(Boolean)으로 빈 before/after 제거 → 불필요한 선행 \n\n 방지
  return [before, newSection, after].filter(Boolean).join('\n\n') + '\n';
};

export const parseAiOpsMeta = (content: string): { sourceHash: string; generatedAt: string } | null => {
  const startIdx = content.indexOf(SECTION_START);
  if (startIdx === -1) return null;

  const lines = content.slice(startIdx).split('\n');
  // lines[0] = '<!-- ai-ops:start -->', lines[1] = meta line
  const metaLine = lines[1] ?? '';
  const match = META_PATTERN.exec(metaLine);
  if (!match) return null;

  return { sourceHash: match[1], generatedAt: match[2] };
};
