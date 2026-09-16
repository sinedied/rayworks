import { describe, expect, it } from 'vitest';

import {
  DEFAULT_THEME,
  THEME_PRESETS,
  contrastRatio,
  isHexColor,
  rateContrast,
  resolveTheme,
  themeVars,
} from '@/lib/theme';

describe('isHexColor', () => {
  it('accepts 6-digit hex only', () => {
    expect(isHexColor('#0a0a0b')).toBe(true);
    expect(isHexColor('#FFFFFF')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('blue')).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('falls back to the default when nothing is stored', () => {
    expect(resolveTheme(undefined)).toEqual(DEFAULT_THEME);
    expect(resolveTheme(null)).toEqual(DEFAULT_THEME);
  });

  it('uses stored colours when they are valid', () => {
    const theme = resolveTheme({
      themeBackground: '#111111',
      themeText: '#eeeeee',
      themeAccent: '#ff0000',
    });

    expect(theme).toEqual({
      background: '#111111',
      text: '#eeeeee',
      accent: '#ff0000',
    });
  });

  it('falls back to the named preset for missing or invalid values', () => {
    const ocean = THEME_PRESETS.find((preset) => preset.id === 'ocean')!;
    const theme = resolveTheme({
      themePreset: 'ocean',
      themeBackground: 'not-a-colour',
    });

    expect(theme).toEqual(ocean.theme);
  });
});

describe('themeVars', () => {
  it('exposes the three authored colours as custom properties', () => {
    const vars = themeVars({
      background: '#000000',
      text: '#ffffff',
      accent: '#ff0000',
    }) as Record<string, string>;

    expect(vars['--ia-bg']).toBe('#000000');
    expect(vars['--ia-text']).toBe('#ffffff');
    expect(vars['--ia-accent']).toBe('#ff0000');
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('returns 1 for identical colours', () => {
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('is order-independent', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(
      contrastRatio('#000000', '#ffffff'),
      5
    );
  });

  it('degrades safely on invalid input', () => {
    expect(contrastRatio('nope', '#ffffff')).toBe(1);
  });
});

describe('rateContrast', () => {
  it('maps ratios to WCAG bands', () => {
    expect(rateContrast(21)).toBe('AAA');
    expect(rateContrast(7)).toBe('AAA');
    expect(rateContrast(4.5)).toBe('AA');
    expect(rateContrast(3)).toBe('Low');
  });
});

describe('presets', () => {
  it('ships only readable presets', () => {
    for (const preset of THEME_PRESETS) {
      const ratio = contrastRatio(preset.theme.text, preset.theme.background);
      expect(
        ratio,
        `${preset.name} text contrast is ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('uses valid hex everywhere', () => {
    for (const preset of THEME_PRESETS) {
      expect(isHexColor(preset.theme.background)).toBe(true);
      expect(isHexColor(preset.theme.text)).toBe(true);
      expect(isHexColor(preset.theme.accent)).toBe(true);
    }
  });
});
