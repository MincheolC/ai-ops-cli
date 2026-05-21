import { readFileSync } from "node:fs";
import { computeHash } from "@/shared/source-hash.js";
import { ProjectLayerToolSchema } from "@/core/schemas/index.js";
import type { ProjectLayerTool } from "@/core/schemas/index.js";
import { DEFAULT_TOOLS, PROJECT_OWNED_PATHS, RESERVED_DOCUMENT_WARNINGS, TEMPLATE_PATHS, TOOL_ORDER } from "./constants.js";
import { parseProjectLayerFrontmatter } from "./document.logic.js";
import { resolveTemplatePath } from "./path.util.js";
import type { ProjectLayerTemplateSpec } from "./types.js";

// ----- template loading -----

export const resolveProjectLayerTools = (requestedTools?: readonly string[]): ProjectLayerTool[] => {
  if (requestedTools === undefined || requestedTools.length === 0) {
    return [...DEFAULT_TOOLS];
  }

  const parsedTools = requestedTools.map((tool) => ProjectLayerToolSchema.parse(tool));
  const toolSet = new Set(parsedTools);
  return TOOL_ORDER.filter((tool) => toolSet.has(tool));
};

const shouldIncludeTemplate = (relativePath: string, tools: readonly ProjectLayerTool[]): boolean => {
  if (relativePath === 'GEMINI.md') return tools.includes('gemini');
  if (relativePath === 'CLAUDE.md') return tools.includes('claude-code');
  return true;
};

const buildDocsStatusRows = (specs: readonly ProjectLayerTemplateSpec[]): string =>
  specs.map((spec) => `| ${spec.path} | ${spec.frontmatter.status} | ${spec.frontmatter.owner} |`).join('\n');

const includesReservedDocumentWarning = (content: string): boolean =>
  RESERVED_DOCUMENT_WARNINGS.some((warning) => content.includes(warning));

const loadTemplateSpec = (relativePath: string, content: string): ProjectLayerTemplateSpec => {
  const frontmatter = parseProjectLayerFrontmatter(content);
  const ownership = PROJECT_OWNED_PATHS.has(relativePath) ? 'project' : 'managed';

  if (frontmatter.status === 'Reserved' && !includesReservedDocumentWarning(content)) {
    throw new Error(`Reserved template must include warning text: ${relativePath}`);
  }

  return {
    path: relativePath,
    content,
    ownership,
    frontmatter,
    contentHash: computeHash([content.trimEnd()]),
  };
};

export const loadProjectLayerTemplateSpecs = (
  tools: readonly ProjectLayerTool[],
): readonly ProjectLayerTemplateSpec[] => {
  const selectedPaths = TEMPLATE_PATHS.filter((relativePath) => shouldIncludeTemplate(relativePath, tools));
  const nonStatusSpecs = selectedPaths
    .filter((relativePath) => relativePath !== 'docs/docs-status.md')
    .map((relativePath) => loadTemplateSpec(relativePath, readFileSync(resolveTemplatePath(relativePath), 'utf-8')));

  const statusTemplate = readFileSync(resolveTemplatePath('docs/docs-status.md'), 'utf-8');
  const statusPlaceholderSpec = loadTemplateSpec('docs/docs-status.md', statusTemplate);
  const specsForStatus = [...nonStatusSpecs, statusPlaceholderSpec].sort((a, b) => a.path.localeCompare(b.path));
  const statusContent = statusTemplate.replace('{{documents_table}}', buildDocsStatusRows(specsForStatus));
  const statusSpec = loadTemplateSpec('docs/docs-status.md', statusContent);

  return [...nonStatusSpecs, statusSpec].sort((a, b) => a.path.localeCompare(b.path));
};

export const computeProjectLayerSourceHash = (specs: readonly ProjectLayerTemplateSpec[]): string =>
  computeHash(specs.map((spec) => `${spec.path}:${spec.content}`));
