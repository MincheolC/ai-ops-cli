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
    value: 'ui',
    label: 'UI — 줄 번호 숨기기',
    hint: 'ui.showLineNumbers: false — 코드 복사 시 줄 번호가 포함되지 않도록 비활성화',
    patch: { ui: { showLineNumbers: false } },
  },
  {
    value: 'plan',
    label: 'Plan — 계획 파일 저장 및 모델 라우팅',
    hint: 'general.plan.directory: .gemini/plans, modelRouting: true — AI 계획을 파일로 저장하고 태스크별 최적 모델 자동 선택',
    patch: { general: { plan: { directory: '.gemini/plans', modelRouting: true } } },
  },
  {
    value: 'sessionRetention',
    label: 'Session Retention — 세션 30일 보존',
    hint: 'general.sessionRetention.maxAge: 30d — 이전 대화 컨텍스트를 30일간 유지',
    patch: { general: { sessionRetention: { maxAge: '30d' } } },
  },
  {
    value: 'experimental',
    label: 'Experimental — JIT 컨텍스트 + Plan 기능',
    hint: 'experimental.jitContext: true, plan: true — 서브디렉토리 컨텍스트 지연 로딩 및 계획 기능 실험적 활성화',
    patch: { experimental: { jitContext: true, plan: true } },
  },
];

const CONFIG: ToolSettingsConfig = {
  dirName: '.gemini',
  fileName: 'settings.json',
  promptMessage: 'Gemini CLI 설정 파일(.gemini/settings.json)을 설치하시겠습니까?',
  groups: SETTING_GROUPS,
};

// PromptCancelled → 사용자 취소, null → "No", string[] → 선택된 항목
export const promptGeminiSettings = (): Promise<readonly string[] | null | PromptCancelled> =>
  promptToolSettings(CONFIG);

export const installGeminiSettings = (basePath: string, selectedValues: readonly string[]): void =>
  installToolSettings(basePath, selectedValues, CONFIG);

export type { SettingsUninstallStatus };

export const uninstallGeminiSettings = (basePath: string, selectedValues: readonly string[]): SettingsUninstallStatus =>
  uninstallToolSettings(basePath, selectedValues, CONFIG);
