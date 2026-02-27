const MANAGED_MARKER = '<!-- managed by ai-ops -->';
const META_PATTERN = /^<!-- sourceHash: ([a-f0-9]{6}) \| generatedAt: (.+) -->$/;

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
