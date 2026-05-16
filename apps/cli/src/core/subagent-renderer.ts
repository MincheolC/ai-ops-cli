import { resolve } from 'node:path';
import { computeInstalledSubagentHash } from './source-hash.js';
import { buildSubagentRelativePath } from './subagent-paths.js';
import { renderFlatToml } from './subagent-toml.js';
import type { CodexSubagentFrontmatter, InstalledSubagent, Subagent } from './schemas/index.js';
import type { ToolId } from './tool-output.js';

type SubagentPackageFile = {
  relativePath: string;
  content: string;
};

export type SubagentPackage = {
  subagentId: string;
  files: SubagentPackageFile[];
};

export type RequiredSubagentSkill = {
  tool: ToolId;
  skillName: string;
  path: string;
};

const normalizeSelectedTools = (subagent: Subagent, requestedTools: readonly ToolId[]): ToolId[] => {
  const supportedToolSet = new Set(subagent.supported_tools);
  return requestedTools.filter((toolId) => supportedToolSet.has(toolId));
};

const renderMarkdownSubagent = (params: { rawFrontmatter: string; prompt: string }): string =>
  `---\n${params.rawFrontmatter.trimEnd()}\n---\n\n${params.prompt.trimEnd()}\n`;

const getCodexTomlEntries = (frontmatter: CodexSubagentFrontmatter): [string, string | number | boolean | string[]][] =>
  Object.entries(frontmatter).filter(
    (entry): entry is [string, string | number | boolean | string[]] =>
      entry[0] !== 'skill_names' &&
      (typeof entry[1] === 'string' ||
        typeof entry[1] === 'number' ||
        typeof entry[1] === 'boolean' ||
        (Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string'))),
  );

const renderCodexSubagent = (params: {
  frontmatter: CodexSubagentFrontmatter;
  prompt: string;
  userBasePath: string;
}): string => {
  const metadata = renderFlatToml(getCodexTomlEntries(params.frontmatter));
  const skills = (params.frontmatter.skill_names ?? []).map((skillName) => {
    const skillPath = resolve(params.userBasePath, '.agents', 'skills', skillName, 'SKILL.md');
    return `[[skills.config]]\npath = ${JSON.stringify(skillPath)}\nenabled = true`;
  });
  const sections = [
    metadata,
    `developer_instructions = ${JSON.stringify(params.prompt.trimEnd())}`,
    ...skills,
  ].filter((section) => section.length > 0);

  return sections.join('\n\n') + '\n';
};

const renderSubagentForTool = (params: { subagent: Subagent; toolId: ToolId; userBasePath: string }): string => {
  if (params.toolId === 'claude-code') {
    return renderMarkdownSubagent({
      rawFrontmatter: params.subagent.frontmatter.claude.raw,
      prompt: params.subagent.prompt,
    });
  }

  if (params.toolId === 'gemini') {
    return renderMarkdownSubagent({
      rawFrontmatter: params.subagent.frontmatter.gemini.raw,
      prompt: params.subagent.prompt,
    });
  }

  return renderCodexSubagent({
    frontmatter: params.subagent.frontmatter.codex.parsed,
    prompt: params.subagent.prompt,
    userBasePath: params.userBasePath,
  });
};

const getSelectedMetadataFiles = (subagent: Subagent, selectedTools: readonly ToolId[]): string[] =>
  selectedTools.map((toolId) => {
    if (toolId === 'claude-code') return `claude:${subagent.frontmatter.claude.raw}`;
    if (toolId === 'gemini') return `gemini:${subagent.frontmatter.gemini.raw}`;
    return `codex:${subagent.frontmatter.codex.raw}`;
  });

const getStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
};

const buildRequiredSubagentSkills = (params: {
  subagent: Subagent;
  selectedTools: readonly ToolId[];
  userBasePath: string;
}): RequiredSubagentSkill[] => {
  const required: RequiredSubagentSkill[] = [];

  if (params.selectedTools.includes('codex')) {
    for (const skillName of params.subagent.frontmatter.codex.parsed.skill_names ?? []) {
      required.push({
        tool: 'codex',
        skillName,
        path: resolve(params.userBasePath, '.agents', 'skills', skillName, 'SKILL.md'),
      });
    }
  }

  if (params.selectedTools.includes('claude-code')) {
    for (const skillName of getStringArray(params.subagent.frontmatter.claude.parsed['skills'])) {
      required.push({
        tool: 'claude-code',
        skillName,
        path: resolve(params.userBasePath, '.claude', 'skills', skillName, 'SKILL.md'),
      });
    }
  }

  return required;
};

export const buildSubagentInstallPlan = (params: {
  subagent: Subagent;
  requestedTools: readonly ToolId[];
  userBasePath: string;
}): {
  packages: SubagentPackage[];
  installedSubagent: InstalledSubagent;
  requiredSkills: RequiredSubagentSkill[];
} => {
  const selectedTools = normalizeSelectedTools(params.subagent, params.requestedTools);
  if (selectedTools.length === 0) {
    throw new Error(`Subagent ${params.subagent.id} does not support the requested tools`);
  }

  const files = selectedTools.map((toolId) => ({
    relativePath: buildSubagentRelativePath(params.subagent.id, toolId),
    content: renderSubagentForTool({
      subagent: params.subagent,
      toolId,
      userBasePath: params.userBasePath,
    }),
  }));
  const subagentHash = computeInstalledSubagentHash({
    id: params.subagent.id,
    tools: selectedTools,
    prompt: params.subagent.prompt,
    metadataFiles: getSelectedMetadataFiles(params.subagent, selectedTools),
  });

  return {
    packages: [
      {
        subagentId: params.subagent.id,
        files,
      },
    ],
    installedSubagent: {
      id: params.subagent.id,
      tools: selectedTools,
      installed_paths: files.map((file) => file.relativePath),
      sourceHash: subagentHash,
    },
    requiredSkills: buildRequiredSubagentSkills({
      subagent: params.subagent,
      selectedTools,
      userBasePath: params.userBasePath,
    }),
  };
};
