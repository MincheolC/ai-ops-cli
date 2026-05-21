import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { ProjectLayerManifestSchema } from '@/core/schemas/index.js';
import type { ProjectLayerManifest, ProjectLayerProjectFile } from '@/core/schemas/index.js';
import { CUSTOM_PROJECT_RULES_DIR } from './constants.js';
import { parseProjectLayerDocument } from './document.logic.js';
import { resolveProjectLayerFilePath } from './path.util.js';

const isMarkdownPath = (path: string): boolean => path.endsWith('.md');

const hasMarkdownFrontmatter = (content: string): boolean => content.startsWith('---\n');

const assertCustomProjectRuleContract = (params: { path: string; owner: string; layer: string }): void => {
  if (params.owner !== 'project') {
    throw new Error(`${params.path} owner는 project여야 합니다. 현재 값: ${params.owner}`);
  }

  if (params.layer !== 'agent') {
    throw new Error(`${params.path} layer는 agent여야 합니다. 현재 값: ${params.layer}`);
  }
};

export const isCustomProjectRulePath = (path: string): boolean =>
  path.startsWith(`${CUSTOM_PROJECT_RULES_DIR}/`) && isMarkdownPath(path);

const collectMarkdownPaths = (params: { basePath: string; relativeDir: string }): string[] => {
  const absoluteDir = resolveProjectLayerFilePath(params.basePath, params.relativeDir);
  if (!existsSync(absoluteDir)) {
    return [];
  }

  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${params.relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      return collectMarkdownPaths({ basePath: params.basePath, relativeDir: relativePath });
    }

    return entry.isFile() && isMarkdownPath(relativePath) ? [relativePath] : [];
  });
};

export const discoverCustomProjectRuleFiles = (basePath: string): ProjectLayerProjectFile[] =>
  collectMarkdownPaths({ basePath, relativeDir: CUSTOM_PROJECT_RULES_DIR })
    .sort((left, right) => left.localeCompare(right))
    .flatMap((path) => {
      const content = readFileSync(resolveProjectLayerFilePath(basePath, path), 'utf-8');
      if (!hasMarkdownFrontmatter(content)) {
        return [];
      }

      try {
        const document = parseProjectLayerDocument(path, content);
        assertCustomProjectRuleContract({
          path,
          owner: document.owner,
          layer: document.layer,
        });

        return [
          {
            path,
            templateHash: document.contentHash,
            created: false,
          },
        ];
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        throw new Error(`${path} frontmatter 파싱 실패: ${reason}`);
      }
    });

export const syncCustomProjectRuleFiles = (params: {
  basePath: string;
  manifest: ProjectLayerManifest;
}): ProjectLayerManifest => {
  const customFiles = discoverCustomProjectRuleFiles(params.basePath);
  const customPathSet = new Set(customFiles.map((file) => file.path));
  const projectFilesByPath = new Map<string, ProjectLayerProjectFile>();

  for (const file of params.manifest.project_files) {
    if (!isCustomProjectRulePath(file.path) || customPathSet.has(file.path)) {
      projectFilesByPath.set(file.path, file);
    }
  }

  for (const file of customFiles) {
    projectFilesByPath.set(file.path, file);
  }

  return ProjectLayerManifestSchema.parse({
    ...params.manifest,
    project_files: [...projectFilesByPath.values()].sort((left, right) => left.path.localeCompare(right.path)),
  });
};
