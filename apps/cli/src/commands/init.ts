import * as p from '@clack/prompts';
import { join } from 'node:path';
import type { Rule, Preset, ToolId } from 'ai-ops-compiler';
import {
  loadAllRules,
  loadPresets,
  resolvePresetRules,
  excludeRules,
  isGlobalRule,
  partitionRules,
  renderForTool,
  renderRulesToMarkdown,
  buildInstallPlan,
  buildManifest,
  computeSourceHash,
  resolveManifestPath,
  writeManifest,
  wrapWithHeader,
} from 'ai-ops-compiler';
import type { FileAction } from 'ai-ops-compiler';
import type { Scope } from '../lib/paths.js';
import { resolveBasePath, resolveRulesDir, resolvePresetsPath } from '../lib/paths.js';
import { listWorkspaceCandidates } from '../lib/workspace.js';
import { installFiles } from '../lib/install.js';

type WorkspacePresetMapping = {
  workspace: string;
  preset: Preset;
  finalRules: Rule[];
};

const TOOL_OPTIONS = [
  { value: 'claude-code' as ToolId, label: 'Claude Code' },
  { value: 'codex' as ToolId, label: 'Codex' },
  { value: 'gemini' as ToolId, label: 'Gemini CLI' },
];

const deduplicateRules = (rules: readonly Rule[]): Rule[] => {
  const seen = new Set<string>();
  return rules.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
};

const selectPresetAndFineTune = async (
  workspaceName: string,
  presets: readonly Preset[],
  allRules: readonly Rule[],
): Promise<WorkspacePresetMapping | null> => {
  const preset = await p.select<Preset>({
    message: `[${workspaceName}] 프리셋을 선택하세요`,
    options: presets.map((pr) => ({
      value: pr,
      label: pr.id,
      hint: pr.description,
    })),
  });
  if (p.isCancel(preset)) return null;

  const presetRules = resolvePresetRules(preset, allRules);
  const globalRules = presetRules.filter(isGlobalRule);
  const domainRules = presetRules.filter((r) => !isGlobalRule(r));

  // Global rules: locked (항상 포함)
  if (globalRules.length > 0) {
    p.note(globalRules.map((r) => `  ✓ ${r.id}`).join('\n'), `[${workspaceName}] 기본 규칙 (잠금)`);
  }

  if (domainRules.length === 0) {
    return { workspace: workspaceName, preset, finalRules: presetRules };
  }

  // Domain rules: 제외 가능
  const selectedDomain = await p.multiselect<string>({
    message: `[${workspaceName}] 도메인 규칙 선택 (해제하여 제외)`,
    options: domainRules.map((r) => ({ value: r.id, label: r.id })),
    initialValues: domainRules.map((r) => r.id),
    required: false,
  });
  if (p.isCancel(selectedDomain)) return null;

  const excludeIds = domainRules.map((r) => r.id).filter((id) => !(selectedDomain as string[]).includes(id));

  return { workspace: workspaceName, preset, finalRules: excludeRules(presetRules, excludeIds) };
};

const installHierarchicalMonorepo = (
  toolId: 'codex' | 'gemini',
  mappings: readonly WorkspacePresetMapping[],
  basePath: string,
  meta: { sourceHash: string; generatedAt: string },
): void => {
  const rootFileName = toolId === 'codex' ? 'AGENTS.md' : 'GEMINI.md';
  const domainFileName = toolId === 'codex' ? 'AGENTS.override.md' : 'GEMINI.md';

  const allRules = deduplicateRules(mappings.flatMap((m) => m.finalRules));
  const { global } = partitionRules(allRules);

  if (global.length > 0) {
    const rootAction: FileAction = {
      relativePath: rootFileName,
      content: wrapWithHeader(renderRulesToMarkdown(global), meta),
    };
    installFiles(basePath, [rootAction]);
  }

  for (const mapping of mappings) {
    const { domain } = partitionRules(mapping.finalRules);
    if (domain.length === 0) continue;

    const domainAction: FileAction = {
      relativePath: join(mapping.workspace, domainFileName),
      content: wrapWithHeader(renderRulesToMarkdown(domain), meta),
    };
    installFiles(basePath, [domainAction]);
  }
};

