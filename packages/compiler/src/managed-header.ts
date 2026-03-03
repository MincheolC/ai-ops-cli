const MANAGED_MARKER = '<!-- managed by ai-ops -->';
const META_PATTERN = /^<!-- sourceHash: ([a-f0-9]{6}) \| generatedAt: (.+) -->$/;

const SECTION_START = '<!-- ai-ops:start -->';
const SECTION_END = '<!-- ai-ops:end -->';

export const wrapWithHeader = (content: string, meta: { sourceHash: string; generatedAt: string }): string => {
  const metaLine = `<!-- sourceHash: ${meta.sourceHash} | generatedAt: ${meta.generatedAt} -->`;
  return `${MANAGED_MARKER}\n${metaLine}\n\n${content}`;
};

export const isManagedFile = (content: string): boolean => content.startsWith(MANAGED_MARKER);

export const parseManagedHeader = (content: string): { sourceHash: string; generatedAt: string } | null => {
  if (!isManagedFile(content)) return null;

  const lines = content.split('\n');
  const metaLine = lines[1] ?? '';
  const match = META_PATTERN.exec(metaLine);
  if (!match) return null;

  return { sourceHash: match[1], generatedAt: match[2] };
};

export const stripManagedHeader = (content: string): string => {
  if (!isManagedFile(content)) return content;

  const lines = content.split('\n');
  // marker line + meta line + blank line = 3 lines
  const stripped = lines.slice(3).join('\n');
  return stripped;
};

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

export const replaceAiOpsSection = (existing: string, newSection: string): string => {
  const startIdx = existing.indexOf(SECTION_START);
  const endIdx = existing.indexOf(SECTION_END);
  if (startIdx === -1 || endIdx === -1) return existing;

  const before = existing.slice(0, startIdx).trimEnd();
  const after = existing.slice(endIdx + SECTION_END.length).trimStart();
  return before + '\n\n' + newSection + (after ? '\n\n' + after : '') + '\n';
};
