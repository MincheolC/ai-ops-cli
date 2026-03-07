import * as p from '@clack/prompts';
import { join } from 'node:path';
import type { Rule, Preset, ToolId, WorkspaceMapping } from '@/core/index.js';
import {
  loadAllRules,
  loadPresets,
  resolvePresetRules,
  resolvePresetRuleGroups,
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
  TOOL_OUTPUT_MAP,
} from '@/core/index.js';
import type { FileAction } from '@/core/index.js';
import { resolveBasePath, resolveRulesDir, resolvePresetsPath } from '../lib/paths.js';
import { listWorkspaceCandidates } from '../lib/workspace.js';
import { installFiles } from '../lib/install.js';
import { promptGeminiSettings, installGeminiSettings } from '../lib/gemini-settings.js';
import { promptClaudeSettings, installClaudeSettings } from '../lib/claude-settings.js';

type WorkspacePresetMapping = {
  workspace: string;
  preset: Preset;
  finalRules: Rule[];
};

type InstallStats = { written: string[]; appended: string[] };

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

  const presetRuleGroups = resolvePresetRuleGroups(preset, allRules);
  const globalGroups = presetRuleGroups.filter((group) => group.rules.every(isGlobalRule));
  const domainGroups = presetRuleGroups.filter((group) => !group.rules.every(isGlobalRule));
  const globalGroupIds = globalGroups.map((group) => group.id);
  const globalRules =
    globalGroupIds.length > 0 ? resolvePresetRules({ ...preset, rules: globalGroupIds }, allRules) : [];

  // Global rules: locked (항상 포함)
  if (globalRules.length > 0) {
    p.note(globalRules.map((r) => `  ✓ ${r.id}`).join('\n'), `[${workspaceName}] 기본 규칙 (잠금)`);
  }

  if (domainGroups.length === 0) {
    return { workspace: workspaceName, preset, finalRules: resolvePresetRules(preset, allRules) };
  }

  // Domain rules: 제외 가능
  const selectedDomain = await p.multiselect<string>({
    message: `[${workspaceName}] 도메인 규칙 선택 (해제하여 제외)`,
    options: domainGroups.map((group) => ({ value: group.id, label: group.id })),
    initialValues: domainGroups.map((group) => group.id),
    required: false,
  });
  if (p.isCancel(selectedDomain)) return null;

  const selectedLogicalRuleIds = [...globalGroupIds, ...(selectedDomain as string[])];
  return {
    workspace: workspaceName,
    preset,
    finalRules: resolvePresetRules({ ...preset, rules: selectedLogicalRuleIds }, allRules),
  };
};

const installHierarchicalMonorepo = (
  toolId: 'codex' | 'gemini',
  mappings: readonly WorkspacePresetMapping[],
  basePath: string,
  meta: { sourceHash: string; generatedAt: string },
): InstallStats => {
  const config = TOOL_OUTPUT_MAP[toolId];
  const written: string[] = [];
  const appended: string[] = [];

  const allRules = deduplicateRules(mappings.flatMap((m) => m.finalRules));
  const { global } = partitionRules(allRules);

  if (global.length > 0) {
    const rootAction: FileAction = {
      relativePath: join(config.dir, config.rootFileName),
      content: wrapWithHeader(renderRulesToMarkdown(global), meta),
    };
    const r = installFiles(basePath, [rootAction], meta);
    written.push(...r.written);
    appended.push(...r.appended);
  }

  for (const mapping of mappings) {
    const { domain } = partitionRules(mapping.finalRules);
    if (domain.length === 0) continue;

    const domainAction: FileAction = {
      relativePath: join(mapping.workspace, config.domainFileName),
      content: wrapWithHeader(renderRulesToMarkdown(domain), meta),
    };
    const r = installFiles(basePath, [domainAction], meta);
    written.push(...r.written);
    appended.push(...r.appended);
  }

  return { written, appended };
};

const installClaudeCodeMonorepo = (
  mappings: readonly WorkspacePresetMapping[],
  basePath: string,
  meta: { sourceHash: string; generatedAt: string },
): InstallStats => {
  const allRules = deduplicateRules(mappings.flatMap((m) => m.finalRules));
  const workspaceMappings: WorkspaceMapping[] = mappings.map((m) => ({
    path: m.workspace,
    ruleIds: m.finalRules.map((r) => r.id),
  }));
  const renderResult = renderForTool('claude-code', allRules, workspaceMappings);
  const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
  const r = installFiles(basePath, actions, meta);
  return { written: r.written, appended: r.appended };
};

export const initCommand = async (): Promise<void> => {
  const basePath = resolveBasePath();
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

  // 4.5. Gemini 설정 (gemini 선택 시)
  const geminiSettingValues: readonly string[] | null = (selectedTools as ToolId[]).includes('gemini')
    ? await promptGeminiSettings()
    : null;

  // 4.6. Claude 설정 (claude-code 선택 시)
  const claudeSettingValues: readonly string[] | null = (selectedTools as ToolId[]).includes('claude-code')
    ? await promptClaudeSettings()
    : null;

  // 5. 설치
  const s = p.spinner();
  s.start('규칙 설치 중...');

  const meta = { sourceHash, generatedAt: new Date().toISOString() };
  const allInstalledFiles: string[] = [];
  const allAppended: string[] = [];

  for (const toolId of selectedTools as ToolId[]) {
    if (isMonorepo) {
      if (toolId === 'claude-code') {
        const stats = installClaudeCodeMonorepo(mappings, basePath, meta);
        allInstalledFiles.push(...stats.written);
        allAppended.push(...stats.appended);
      } else {
        const stats = installHierarchicalMonorepo(toolId, mappings, basePath, meta);
        allInstalledFiles.push(...stats.written);
        allAppended.push(...stats.appended);
      }
    } else {
      const renderResult = renderForTool(toolId, mappings[0].finalRules);
      const actions = buildInstallPlan({ toolId, renderResult, meta });
      const result = installFiles(basePath, actions, meta);
      allInstalledFiles.push(...result.written);
      allAppended.push(...result.appended);
    }
  }

  if (geminiSettingValues && geminiSettingValues.length > 0) {
    installGeminiSettings(basePath, geminiSettingValues);
    allInstalledFiles.push('.gemini/settings.json');
  }

  if (claudeSettingValues && claudeSettingValues.length > 0) {
    installClaudeSettings(basePath, claudeSettingValues);
    allInstalledFiles.push('.claude/settings.local.json');
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
    scope: 'project',
    preset: !isMonorepo ? mappings[0].preset.id : undefined,
    workspaces: workspacesRecord,
    installedRules: allInstalledRuleIds,
    installedFiles: allInstalledFiles,
    appendedFiles: allAppended,
    settings:
      claudeSettingValues || geminiSettingValues
        ? {
            claude: claudeSettingValues ? [...claudeSettingValues] : undefined,
            gemini: geminiSettingValues ? [...geminiSettingValues] : undefined,
          }
        : undefined,
    sourceHash,
  });
  writeManifest(resolveManifestPath(basePath), manifest);

  // 7. 결과 요약
  if (allAppended.length > 0) {
    p.log.info(`기존 파일에 섹션 추가됨 (내용 보존):\n${allAppended.map((f) => `  ${f}`).join('\n')}`);
  }
  p.log.success(`설치된 규칙: ${allInstalledRuleIds.length}개`);
  p.outro('ai-ops init 완료');
};