const installClaudeCodeMonorepo = (
  mappings: readonly WorkspacePresetMapping[],
  basePath: string,
  meta: { sourceHash: string; generatedAt: string },
): void => {
  const allRules = deduplicateRules(mappings.flatMap((m) => m.finalRules));
  const renderResult = renderForTool('claude-code', allRules);
  const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
  installFiles(basePath, actions);
};

export const initCommand = async (opts: { scope: Scope }): Promise<void> => {
  const basePath = resolveBasePath(opts.scope);
  const rulesDir = resolveRulesDir();

  p.intro('ai-ops init');

  // 1. AI 도구 다중 선택
  const selectedTools = await p.multiselect<ToolId>({
    message: 'AI 도구를 선택하세요',
    options: TOOL_OPTIONS,
    required: true,
  });
  if (p.isCancel(selectedTools)) {
    p.cancel('취소됨');
    process.exit(0);
  }

  // 2. 모노레포 여부
  const isMonorepo = await p.confirm({
    message: '모노레포 프로젝트입니까?',
    initialValue: false,
  });
  if (p.isCancel(isMonorepo)) {
    p.cancel('취소됨');
    process.exit(0);
  }

  // 3. 데이터 로드
  const allRules = loadAllRules(rulesDir);
  const presets = loadPresets(resolvePresetsPath());
  const sourceHash = computeSourceHash(rulesDir);

  // 4. 워크스페이스별 preset 선택 + fine-tune
  const mappings: WorkspacePresetMapping[] = [];

  if (!isMonorepo) {
    const mapping = await selectPresetAndFineTune('.', presets, allRules);
    if (!mapping) {
      p.cancel('취소됨');
      process.exit(0);
    }
    mappings.push(mapping);
  } else {
    const candidates = listWorkspaceCandidates(basePath);
    const selectedWorkspaces = await p.multiselect<string>({
      message: '워크스페이스를 선택하세요',
      options: candidates.map((c) => ({ value: c, label: c })),
      required: true,
    });
    if (p.isCancel(selectedWorkspaces)) {
      p.cancel('취소됨');
      process.exit(0);
    }

    for (const ws of selectedWorkspaces as string[]) {
      const mapping = await selectPresetAndFineTune(ws, presets, allRules);
      if (!mapping) {
        p.cancel('취소됨');
        process.exit(0);
      }
      mappings.push(mapping);
    }
  }

  // 5. 설치
  const s = p.spinner();
  s.start('규칙 설치 중...');

  const meta = { sourceHash, generatedAt: new Date().toISOString() };
  const allSkipped: string[] = [];

  for (const toolId of selectedTools as ToolId[]) {
    if (isMonorepo) {
      if (toolId === 'claude-code') {
        installClaudeCodeMonorepo(mappings, basePath, meta);
      } else {
        installHierarchicalMonorepo(toolId, mappings, basePath, meta);
      }
    } else {
      const renderResult = renderForTool(toolId, mappings[0].finalRules);
      const actions = buildInstallPlan({ toolId, renderResult, meta });
      const result = installFiles(basePath, actions);
      allSkipped.push(...result.skipped);
    }
  }

  s.stop('규칙 설치 완료');

  // 6. Manifest 저장
  const allInstalledRuleIds = deduplicateRules(mappings.flatMap((m) => m.finalRules)).map((r) => r.id);

  const workspacesRecord = isMonorepo
    ? Object.fromEntries(
        mappings.map((m) => [m.workspace, { preset: m.preset.id, rules: m.finalRules.map((r) => r.id) }]),
      )
    : undefined;

  const manifest = buildManifest({
    tools: selectedTools as string[],
    scope: opts.scope,
    preset: !isMonorepo ? mappings[0].preset.id : undefined,
    workspaces: workspacesRecord,
    installedRules: allInstalledRuleIds,
    sourceHash,
  });
  writeManifest(resolveManifestPath(basePath), manifest);

  // 7. 결과 요약
  if (allSkipped.length > 0) {
    p.log.warn(`충돌(non-managed) 파일 건너뜀:\n${allSkipped.map((f) => `  ${f}`).join('\n')}`);
  }
  p.log.success(`설치된 규칙: ${allInstalledRuleIds.length}개`);
  p.outro('ai-ops init 완료');
};
