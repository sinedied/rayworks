import { useState } from 'react';

import type { Room } from '../../rayfin/data/Room';

import {
  CUSTOM_PRESET_ID,
  THEME_PRESETS,
  contrastRatio,
  isHexColor,
  rateContrast,
  resolveTheme,
  themeVars,
  type RoomTheme,
} from '@/lib/theme';

export interface ThemePickerProps {
  room: Room;
  onSave: (
    theme: RoomTheme & { preset: string; brandTitle: string }
  ) => Promise<void> | void;
  busy?: boolean;
}

/** Preset and custom colour picker with a live preview and a legibility warning. */
export function ThemePicker({ room, onSave, busy = false }: ThemePickerProps) {
  const [theme, setTheme] = useState<RoomTheme>(() => resolveTheme(room));
  const [preset, setPreset] = useState(room.themePreset ?? CUSTOM_PRESET_ID);
  const [brandTitle, setBrandTitle] = useState(room.brandTitle ?? '');

  const ratio = contrastRatio(theme.text, theme.background);
  const rating = rateContrast(ratio);
  const accentRatio = contrastRatio(theme.accent, theme.background);
  // Hex is typed freely, so saving waits until all three values are valid.
  const valid =
    isHexColor(theme.background) &&
    isHexColor(theme.text) &&
    isHexColor(theme.accent);
  const dirty =
    brandTitle.trim() !== (room.brandTitle ?? '') ||
    preset !== room.themePreset ||
    theme.background !== room.themeBackground ||
    theme.text !== room.themeText ||
    theme.accent !== room.themeAccent;

  const choosePreset = (id: string) => {
    const found = THEME_PRESETS.find((entry) => entry.id === id);
    if (!found) return;
    setPreset(id);
    setTheme(found.theme);
  };

  const setColor = (key: keyof RoomTheme, value: string) => {
    setPreset(CUSTOM_PRESET_ID);
    setTheme((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Branding &amp; theme
        </h2>
        <button
          onClick={() =>
            void onSave({ ...theme, preset, brandTitle: brandTitle.trim() })
          }
          disabled={!dirty || !valid || busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {dirty ? 'Save theme' : 'Saved'}
        </button>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-gray-500">
          Title shown to the audience
        </span>
        <input
          value={brandTitle}
          onChange={(event) => setBrandTitle(event.target.value)}
          maxLength={60}
          placeholder="interask"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        {THEME_PRESETS.map((entry) => (
          <button
            key={entry.id}
            onClick={() => choosePreset(entry.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              preset === entry.id
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            <span
              className="h-4 w-4 rounded-full border border-black/10"
              style={{
                background: `linear-gradient(135deg, ${entry.theme.background} 50%, ${entry.theme.accent} 50%)`,
              }}
            />
            {entry.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ColorField
          label="Background"
          value={theme.background}
          onChange={(value) => setColor('background', value)}
        />
        <ColorField
          label="Text"
          value={theme.text}
          onChange={(value) => setColor('text', value)}
        />
        <ColorField
          label="Accent"
          value={theme.accent}
          onChange={(value) => setColor('accent', value)}
        />
      </div>

      {!valid && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Colours must be 6-digit hex values like <code>#1d4ed8</code>.
        </p>
      )}

      {valid && rating === 'Low' && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Text contrast is {ratio.toFixed(1)}:1 — hard to read on a projector.
          Aim for at least 4.5:1.
        </p>
      )}
      {valid && rating !== 'Low' && (
        <p className="mt-3 text-xs text-gray-400">
          Text contrast {ratio.toFixed(1)}:1 ({rating}) · accent{' '}
          {accentRatio.toFixed(1)}:1
        </p>
      )}

      <div
        data-ia-theme
        style={themeVars(theme)}
        className="mt-4 rounded-xl border border-[var(--ia-border)] p-4"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ia-accent)]">
          {brandTitle.trim() || 'interask'}
        </p>
        <p className="mt-2 text-lg font-bold text-[var(--ia-text)]">
          {room.title}
        </p>
        <div className="mt-3 overflow-hidden rounded-lg bg-[var(--ia-surface)] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--ia-text)]">
              Sample answer
            </span>
            <span className="text-sm font-semibold text-[var(--ia-accent)]">
              62%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-10 cursor-pointer rounded border border-gray-200 bg-white"
          aria-label={`${label} colour`}
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={7}
          className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 font-mono text-xs uppercase focus:border-blue-500 focus:outline-none"
        />
      </span>
    </label>
  );
}
