import { parse } from 'yaml';

export const parseMarkdownFrontmatter = (content: string): { frontmatter: unknown; body: string } => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error('Missing YAML frontmatter');
  }

  return {
    frontmatter: parse(match[1]),
    body: content.slice(match[0].length),
  };
};
