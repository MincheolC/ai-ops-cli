import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_STUDIO_APPEARANCE, useStudioAppearanceStore } from '@/stores/studio-appearance-store';
import { getStudioThemePreset } from './theme-preset-registry';
import { StudioAppearanceProvider, applyStudioThemeToRoot } from './theme-application';

const root = document.documentElement;

const resetRootTheme = (): void => {
  root.removeAttribute('data-theme-preset');
  root.removeAttribute('data-color-mode');
  root.removeAttribute('data-effective-color-mode');
  root.removeAttribute('data-density');
  root.removeAttribute('data-markdown-size');
  root.removeAttribute('data-code-block-style');
  root.removeAttribute('style');
};

describe('studio theme application', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useStudioAppearanceStore.setState(DEFAULT_STUDIO_APPEARANCE);
    resetRootTheme();
  });

  afterEach(() => {
    cleanup();
    resetRootTheme();
  });

  it('applies the selected preset tokens to root CSS variables', () => {
    const preset = getStudioThemePreset('stripe');

    applyStudioThemeToRoot(root, {
      presetId: 'stripe',
      colorMode: 'light',
      effectiveColorMode: 'light',
      density: 'comfortable',
      markdownSize: 'medium',
      codeBlockStyle: 'filled',
    });

    expect(root.style.getPropertyValue('--background')).toBe(preset.tokenMap.background);
    expect(root.style.getPropertyValue('--primary')).toBe(preset.tokenMap.primary);
    expect(root.style.getPropertyValue('--accent')).toBe(preset.tokenMap.accent);
  });

  it('reflects x-ai preset and token metadata through the provider', async () => {
    const preset = getStudioThemePreset('x-ai');
    useStudioAppearanceStore.setState({ presetId: 'x-ai' });

    render(
      <StudioAppearanceProvider>
        <div />
      </StudioAppearanceProvider>,
    );

    await waitFor(() => {
      expect(root.dataset.themePreset).toBe('x-ai');
    });
    expect(root.style.getPropertyValue('--background')).toBe(preset.tokenMap.background);
    expect(root.style.getPropertyValue('--foreground')).toBe(preset.tokenMap.foreground);
  });

  it('reflects density, Markdown size, and code block style as root data attributes', async () => {
    useStudioAppearanceStore.setState({
      density: 'compact',
      markdownSize: 'large',
      codeBlockStyle: 'outline',
    });

    render(
      <StudioAppearanceProvider>
        <div />
      </StudioAppearanceProvider>,
    );

    await waitFor(() => {
      expect(root.dataset.density).toBe('compact');
    });
    expect(root.dataset.markdownSize).toBe('large');
    expect(root.dataset.codeBlockStyle).toBe('outline');
  });
});
