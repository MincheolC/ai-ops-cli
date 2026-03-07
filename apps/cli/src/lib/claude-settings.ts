import * as p from '@clack/prompts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type ClaudeSettings = Record<string, unknown>;

type SettingGroup = {
  value: string;
  label: string;
  hint: string;
  patch: ClaudeSettings;
};

const SETTING_GROUPS: readonly SettingGroup[] = [
  {
    value: 'model',
    label: 'Model — Plan 모드 모델',
    hint: 'model: opusplan — Plan 모드에서 Opus 모델 사용',
    patch: { model: 'opusplan' },
  },
  {
    value: 'plansDirectory',
    label: 'Plans Directory — 계획 파일 저장 경로',
    hint: 'plansDirectory: ./.claude/plans — 계획 파일을 .claude/plans에 저장',
    patch: { plansDirectory: './.claude/plans' },
  },
] as const;

const deepMerge = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null
    ) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
};

// null → 건너뜀 (취소 또는 "No"), string[] → 선택된 항목
export const promptClaudeSettings = async (): Promise<readonly string[] | null> => {
  const wantSettings = await p.confirm({
    message: 'Claude Code 설정 파일(.claude/settings.local.json)을 설치하시겠습니까?',
    initialValue: true,
  });
  if (p.isCancel(wantSettings) || !wantSettings) return null;

  const selected = await p.multiselect<string>({
    message: '설치할 설정 항목을 선택하세요 (스페이스로 토글)',
    options: SETTING_GROUPS.map((g) => ({
      value: g.value,
      label: g.label,
      hint: g.hint,
    })),
    initialValues: SETTING_GROUPS.map((g) => g.value),
    required: false,
  });
  if (p.isCancel(selected)) return null;
  return selected as string[];
};

export const installClaudeSettings = (basePath: string, selectedValues: readonly string[]): void => {
  if (selectedValues.length === 0) return;

  const settingsDir = join(basePath, '.claude');
  const settingsPath = join(settingsDir, 'settings.local.json');

  let existing: ClaudeSettings = {};
  if (existsSync(settingsPath)) {
    try {
      existing = JSON.parse(readFileSync(settingsPath, 'utf-8')) as ClaudeSettings;
    } catch {
      // parse 실패 시 덮어쓰기
    }
  }

  let merged: ClaudeSettings = existing;
  for (const val of selectedValues) {
    const group = SETTING_GROUPS.find((g) => g.value === val);
    if (!group) continue;
    merged = deepMerge(merged, group.patch);
  }

  mkdirSync(settingsDir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
};
