import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';

import { usePlaceIndex } from '@/hooks/usePlaces';
import {
  countryName,
  formatPlace,
  placesAttribution,
  type Place,
} from '@/lib/places';

export type PlaceComboboxVariant = 'audience' | 'console';

export interface PlaceComboboxProps {
  /** `audience` follows the room theme (`--ia-*`); `console` uses the neutral admin tokens. */
  variant: PlaceComboboxVariant;
  /** Visible label for the field. */
  label: string;
  /** Selected GeoNames id, or `null` when nothing is picked. */
  value: string | null;
  onChange: (placeId: string | null, place?: Place) => void;
  /** Helper text under the label, linked with `aria-describedby`. */
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Text of the button that clears the selection, e.g. "Change" or "Remove". */
  clearLabel?: string;
  /** Maximum suggestions shown. */
  limit?: number;
}

const SEARCH_DELAY_MS = 120;

const STYLES = {
  audience: {
    label: 'text-sm font-medium text-[var(--ia-text)]',
    muted: 'text-[var(--ia-muted)]',
    input:
      'rounded-xl border border-[var(--ia-border)] bg-[var(--ia-bg)] text-base text-[var(--ia-text)] placeholder-[var(--ia-muted)] focus:border-[var(--ia-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--ia-accent)]',
    panel: 'rounded-xl border border-[var(--ia-border)] bg-[var(--ia-surface)] text-[var(--ia-text)] shadow-lg',
    divider: 'border-[var(--ia-border)]',
    active: 'bg-[var(--ia-accent-soft)]',
    chip: 'rounded-xl border border-[var(--ia-accent)] bg-[var(--ia-accent-soft)] text-[var(--ia-text)]',
    button:
      'rounded-lg border border-[var(--ia-border)] bg-[var(--ia-bg)] text-[var(--ia-text)] hover:border-[var(--ia-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ia-accent)]',
    error: 'rounded-xl bg-red-50 text-red-700',
    errorButton: 'rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-100',
  },
  console: {
    label: 'text-sm font-medium text-admin-text',
    muted: 'text-admin-muted',
    input:
      'rounded-lg border border-admin-control-border bg-white text-sm text-admin-text placeholder-admin-subtle focus:border-admin-accent-strong focus:outline-none focus:ring-1 focus:ring-admin-accent-strong',
    panel: 'rounded-lg border border-admin-border bg-white text-admin-text shadow-lg',
    divider: 'border-admin-border',
    active: 'bg-admin-accent-soft',
    chip: 'rounded-lg border border-admin-accent-strong bg-admin-accent-soft text-admin-text',
    button:
      'rounded-lg border border-admin-control-border bg-white text-admin-text hover:border-admin-accent-strong',
    error: 'rounded-lg bg-admin-danger-soft text-admin-danger',
    errorButton:
      'rounded-lg border border-admin-control-border bg-white text-admin-danger hover:border-admin-danger',
  },
} satisfies Record<PlaceComboboxVariant, Record<string, string>>;

/** Regional-indicator flag for an ISO-2 code ("DE" → 🇩🇪); decorative only. */
function flagOf(countryCode: string): string {
  if (!/^[A-Z]{2}$/.test(countryCode)) return '';
  return String.fromCodePoint(
    ...[...countryCode].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65)
  );
}

/**
 * City picker following the WAI-ARIA combobox pattern (editable input with list autocomplete).
 * The bundled city list loads on first focus. Once a city is picked the field collapses into a
 * chip with a button to change or remove it.
 */
