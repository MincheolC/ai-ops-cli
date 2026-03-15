import type { PromptCancelled } from './prompt-control.js';
import {
  type SettingsUninstallStatus,
  type ToolSettingsConfig,
  installToolSettings,
  promptToolSettings,
  uninstallToolSettings,
} from './tool-settings.js';

const SETTING_GROUPS: ToolSettingsConfig['groups'] = [
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
];

const CONFIG: ToolSettingsConfig = {
  dirName: '.claude',
  fileName: 'settings.local.json',
  promptMessage: 'Claude Code 설정 파일(.claude/settings.local.json)을 설치하시겠습니까?',
  groups: SETTING_GROUPS,
};

// PromptCancelled → 사용자 취소, null → "No", string[] → 선택된 항목
export const promptClaudeSettings = (): Promise<readonly string[] | null | PromptCancelled> =>
  promptToolSettings(CONFIG);

export const installClaudeSettings = (basePath: string, selectedValues: readonly string[]): void =>
  installToolSettings(basePath, selectedValues, CONFIG);

export type { SettingsUninstallStatus };

export const uninstallClaudeSettings = (basePath: string, selectedValues: readonly string[]): SettingsUninstallStatus =>
  uninstallToolSettings(basePath, selectedValues, CONFIG);
