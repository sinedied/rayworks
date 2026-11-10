import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

import { GlobeController, type GlobeVariant } from './globeController';
import type { GlobeCity, GlobeTally } from '@/lib/globe';
import { flagEmoji, formatKm } from '@/lib/globeStyle';
import { loadMapLibre } from '@/lib/maplibre';
import { countryName, loadWorld, placesAttribution } from '@/lib/places';

export type { GlobeVariant };

export interface GlobeResultsProps {
  tally: GlobeTally;
  /** `stage` is the projected view: full-bleed, large type, slow auto-rotation. */
  variant?: GlobeVariant;
  /** Call to action under the empty state, e.g. how to join. */
  emptyHint?: string;
}

type MapState = 'loading' | 'ready' | 'failed';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const number = (value: number) => new Intl.NumberFormat('en').format(value);

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * "Where are you joining from?" results: a themed MapLibre globe with city bubbles and arcs to
 * the venue, beside a stats panel. Degrades to the panel alone when WebGL is unavailable.
 */
export function GlobeResults({ tally, variant = 'card', emptyHint }: GlobeResultsProps) {
  const stage = variant === 'stage';
  const [mapState, setMapState] = useState<MapState>('loading');
  const panelRef = useRef<HTMLDivElement>(null);
  const failed = mapState === 'failed';

  return (
    <div className="@container relative isolate w-full min-w-0" data-globe={variant}>
      <div
        className={
          failed
            ? 'relative'
            : `relative flex flex-col @2xl:grid @2xl:grid-cols-[var(--globe-panel)_minmax(0,1fr)] ${
                stage
                  ? '@2xl:min-h-[clamp(20rem,min(calc(100dvh-25rem),62cqi),60rem)]'
                  : '@2xl:min-h-[26rem]'
              }`
        }
        style={{ '--globe-panel': stage ? 'clamp(18rem,36cqi,30rem)' : 'clamp(16rem,40cqi,22rem)' } as CSSProperties}
      >
        {!failed && (
          <GlobeCanvas
            tally={tally}
            variant={variant}
            state={mapState}
            onStateChange={setMapState}
            panelRef={panelRef}
          />
        )}
        {!failed && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-[calc(var(--globe-panel)+14cqi)] bg-[linear-gradient(90deg,var(--ia-bg)_0%,var(--ia-bg)_55%,color-mix(in_srgb,var(--ia-bg)_65%,transparent)_75%,transparent_100%)] @2xl:block"
          />
        )}
        <StatsPanel
          ref={panelRef}
          tally={tally}
          stage={stage}
          failed={failed}
          emptyHint={emptyHint}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <TravelFacts tally={tally} stage={stage} />
        <p className={`ml-auto text-right text-[var(--ia-muted)] ${stage ? 'text-[11px]' : 'text-[10px]'}`}>
          {failed ? placesAttribution : `MapLibre · ${placesAttribution}`}
        </p>
      </div>

      <GlobeTextAlternative tally={tally} />
      <ParticipantAnnouncer tally={tally} />
    </div>
  );
}

