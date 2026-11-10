/**
 * Pure tally for globe ("Where are you joining from?") activities.
 *
 * Answers carry only a GeoNames id; coordinates come from the bundled place index, which the
 * caller loads and passes in so this stays synchronous and free of any Rayfin dependency.
 */
import { latestSubmissions, type AnswerLike } from './aggregate';
import { continentOf, distanceKm } from './places/geo';
import type { Continent, Place } from './places/types';

/** Anything that resolves a GeoNames id to a place, e.g. the `PlaceIndex` from `loadPlaces()`. */
export interface PlaceLookup {
  get(id: string): Place | undefined;
}

export interface GlobeCity {
  place: Place;
  count: number;
  /** Distance to the venue in km, `null` when no venue is set. */
  distanceKm: number | null;
}

export interface GlobeTally {
  /** Participants whose newest answer resolves to a known city. */
  participants: number;
  /** Newest visible answers whose city id is not in the index. */
  unresolved: number;
  /** Sorted by count desc, then population desc, then name. */
  cities: GlobeCity[];
  /** Sorted by count desc, then country code. */
  countries: { countryCode: string; count: number }[];
  /** Sorted by count desc, then name. */
  continents: { continent: Continent; count: number }[];
  venue: Place | null;
  /** City farthest from the venue, `null` without a venue or participants. */
  farthest: GlobeCity | null;
  /** Sum of every participant's distance to the venue, `null` without a venue. */
  totalDistanceKm: number | null;
  /** Median participant distance to the venue, `null` without a venue or participants. */
  medianDistanceKm: number | null;
}

function byCountThenKey<K extends string>(counts: Map<K, number>): [K, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Tallies where participants are joining from.
 *
 * Each participant's newest submission wins; hiding it removes the participant rather than
 * resurfacing an older answer. Rows without a participant key (older data) count individually.
 */
export function tallyGlobe(
  answers: AnswerLike[],
  places: PlaceLookup,
  venue: Place | null = null
): GlobeTally {
  const seen = new Set<string>();
  const byCity = new Map<string, GlobeCity>();
  let participants = 0;
  let unresolved = 0;

  for (const answer of latestSubmissions(answers)) {
    if (answer.isHidden) continue;
    const placeId = answer.placeId?.trim();
    if (!placeId) continue;

    if (answer.participantKey) {
      if (seen.has(answer.participantKey)) continue;
      seen.add(answer.participantKey);
    }

    const place = places.get(placeId);
    if (!place) {
      unresolved += 1;
      continue;
    }

    participants += 1;
    const city = byCity.get(place.id);
    if (city) {
      city.count += 1;
    } else {
      byCity.set(place.id, {
        place,
        count: 1,
        distanceKm: venue ? (place.id === venue.id ? 0 : distanceKm(venue, place)) : null,
      });
    }
  }

  const cities = [...byCity.values()].sort(
    (a, b) =>
      b.count - a.count ||
      b.place.population - a.place.population ||
      a.place.name.localeCompare(b.place.name) ||
      a.place.id.localeCompare(b.place.id)
  );

  const countryCounts = new Map<string, number>();
  const continentCounts = new Map<Continent, number>();
  for (const { place, count } of cities) {
    countryCounts.set(place.countryCode, (countryCounts.get(place.countryCode) ?? 0) + count);
    const continent = continentOf(place.countryCode);
    if (continent) continentCounts.set(continent, (continentCounts.get(continent) ?? 0) + count);
  }

  let farthest: GlobeCity | null = null;
  let totalDistanceKm: number | null = null;
  let medianDistanceKm: number | null = null;
  if (venue) {
    const distances: number[] = [];
    totalDistanceKm = 0;
    for (const city of cities) {
      const distance = city.distanceKm ?? 0;
      totalDistanceKm += distance * city.count;
      for (let i = 0; i < city.count; i++) distances.push(distance);
      if (!farthest || distance > (farthest.distanceKm ?? 0)) farthest = city;
    }
    medianDistanceKm = median(distances);
  }

  return {
    participants,
    unresolved,
    cities,
    countries: byCountThenKey(countryCounts).map(([countryCode, count]) => ({ countryCode, count })),
    continents: byCountThenKey(continentCounts).map(([continent, count]) => ({ continent, count })),
    venue,
    farthest,
    totalDistanceKm,
    medianDistanceKm,
  };
}
