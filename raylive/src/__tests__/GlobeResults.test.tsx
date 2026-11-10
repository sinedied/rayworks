import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Activity } from '../../rayfin/data/Activity';
import type { Answer } from '../../rayfin/data/Answer';
import { ActivityResults } from '@/components/ActivityResults';
import { GlobeResults } from '@/components/GlobeResults';
import type { GlobeTally } from '@/lib/globe';
import { loadPlaces, type Place } from '@/lib/places';

const loadMapLibre = vi.fn();
vi.mock('@/lib/maplibre', () => ({ loadMapLibre: () => loadMapLibre() }));
vi.mock('@/lib/places', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/places')>()),
  loadWorld: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
}));

const place = (id: string, name: string, countryCode: string, lat: number, lon: number): Place => ({
  id,
  name,
  countryCode,
  lat,
  lon,
  population: 1000,
});
const hamburg = place('1', 'Hamburg', 'DE', 53.55, 10);
const berlin = place('2', 'Berlin', 'DE', 52.52, 13.4);
const auckland = place('3', 'Auckland', 'NZ', -36.85, 174.76);

const emptyTally = (venue: Place | null = null): GlobeTally => ({
  participants: 0,
  unresolved: 0,
  cities: [],
  countries: [],
  continents: [],
  venue,
  farthest: null,
  totalDistanceKm: venue ? 0 : null,
  medianDistanceKm: null,
});

const tally: GlobeTally = {
  participants: 12,
  unresolved: 0,
  cities: [
    { place: hamburg, count: 7, distanceKm: 0 },
    { place: berlin, count: 4, distanceKm: 255 },
    { place: auckland, count: 1, distanceKm: 18_100 },
  ],
  countries: [
    { countryCode: 'DE', count: 11 },
    { countryCode: 'NZ', count: 1 },
  ],
  continents: [
    { continent: 'Europe', count: 11 },
    { continent: 'Oceania', count: 1 },
  ],
  venue: hamburg,
  farthest: { place: auckland, count: 1, distanceKm: 18_100 },
  totalDistanceKm: 19_120,
  medianDistanceKm: 0,
};

