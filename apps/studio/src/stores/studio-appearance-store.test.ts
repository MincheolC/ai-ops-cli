import { beforeEach, describe, expect, it } from 'vitest';
import { studioThemePresets } from '@/theme/theme-preset-registry';
import {
  DEFAULT_STUDIO_APPEARANCE,
  STUDIO_APPEARANCE_STORAGE_KEY,
  coerceStudioAppearancePreference,
  coerceStudioThemePresetId,
  useStudioAppearanceStore,
} from './studio-appearance-store';

const resetAppearanceStore = (): void => {
  window.localStorage.clear();
  useStudioAppearanceStore.setState(DEFAULT_STUDIO_APPEARANCE);
};

describe('studio appearance store', () => {
  beforeEach(() => {
    resetAppearanceStore();
  });

  it('starts with the default appearance preference', () => {
    expect(useStudioAppearanceStore.getState()).toMatchObject({
      presetId: 'cohere',
      colorMode: 'system',
      density: 'comfortable',
      markdownSize: 'medium',
      codeBlockStyle: 'filled',
    });
  });

  it('allows every bundled preset id', () => {
    for (const preset of studioThemePresets) {
      useStudioAppearanceStore.getState().setPresetId(preset.id);
      expect(useStudioAppearanceStore.getState().presetId).toBe(preset.id);
    }
  });

  it('guards invalid preset ids on direct setter calls', () => {
    useStudioAppearanceStore.getState().setPresetId('x-ai');

    Reflect.apply(useStudioAppearanceStore.getState().setPresetId, undefined, ['unknown']);

    expect(useStudioAppearanceStore.getState().presetId).toBe('cohere');
  });

  it('coerces arbitrary preset id values to bundled ids', () => {
    expect(coerceStudioThemePresetId('linear-app')).toBe('linear-app');
    expect(coerceStudioThemePresetId('unknown')).toBe('cohere');
    expect(coerceStudioThemePresetId(null)).toBe('cohere');
  });

  it('recovers invalid persisted values to defaults', async () => {
    window.localStorage.setItem(
      STUDIO_APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        state: {
          presetId: 'unknown',
          colorMode: 'neon',
          density: 'wide',
          markdownSize: 'huge',
          codeBlockStyle: 'glass',
        },
        version: 0,
      }),
    );

    await useStudioAppearanceStore.persist.rehydrate();

    expect(useStudioAppearanceStore.getState()).toMatchObject(DEFAULT_STUDIO_APPEARANCE);
  });

  it('coerces partial invalid persisted values independently', () => {
    expect(
      coerceStudioAppearancePreference({
        presetId: 'x-ai',
        colorMode: 'sepia',
        density: 'compact',
        markdownSize: 'medium',
        codeBlockStyle: 'outline',
      }),
    ).toEqual({
      presetId: 'x-ai',
      colorMode: 'system',
      density: 'compact',
      markdownSize: 'medium',
      codeBlockStyle: 'outline',
    });
  });

  it('does not keep snapshot, project, or runtime payloads in the store', () => {
    const state = useStudioAppearanceStore.getState();

    expect(state).not.toHaveProperty('snapshot');
    expect(state).not.toHaveProperty('project');
    expect(state).not.toHaveProperty('runtime');
    expect(Object.keys(state).sort()).toEqual([
      'codeBlockStyle',
      'colorMode',
      'density',
      'markdownSize',
      'presetId',
      'resetAppearance',
      'setCodeBlockStyle',
      'setColorMode',
      'setDensity',
      'setMarkdownSize',
      'setPresetId',
    ]);
  });
});
