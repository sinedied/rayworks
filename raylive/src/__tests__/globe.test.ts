import { describe, expect, it } from 'vitest';

import type { AnswerLike } from '@/lib/aggregate';
import { tallyGlobe, type PlaceLookup } from '@/lib/globe';
import { distanceKm, loadPlaces, type Place } from '@/lib/places';

const place = (
  id: string,
  name: string,
  countryCode: string,
  lat: number,
  lon: number,
  population: number
): Place => ({ id, name, countryCode, lat, lon, population });

const paris = place('1', 'Paris', 'FR', 48.8566, 2.3522, 2_100_000);
const lyon = place('2', 'Lyon', 'FR', 45.764, 4.8357, 500_000);
const berlin = place('3', 'Berlin', 'DE', 52.52, 13.405, 3_600_000);
const tokyo = place('4', 'Tokyo', 'JP', 35.6762, 139.6503, 8_300_000);
const nyc = place('5', 'New York', 'US', 40.7128, -74.006, 8_000_000);
const aachen = place('6', 'Aachen', 'DE', 50.7753, 6.0839, 250_000);
const bonn = place('7', 'Bonn', 'DE', 50.7374, 7.0982, 250_000);

const fakeIndex = (...places: Place[]): PlaceLookup => {
  const byId = new Map(places.map((p) => [p.id, p]));
  return { get: (id) => byId.get(id) };
};
const index = fakeIndex(paris, lyon, berlin, tokyo, nyc, aachen, bonn);

let clock = 0;
const answer = (participantKey: string, placeId: string, extra: Partial<AnswerLike> = {}): AnswerLike => ({
  participantKey,
  placeId,
  submissionId: `${participantKey}-${++clock}`,
  createdAt: new Date(1_000 + clock),
  ...extra,
});

const names = (cities: { place: Place }[]) => cities.map((city) => city.place.name);

describe('tallyGlobe', () => {
  it('returns an empty tally for no answers', () => {
    expect(tallyGlobe([], index)).toEqual({
      participants: 0,
      unresolved: 0,
      cities: [],
      countries: [],
      continents: [],
      venue: null,
      farthest: null,
      totalDistanceKm: null,
      medianDistanceKm: null,
    });
    expect(tallyGlobe([], index, paris)).toMatchObject({
      venue: paris,
      farthest: null,
      totalDistanceKm: 0,
      medianDistanceKm: null,
    });
  });

  it("keeps only each participant's newest answer", () => {
    const tally = tallyGlobe(
      [answer('a', paris.id), answer('b', tokyo.id), answer('a', berlin.id)],
      index
    );

    expect(tally.participants).toBe(2);
    expect(names(tally.cities)).toEqual(['Tokyo', 'Berlin']);
  });

  it('excludes hidden answers without resurfacing older ones', () => {
    const tally = tallyGlobe(
      [answer('a', paris.id), answer('a', berlin.id, { isHidden: true }), answer('b', tokyo.id, { isHidden: true })],
      index
    );

    expect(tally.participants).toBe(0);
    expect(tally.cities).toEqual([]);
  });

  it('counts unresolved city ids separately and ignores answers without one', () => {
    const tally = tallyGlobe(
      [answer('a', 'missing'), answer('b', paris.id), answer('c', '  '), { participantKey: 'd' }],
      index
    );

    expect(tally.participants).toBe(1);
    expect(tally.unresolved).toBe(1);
    expect(names(tally.cities)).toEqual(['Paris']);
  });

  it('counts legacy rows without a participant key individually', () => {
    const tally = tallyGlobe([{ placeId: paris.id }, { placeId: paris.id }], index);

    expect(tally.participants).toBe(2);
    expect(tally.cities[0]).toMatchObject({ place: paris, count: 2, distanceKm: null });
  });

  it('orders cities by count, then population, then name', () => {
    const tally = tallyGlobe(
      [
        answer('a', bonn.id),
        answer('b', aachen.id),
        answer('c', tokyo.id),
        answer('d', lyon.id),
        answer('e', lyon.id),
        answer('f', berlin.id),
      ],
      index
    );

    expect(names(tally.cities)).toEqual(['Lyon', 'Tokyo', 'Berlin', 'Aachen', 'Bonn']);
    expect(tally.cities.map((city) => city.count)).toEqual([2, 1, 1, 1, 1]);
  });

  it('groups by country and continent', () => {
    const tally = tallyGlobe(
      [
        answer('a', paris.id),
        answer('b', lyon.id),
        answer('c', berlin.id),
        answer('d', bonn.id),
        answer('e', aachen.id),
        answer('f', tokyo.id),
        answer('g', nyc.id),
      ],
      index
    );

    expect(tally.countries).toEqual([
      { countryCode: 'DE', count: 3 },
      { countryCode: 'FR', count: 2 },
      { countryCode: 'JP', count: 1 },
      { countryCode: 'US', count: 1 },
    ]);
    expect(tally.continents).toEqual([
      { continent: 'Europe', count: 5 },
      { continent: 'Asia', count: 1 },
      { continent: 'North America', count: 1 },
    ]);
  });

  it('measures distances to the venue', () => {
    const tally = tallyGlobe(
      [
        answer('a', paris.id),
        answer('b', paris.id),
        answer('c', berlin.id),
        answer('d', tokyo.id),
        answer('e', lyon.id),
      ],
      index,
      paris
    );

    const toBerlin = distanceKm(paris, berlin);
    const toTokyo = distanceKm(paris, tokyo);
    const toLyon = distanceKm(paris, lyon);

    expect(tally.venue).toBe(paris);
    expect(tally.cities.find((city) => city.place === paris)?.distanceKm).toBe(0);
    expect(tally.farthest?.place).toBe(tokyo);
    expect(tally.farthest?.distanceKm).toBeCloseTo(toTokyo);
    expect(tally.totalDistanceKm).toBeCloseTo(toBerlin + toTokyo + toLyon);
    // Distances sorted: 0, 0, Lyon, Berlin, Tokyo.
    expect(tally.medianDistanceKm).toBeCloseTo(toLyon);
  });

  it('averages the two middle distances for an even participant count', () => {
    const tally = tallyGlobe([answer('a', paris.id), answer('b', berlin.id)], index, paris);

    expect(tally.medianDistanceKm).toBeCloseTo(distanceKm(paris, berlin) / 2);
  });

  it('leaves distance stats empty without a venue', () => {
    const tally = tallyGlobe([answer('a', paris.id), answer('b', tokyo.id)], index);

    expect(tally.cities.every((city) => city.distanceKm === null)).toBe(true);
    expect(tally).toMatchObject({ venue: null, farthest: null, totalDistanceKm: null, medianDistanceKm: null });
  });

  it('resolves real GeoNames ids from the bundled index', async () => {
    const places = await loadPlaces();
    const venue = places.get('2988507')!;
    const tally = tallyGlobe(
      [answer('a', '2911298'), answer('b', '2988507'), answer('c', '2911298')],
      places,
      venue
    );

    expect(venue.name).toBe('Paris');
    expect(tally.cities.map((city) => [city.place.name, city.count])).toEqual([
      ['Hamburg', 2],
      ['Paris', 1],
    ]);
    expect(tally.countries).toEqual([
      { countryCode: 'DE', count: 2 },
      { countryCode: 'FR', count: 1 },
    ]);
    expect(tally.farthest?.place.name).toBe('Hamburg');
    expect(tally.farthest?.distanceKm).toBeGreaterThan(700);
    expect(tally.farthest?.distanceKm).toBeLessThan(800);
  });
});
