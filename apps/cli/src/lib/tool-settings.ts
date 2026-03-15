import * as p from '@clack/prompts';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deepMerge, deepRemoveKeys } from './deep-merge.util.js';
import { PROMPT_CANCELLED, type PromptCancelled } from './prompt-control.js';

export type SettingGroup = {
  value: string;
  label: string;
  hint: string;
  patch: Record<string, unknown>;
};

export type ToolSettingsConfig = {
  dirName: string;
  fileName: string;
  promptMessage: string;
  groups: readonly SettingGroup[];
};

export type SettingsUninstallStatus = 'deleted' | 'cleaned' | 'notFound';

export const promptToolSettings = async (
  config: ToolSettingsConfig,
): Promise<readonly string[] | null | PromptCancelled> => {
  const want = await p.confirm({ message: config.promptMessage, initialValue: true });
  if (p.isCancel(want)) return PROMPT_CANCELLED;
  if (!want) return null;

  const selected = await p.multiselect<string>({
    message: '설치할 설정 항목을 선택하세요 (스페이스로 토글)',
    options: config.groups.map((g) => ({ value: g.value, label: g.label, hint: g.hint })),
    initialValues: config.groups.map((g) => g.value),
    required: false,
  });
  if (p.isCancel(selected)) return PROMPT_CANCELLED;
  return selected as string[];
};

export const installToolSettings = (
  basePath: string,
  selectedValues: readonly string[],
  config: ToolSettingsConfig,
): void => {
  if (selectedValues.length === 0) return;

  const settingsDir = join(basePath, config.dirName);
  const settingsPath = join(settingsDir, config.fileName);

  let existing: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      existing = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      // parse 실패 시 덮어쓰기
    }
  }

  let merged: Record<string, unknown> = existing;
  for (const val of selectedValues) {
    const group = config.groups.find((g) => g.value === val);
    if (!group) continue;
    merged = deepMerge(merged, group.patch);
  }

  mkdirSync(settingsDir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
};

export const uninstallToolSettings = (
  basePath: string,
  selectedValues: readonly string[],
  config: ToolSettingsConfig,
): SettingsUninstallStatus => {
  const settingsPath = join(basePath, config.dirName, config.fileName);

  if (!existsSync(settingsPath)) return 'notFound';

  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    rmSync(settingsPath, { force: true });
    return 'deleted';
  }

  let result: Record<string, unknown> = existing;
  for (const val of selectedValues) {
    const group = config.groups.find((g) => g.value === val);
    if (!group) continue;
    result = deepRemoveKeys(result, group.patch) as Record<string, unknown>;
  }

  if (Object.keys(result).length === 0) {
    rmSync(settingsPath, { force: true });
    return 'deleted';
  }

  writeFileSync(settingsPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  return 'cleaned';
};
