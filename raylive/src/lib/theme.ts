import type { CSSProperties } from 'react';

/** The three authored colours; everything else is derived in CSS with `color-mix()`. */
export interface RoomTheme {
  background: string;
  text: string;
  accent: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  theme: RoomTheme;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    theme: { background: '#0a0a0b', text: '#ffffff', accent: '#3b82f6' },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    theme: { background: '#f8fafc', text: '#0f172a', accent: '#2563eb' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    theme: { background: '#082f49', text: '#e0f2fe', accent: '#38bdf8' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    theme: { background: '#1f1023', text: '#fde8ff', accent: '#fb7185' },
  },
  {
    id: 'forest',
    name: 'Forest',
    theme: { background: '#0b1f16', text: '#dcfce7', accent: '#34d399' },
  },
  {
    id: 'contrast',
    name: 'High contrast',
    theme: { background: '#000000', text: '#ffffff', accent: '#fde047' },
  },
];

export const CUSTOM_PRESET_ID = 'custom';
export const DEFAULT_PRESET_ID = 'midnight';

export const DEFAULT_THEME: RoomTheme = THEME_PRESETS[0].theme;

export function isHexColor(value: string | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export interface ThemedRoom {
  themePreset?: string;
  themeBackground?: string;
  themeText?: string;
  themeAccent?: string;
}

/**
 * Resolves a room's stored colours, falling back to its preset and then to the default.
 * Invalid or missing values never break rendering.
 */
export function resolveTheme(room?: ThemedRoom | null): RoomTheme {
  const preset =
    THEME_PRESETS.find((entry) => entry.id === room?.themePreset)?.theme ??
    DEFAULT_THEME;

  return {
    background: isHexColor(room?.themeBackground)
      ? room!.themeBackground!
      : preset.background,
    text: isHexColor(room?.themeText) ? room!.themeText! : preset.text,
    accent: isHexColor(room?.themeAccent) ? room!.themeAccent! : preset.accent,
  };
}

/**
 * CSS custom properties for a themed surface. Derived tokens (`--ia-surface`, `--ia-muted`,
 * `--ia-border`) are declared in `main.css` via `color-mix()`, so one triple produces a
 * coherent palette whether the theme is light or dark.
 */
export function themeVars(theme: RoomTheme): CSSProperties {
  return {
    '--ia-bg': theme.background,
    '--ia-text': theme.text,
    '--ia-accent': theme.accent,
  } as CSSProperties;
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** WCAG contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  if (!isHexColor(foreground) || !isHexColor(background)) return 1;

  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastRating = 'AAA' | 'AA' | 'Low';
export type LogoVariant = 'light' | 'dark';

const LIGHT_LOGO_RAY = '#0B2A5B';
const DARK_LOGO_RAY = '#F8FAFC';

/** Selects the logo whose Ray lettering has stronger contrast with the background. */
export function logoVariantForBackground(background: string): LogoVariant {
  if (!isHexColor(background)) return 'light';

  return contrastRatio(DARK_LOGO_RAY, background) >
    contrastRatio(LIGHT_LOGO_RAY, background)
    ? 'dark'
    : 'light';
}

/**
 * Rates text legibility. Large projected text only needs 3:1, but attendees read the same
 * colours on a phone, so this uses the normal-text thresholds.
 */
export function rateContrast(ratio: number): ContrastRating {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'Low';
}