function GlobeCanvas({
  tally,
  variant,
  state,
  onStateChange,
  panelRef,
}: {
  tally: GlobeTally;
  variant: GlobeVariant;
  state: MapState;
  onStateChange: (state: MapState) => void;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GlobeController | null>(null);
  const tallyRef = useRef(tally);

  useEffect(() => {
    tallyRef.current = tally;
    controllerRef.current?.update(tally);
  }, [tally]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let controller: GlobeController | null = null;
    let observer: ResizeObserver | null = null;

    // In the wide layout the panel sits over the globe's left side; narrow layouts stack it below.
    const getInset = () => {
      const panel = panelRef.current?.getBoundingClientRect();
      const box = container.getBoundingClientRect();
      if (!panel || panel.top >= box.bottom - 1 || panel.right >= box.right - 40) return 0;
      return panel.right - box.left;
    };

    Promise.all([loadMapLibre(), loadWorld()])
      .then(([maplibre, world]) => {
        if (cancelled) return;
        controller = new GlobeController(maplibre, container, world, {
          variant,
          reducedMotion: prefersReducedMotion(),
          getInset,
        });
        controllerRef.current = controller;
        controller.update(tallyRef.current);
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(() => controller?.layout());
          observer.observe(container);
        }
        return controller.ready;
      })
      .then(() => {
        if (!cancelled) onStateChange('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn('Globe unavailable, showing the list instead.', error);
        onStateChange('failed');
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      controller?.destroy();
      controllerRef.current = null;
    };
  }, [variant, onStateChange, panelRef]);

  return (
    <div
      aria-hidden="true"
      className={`relative w-full overflow-hidden @2xl:absolute @2xl:inset-0 @2xl:h-auto ${
        variant === 'stage'
          ? 'h-[min(96cqi,30rem)] @2xl:[mask-image:linear-gradient(to_bottom,transparent,black_7%,black_93%,transparent)]'
          : 'h-[min(96cqi,22rem)]'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 @2xl:left-[var(--globe-panel)] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--ia-accent)_16%,transparent),transparent)]" />
      {state !== 'ready' && <GlobePlaceholder />}
      <div
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-700 ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}

/** A soft themed sphere while MapLibre and the country shapes load. */
function GlobePlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center @2xl:left-[var(--globe-panel)]">
      <div className="aspect-square h-[78%] max-w-[86%] rounded-full bg-[radial-gradient(circle_at_35%_30%,color-mix(in_srgb,var(--ia-accent)_22%,var(--ia-bg)),color-mix(in_srgb,var(--ia-text)_6%,var(--ia-bg))_70%)] shadow-[0_0_80px_-10px_color-mix(in_srgb,var(--ia-accent)_45%,transparent)] motion-safe:animate-pulse" />
    </div>
  );
}

function StatsPanel({
  ref,
  tally,
  stage,
  failed,
  emptyHint,
}: {
  ref: RefObject<HTMLDivElement | null>;
  tally: GlobeTally;
  stage: boolean;
  failed: boolean;
  emptyHint?: string;
}) {
  const empty = tally.participants === 0;
  const topCount = failed ? 12 : 5;
  const overlay = failed ? '' : `@2xl:col-start-1 @2xl:row-start-1 @2xl:self-center ${stage ? '@2xl:py-0' : '@2xl:py-6'}`;

  const t = stage
    ? {
        hero: 'text-[clamp(3rem,min(10cqi,12dvh),8rem)]',
        lead: 'text-[clamp(1.05rem,min(2.2cqi,3.4dvh),1.75rem)]',
        body: 'text-[clamp(0.95rem,min(1.7cqi,2.8dvh),1.4rem)]',
        small: 'text-[clamp(0.8rem,min(1.3cqi,2.1dvh),1.05rem)]',
      }
    : {
        hero: 'text-[clamp(2.75rem,12cqi,4.5rem)]',
        lead: 'text-base',
        body: 'text-sm',
        small: 'text-xs',
      };

  return (
    <div
      ref={ref}
      data-globe-panel
      className={`relative z-10 flex min-w-0 flex-col ${failed ? 'max-w-2xl' : ''} ${stage ? 'gap-[clamp(0.875rem,min(2.2cqi,3dvh),1.75rem)]' : 'gap-4'} pt-4 ${overlay}`}
    >
      {empty ? (
        <div>
          <p className={`font-bold leading-tight text-[var(--ia-text)] ${stage ? 'text-[clamp(1.75rem,4.5cqi,3.25rem)]' : 'text-2xl'}`}>
            Waiting for the first city…
          </p>
          <p className={`mt-2 text-[var(--ia-muted)] ${t.lead}`}>
            {emptyHint ?? 'Every answer lights up a city on the globe.'}
          </p>
          {tally.venue && (
            <p className={`mt-3 text-[var(--ia-muted)] ${t.small}`}>
              Arcs will fly to <span className="font-semibold text-[var(--ia-text)]">{tally.venue.name}</span>.
            </p>
          )}
        </div>
      ) : (
        <>
          <div>
            <p
              className={`font-extrabold leading-[0.88] tracking-[-0.04em] tabular-nums text-[var(--ia-accent)] ${t.hero}`}
            >
              {number(tally.participants)}
            </p>
            <p className={`mt-2 text-balance text-[var(--ia-text)] ${t.lead}`}>
              {tally.participants === 1 ? 'person' : 'people'} joining from{' '}
              <span className="font-bold">{plural(tally.countries.length, 'country', 'countries')}</span>
            </p>
            {tally.continents.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Continents">
                {tally.continents.map(({ continent, count }) => (
                  <li
                    key={continent}
                    className={`rounded-full border border-[var(--ia-border)] bg-[color-mix(in_srgb,var(--ia-surface)_80%,transparent)] px-2.5 py-0.5 text-[var(--ia-text)] ${stage ? 'text-[clamp(0.75rem,min(1.15cqi,1.9dvh),0.95rem)]' : 'text-xs'}`}
                  >
                    {continent} <span className="tabular-nums text-[var(--ia-muted)]">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <TopCities cities={tally.cities.slice(0, topCount)} stage={stage} compact={!failed} textClass={t.body} />

        </>
      )}
      {failed && (
        <p className={`text-[var(--ia-muted)] ${t.small}`}>
          This device can't draw the globe, so here is the list instead.
        </p>
      )}
    </div>
  );
}

/** The journey to the venue, as one line under the globe. */
function TravelFacts({ tally, stage }: { tally: GlobeTally; stage: boolean }) {
  const farthest = tally.farthest;
  const total = tally.totalDistanceKm ?? 0;
  if (!tally.venue || !farthest || total <= 0) return null;
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[var(--ia-text)] ${
        stage ? 'text-[clamp(0.95rem,min(1.7cqi,2.8dvh),1.4rem)]' : 'text-sm'
      }`}
    >
      <p>
        Together you traveled{' '}
        <span className="whitespace-nowrap font-bold tabular-nums text-[var(--ia-accent)]">{formatKm(total)}</span>
        {tally.medianDistanceKm !== null && (
          <span className="whitespace-nowrap text-[var(--ia-muted)]"> · median {formatKm(tally.medianDistanceKm)}</span>
        )}
      </p>
      {(farthest.distanceKm ?? 0) > 0 && (
        <p>
          <span className="text-[var(--ia-muted)]">Farthest:</span> {farthest.place.name},{' '}
          {countryName(farthest.place.countryCode)} ·{' '}
          <span className="whitespace-nowrap font-semibold tabular-nums">{formatKm(farthest.distanceKm ?? 0)}</span>
        </p>
      )}
    </div>
  );
}

function TopCities({
  cities,
  stage,
  compact,
  textClass,
}: {
  cities: GlobeCity[];
  stage: boolean;
  /** Keeps three rows on short projected screens, where the globe needs the height. */
  compact: boolean;
  textClass: string;
}) {
  if (cities.length === 0) return null;
  const max = cities[0].count;
  return (
    <div>
      <h3 className={`mb-1.5 font-semibold text-[var(--ia-muted)] ${stage ? 'text-[clamp(0.875rem,1.5cqi,1.125rem)]' : 'text-xs'}`}>
        Top cities
      </h3>
      <ol
        className={
          stage
            ? `space-y-[clamp(0.125rem,0.6dvh,0.375rem)] ${compact ? '[@media(max-height:800px)]:[&>li:nth-child(n+4)]:hidden' : ''}`
            : 'space-y-0.5'
        }
      >
        {cities.map((city) => (
          <li key={city.place.id} className={`relative flex items-center gap-2.5 ${textClass}`}>
            <span aria-hidden="true" className="w-[1.4em] shrink-0 text-center">
              {flagEmoji(city.place.countryCode)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[var(--ia-text)]">
              {city.place.name}
              <span className="sr-only">, {countryName(city.place.countryCode)}</span>
            </span>
            <span
              aria-hidden="true"
              className="hidden h-1.5 w-[clamp(2rem,8cqi,5rem)] overflow-hidden rounded-full bg-[var(--ia-border)] @sm:block"
            >
              <span
                className="block h-full rounded-full bg-[var(--ia-accent)] transition-[width] duration-700"
                style={{ width: `${Math.max(6, (city.count / max) * 100)}%` }}
              />
            </span>
            <span className="w-[2.5ch] shrink-0 text-right font-semibold tabular-nums text-[var(--ia-text)]">
              {city.count}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Screen-reader equivalent of the map: every city with its count. */
function GlobeTextAlternative({ tally }: { tally: GlobeTally }) {
  if (tally.cities.length === 0) return null;
  // Tables ignore `height`, so the visually-hidden clip goes on a wrapper.
  return (
    <div className="sr-only">
    <table>
      <caption>Where participants are joining from</caption>
      <thead>
        <tr>
          <th scope="col">City</th>
          <th scope="col">Participants</th>
          {tally.venue && <th scope="col">Distance to {tally.venue.name}</th>}
        </tr>
      </thead>
      <tbody>
        {tally.cities.slice(0, 200).map((city) => (
          <tr key={city.place.id}>
            <th scope="row">
              {city.place.name}, {countryName(city.place.countryCode)}
            </th>
            <td>{city.count}</td>
            {tally.venue && <td>{formatKm(city.distanceKm ?? 0)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

const ANNOUNCE_EVERY_MS = 10_000;

/** Politely announces participant counts as they grow, at most every ten seconds. */
function ParticipantAnnouncer({ tally }: { tally: GlobeTally }) {
  const message =
    tally.participants === 0
      ? ''
      : `${plural(tally.participants, 'participant', 'participants')} from ${plural(
          tally.countries.length,
          'country',
          'countries'
        )}`;
  const [announced, setAnnounced] = useState('');
  const initial = useRef(message);
  const lastAt = useRef(0);

  useEffect(() => {
    if (message === initial.current || message === '') return;
    const wait = Math.max(0, lastAt.current + ANNOUNCE_EVERY_MS - Date.now());
    const timer = window.setTimeout(() => {
      lastAt.current = Date.now();
      setAnnounced(message);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <p aria-live="polite" role="status" className="sr-only">
      {announced}
    </p>
  );
}