/** Just enough of MapLibre for the controller, recording what it is asked to draw. */
function fakeMapLibre() {
  const sources: Record<string, { setData: ReturnType<typeof vi.fn> }> = {
    cities: { setData: vi.fn() },
    arcs: { setData: vi.fn() },
  };
  const maps: FakeMap[] = [];

  class FakeMap {
    handlers: Record<string, ((event?: unknown) => void)[]> = {};
    canvas = document.createElement('canvas');
    remove = vi.fn();
    setPaintProperty = vi.fn();
    setFeatureState = vi.fn();
    touchZoomRotate = { disableRotation: vi.fn() };
    constructor(public options: { container: HTMLElement; style: unknown }) {
      options.container.appendChild(this.canvas);
      maps.push(this);
    }
    on(type: string, handler: (event?: unknown) => void) {
      (this.handlers[type] ??= []).push(handler);
      return this;
    }
    once(type: string, handler: () => void) {
      if (type === 'load') setTimeout(handler, 0);
      return this;
    }
    getCanvas() {
      return this.canvas;
    }
    getSource(id: string) {
      return sources[id];
    }
    getZoom() {
      return 1;
    }
    getCenter() {
      return { lng: 10, lat: 30 };
    }
    project() {
      return { x: 0, y: 0 };
    }
    isMoving() {
      return false;
    }
    setPadding() {}
    jumpTo() {}
    easeTo() {}
    setSky() {}
  }

  class FakeMarker {
    element: HTMLElement;
    lngLat = { lng: 0, lat: 0 };
    constructor({ element }: { element: HTMLElement }) {
      this.element = element;
    }
    setLngLat([lng, lat]: [number, number]) {
      this.lngLat = { lng, lat };
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
    getElement() {
      return this.element;
    }
    getLngLat() {
      return this.lngLat;
    }
  }

  return { module: { Map: FakeMap, Marker: FakeMarker }, sources, maps };
}

beforeEach(() => {
  loadMapLibre.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('GlobeResults', () => {
  it('shows the stats panel with participants, countries, cities and travel', async () => {
    loadMapLibre.mockReturnValue(new Promise(() => {}));
    render(<GlobeResults tally={tally} variant="stage" />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('2 countries')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Continents' })).toHaveTextContent('Europe 11');
    expect(screen.getByRole('heading', { name: 'Top cities' })).toBeInTheDocument();
    expect(screen.getByText(/Farthest:/).parentElement).toHaveTextContent(
      'Farthest: Auckland, New Zealand · 18,100 km'
    );
    expect(screen.getByText(/Together you traveled/)).toHaveTextContent('19,100 km');
    expect(screen.getByText(/MapLibre · City data © GeoNames/)).toBeInTheDocument();
  });

  it('offers a text alternative for the map', () => {
    loadMapLibre.mockReturnValue(new Promise(() => {}));
    render(<GlobeResults tally={tally} />);

    const table = screen.getByRole('table', { name: 'Where participants are joining from' });
    expect(table).toHaveTextContent('Auckland, New Zealand');
    expect(table).toHaveTextContent('18,100 km');
  });

  it('shows the empty state with the join prompt', () => {
    loadMapLibre.mockReturnValue(new Promise(() => {}));
    render(<GlobeResults tally={emptyTally(hamburg)} emptyHint="Scan the code to join." />);

    expect(screen.getByText('Waiting for the first city…')).toBeInTheDocument();
    expect(screen.getByText('Scan the code to join.')).toBeInTheDocument();
    expect(screen.getByText(/Arcs will fly to/)).toHaveTextContent('Arcs will fly to Hamburg.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('falls back to the list when the map cannot load', async () => {
    loadMapLibre.mockRejectedValue(new Error('WebGL is not available'));
    render(<GlobeResults tally={tally} />);

    expect(await screen.findByText(/can't draw the globe/)).toBeInTheDocument();
    expect(screen.getByText('Auckland')).toBeInTheDocument();
    expect(screen.queryByText(/^MapLibre/)).not.toBeInTheDocument();
  });

  it('falls back when the map constructor throws', async () => {
    const fake = fakeMapLibre();
    loadMapLibre.mockResolvedValue({
      ...fake.module,
      Map: class {
        constructor() {
          throw new Error('Failed to initialize WebGL');
        }
      },
    });
    render(<GlobeResults tally={tally} />);

    expect(await screen.findByText(/can't draw the globe/)).toBeInTheDocument();
  });

  it('feeds data into one map, updates it in place and cleans up on unmount', async () => {
    const fake = fakeMapLibre();
    loadMapLibre.mockResolvedValue(fake.module);
    const { rerender, unmount } = render(<GlobeResults tally={tally} variant="stage" />);

    await waitFor(() => expect(fake.sources.cities.setData).toHaveBeenCalled());
    const [map] = fake.maps;
    expect(map.canvas).toHaveAttribute('aria-hidden', 'true');
    expect(fake.sources.cities.setData.mock.lastCall?.[0].features).toHaveLength(3);
    expect(fake.sources.arcs.setData.mock.lastCall?.[0].features).toHaveLength(2);

    const more: GlobeTally = {
      ...tally,
      participants: 13,
      cities: [...tally.cities, { place: place('4', 'Oslo', 'NO', 59.9, 10.75), count: 1, distanceKm: 890 }],
    };
    await act(async () => rerender(<GlobeResults tally={more} variant="stage" />));
    expect(fake.maps).toHaveLength(1);
    expect(fake.sources.cities.setData.mock.lastCall?.[0].features).toHaveLength(4);
    expect(map.setFeatureState).toHaveBeenCalledWith({ source: 'cities', id: '4' }, { pop: 0 });

    unmount();
    expect(map.remove).toHaveBeenCalled();
  });

  it('draws no arcs without a venue', async () => {
    const fake = fakeMapLibre();
    loadMapLibre.mockResolvedValue(fake.module);
    render(<GlobeResults tally={{ ...tally, venue: null, farthest: null, totalDistanceKm: null }} />);

    await waitFor(() => expect(fake.sources.arcs.setData).toHaveBeenCalled());
    expect(fake.sources.arcs.setData.mock.lastCall?.[0].features).toHaveLength(0);
    expect(screen.queryByText(/Together you traveled/)).not.toBeInTheDocument();
  });
});

describe('ActivityResults for a globe activity', () => {
  it('loads the city index, then tallies answers against the venue', async () => {
    loadMapLibre.mockReturnValue(new Promise(() => {}));
    const places = await loadPlaces();
    const [venue] = places.search('Hamburg', 1);
    const [tokyo] = places.search('Tokyo', 1);
    const activity = { id: 'a1', kind: 'globe', venuePlaceId: venue.id } as unknown as Activity;
    const answers = [
      { id: 'x', participantKey: 'p1', placeId: tokyo.id, isHidden: false, createdAt: new Date(1) },
      { id: 'y', participantKey: 'p2', placeId: tokyo.id, isHidden: false, createdAt: new Date(2) },
    ] as unknown as Answer[];

    render(<ActivityResults activity={activity} options={[]} answers={answers} stage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the globe…');

    expect(await screen.findByText(/people joining from/)).toHaveTextContent('people joining from 1 country');
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText(/Farthest:/).parentElement).toHaveTextContent(/Tokyo, Japan · 8,\d{3} km/);
  });
});