export function PlaceCombobox({
  variant,
  label,
  value,
  onChange,
  description,
  placeholder = 'Start typing a city…',
  disabled = false,
  clearLabel = 'Change',
  limit = 8,
}: PlaceComboboxProps) {
  const styles = STYLES[variant];
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const labelId = `${baseId}-label`;
  const listboxId = `${baseId}-listbox`;
  const descriptionId = `${baseId}-description`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusInputAfterClear = useRef(false);

  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const { index, status, retry } = usePlaceIndex(touched || !!value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(query);
      setActive(-1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const matches = useMemo(
    () => (index && searchQuery.trim() ? index.searchMatches(searchQuery, limit) : []),
    [index, searchQuery, limit]
  );

  const typed = query.trim().length > 0;
  const settled = typed && searchQuery === query && status === 'ready';
  // While the next search is pending the previous suggestions stay up, so typing never flickers.
  const expanded = focused && !dismissed && typed && status === 'ready' && matches.length > 0;
  const panelMessage = expanded
    ? null
    : status === 'loading'
      ? 'Loading cities…'
      : settled
        ? 'No matching city. Try the nearest larger city.'
        : null;
  const showPanel = focused && !dismissed && typed && (expanded || !!panelMessage);

  const selected = value ? index?.get(value) : undefined;

  useEffect(() => {
    if (!value && focusInputAfterClear.current) {
      focusInputAfterClear.current = false;
      inputRef.current?.focus();
    }
  }, [value]);

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // optionId only depends on the stable baseId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const liveMessage =
    status === 'loading' && typed
      ? 'Loading cities…'
      : status === 'error'
        ? 'Could not load the city list.'
        : settled && focused
          ? matches.length === 0
            ? 'No matching city.'
            : `${matches.length} ${matches.length === 1 ? 'city' : 'cities'} found. Use the arrow keys to choose.`
          : announcement;

  const select = (place: Place) => {
    onChange(place.id, place);
    setQuery('');
    setSearchQuery('');
    setActive(-1);
    setAnnouncement(`${formatPlace(place)} selected.`);
  };

  const clear = () => {
    focusInputAfterClear.current = true;
    setAnnouncement('');
    onChange(null);
  };

  const move = (next: number) => {
    setDismissed(false);
    if (matches.length === 0) return;
    setActive((next + matches.length) % matches.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(expanded ? active + 1 : 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(expanded ? (active < 0 ? matches.length - 1 : active - 1) : matches.length - 1);
        break;
      case 'Home':
        if (!expanded) return;
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        if (!expanded) return;
        event.preventDefault();
        setActive(matches.length - 1);
        break;
      case 'Enter':
        if (!showPanel) return;
        // Never submit the surrounding form while suggestions are showing.
        event.preventDefault();
        if (expanded && active >= 0) select(matches[active].place);
        break;
      case 'Escape':
        if (showPanel) {
          event.preventDefault();
          setDismissed(true);
          setActive(-1);
        } else if (query) {
          event.preventDefault();
          setQuery('');
        }
        break;
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
      setFocused(false);
      setActive(-1);
    }
  };

  const describedBy = description ? descriptionId : undefined;

  return (
    <div ref={rootRef} className="min-w-0" onBlur={handleBlur}>
      {value ? (
        <span id={labelId} className={`block ${styles.label}`}>
          {label}
        </span>
      ) : (
        <label id={labelId} htmlFor={inputId} className={`block ${styles.label}`}>
          {label}
        </label>
      )}
      {description && (
        <p id={descriptionId} className={`mt-1 text-xs ${styles.muted}`}>
          {description}
        </p>
      )}

      <div className="mt-2">
        {value ? (
          <div
            role="group"
            aria-labelledby={labelId}
            className={`flex min-h-11 min-w-0 items-center gap-3 py-1.5 pl-3 pr-1.5 ${styles.chip}`}
          >
            {selected && (
              <span aria-hidden="true" className="text-xl leading-none">
                {flagOf(selected.countryCode)}
              </span>
            )}
            <span className="min-w-0 flex-1 break-words text-sm font-medium">
              {selected
                ? formatPlace(selected)
                : status === 'error'
                  ? 'This city could not be loaded.'
                  : status === 'ready'
                    ? 'Unknown city'
                    : 'Loading city…'}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={clear}
              aria-label={selected ? `${clearLabel} city: ${formatPlace(selected)}` : `${clearLabel} city`}
              className={`min-h-11 shrink-0 px-3 text-sm font-medium transition-colors disabled:opacity-40 ${styles.button}`}
            >
              {clearLabel}
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={listboxId}
            aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
            aria-describedby={describedBy}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={100}
            disabled={disabled}
            value={query}
            placeholder={placeholder}
            onFocus={() => {
              setTouched(true);
              setFocused(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setDismissed(false);
              setAnnouncement('');
            }}
            onKeyDown={handleKeyDown}
            className={`block min-h-11 w-full min-w-0 px-4 py-2 disabled:opacity-50 ${styles.input}`}
          />
        )}

        {!value && status === 'error' && (
          <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm ${styles.error}`}>
            <span>The city list could not be loaded.</span>
            <button
              type="button"
              onClick={() => {
                retry();
                inputRef.current?.focus();
              }}
              className={`min-h-11 px-3 font-medium ${styles.errorButton}`}
            >
              Try again
            </button>
          </div>
        )}

        <div
          hidden={!showPanel}
          // Keeps focus in the input while choosing with a mouse or finger.
          onMouseDown={(event) => event.preventDefault()}
          className={`mt-2 overflow-hidden ${styles.panel}`}
        >
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            hidden={!expanded}
            className="max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain py-1"
          >
            {matches.map(({ place, alias }, i) => {
              const region = place.region && place.region !== place.name ? place.region : null;
              return (
                <li
                  key={place.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => select(place)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 ${
                    i === active ? styles.active : ''
                  }`}
                >
                  <span aria-hidden="true" className="w-6 shrink-0 text-center text-lg leading-none">
                    {flagOf(place.countryCode)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium">
                      {place.name}
                      {alias && <span className={`font-normal ${styles.muted}`}> ({alias})</span>}
                    </span>
                    {' '}
                    <span className={`block break-words text-xs ${styles.muted}`}>
                      {[region, countryName(place.countryCode)].filter(Boolean).join(', ')}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {panelMessage && <p className={`px-4 py-3 text-sm ${styles.muted}`}>{panelMessage}</p>}

          <p className={`border-t px-4 py-1.5 text-[11px] leading-snug ${styles.divider} ${styles.muted}`}>
            {placesAttribution}
          </p>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>
    </div>
  );
}
