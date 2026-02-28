import * as p from '@clack/prompts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type GeminiSettings = {
  ui?: { showLineNumbers?: boolean };
  general?: {
    plan?: { directory?: string; modelRouting?: boolean };
    sessionRetention?: { maxAge?: string };
  };
  experimental?: { jitContext?: boolean; plan?: boolean };
};

type SettingGroup = {
  value: string;
  label: string;
  hint: string;
  patch: GeminiSettings;
};

const SETTING_GROUPS: readonly SettingGroup[] = [
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
export const promptGeminiSettings = async (): Promise<readonly string[] | null> => {
  const wantSettings = await p.confirm({
    message: 'Gemini CLI 설정 파일(.gemini/settings.json)을 설치하시겠습니까?',
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

export const installGeminiSettings = (basePath: string, selectedValues: readonly string[]): void => {
  if (selectedValues.length === 0) return;

  const settingsDir = join(basePath, '.gemini');
  const settingsPath = join(settingsDir, 'settings.json');

  let existing: GeminiSettings = {};
  if (existsSync(settingsPath)) {
    try {
      existing = JSON.parse(readFileSync(settingsPath, 'utf-8')) as GeminiSettings;
    } catch {
      // parse 실패 시 덮어쓰기
    }
  }

  let merged: GeminiSettings = existing;
  for (const val of selectedValues) {
    const group = SETTING_GROUPS.find((g) => g.value === val);
    if (!group) continue;
    merged = deepMerge(merged as Record<string, unknown>, group.patch as Record<string, unknown>) as GeminiSettings;
  }

  mkdirSync(settingsDir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
};
