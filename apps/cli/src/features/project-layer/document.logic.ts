import { parseMarkdownFrontmatter } from "@/shared/markdown/frontmatter.js";
import { computeHash } from "@/shared/source-hash.js";
import { extractAiOpsSectionContent } from "./managed-header.js";
import { ProjectLayerFrontmatterSchema } from "@/core/schemas/index.js";
import type { ProjectLayerFrontmatter } from "@/core/schemas/index.js";
import type { ProjectLayerDocumentReadResult } from "./types.js";

export const parseProjectLayerFrontmatter = (content: string): ProjectLayerFrontmatter => {
  const { frontmatter } = parseMarkdownFrontmatter(content);
  return ProjectLayerFrontmatterSchema.parse(frontmatter);
};

export const parseProjectLayerDocument = (path: string, rawContent: string): ProjectLayerDocumentReadResult => {
  const managedContent = extractAiOpsSectionContent(rawContent);
  const content = managedContent ?? rawContent;
  const frontmatter = parseProjectLayerFrontmatter(content);

  return {
    path,
    status: frontmatter.status,
    layer: frontmatter.layer,
    owner: frontmatter.owner,
    read_when: frontmatter.read_when,
    update_when: frontmatter.update_when,
    contentHash: computeHash([content.trimEnd()]),
    content,
  };
};
