import { describe, expect, it } from 'vitest';

import { CONTINENT_COUNTRIES } from '@/lib/places/continents';
import {
  continentOf,
  countryName,
  distanceKm,
  formatPlace,
  greatCircle,
  loadPlaces,
  loadWorld,
  normalizeText,
  placesAttribution,
  type Place,
} from '@/lib/places';

const names = (places: Place[]) => places.map((place) => `${place.name}, ${place.countryCode}`);

describe('place data', () => {
  it('loads well-formed, unique places', async () => {
    const index = await loadPlaces();
    expect(index.places.length).toBeGreaterThan(10_000);
    const ids = new Set<string>();
    for (const place of index.places) {
      expect(place.id).toMatch(/^\d+$/);
      expect(place.name.length).toBeGreaterThan(0);
      expect(place.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(Math.abs(place.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(place.lon)).toBeLessThanOrEqual(180);
      expect(Number.isInteger(place.population)).toBe(true);
      ids.add(place.id);
    }
    expect(ids.size).toBe(index.places.length);
  });

  it('memoizes the index', async () => {
    expect(await loadPlaces()).toBe(await loadPlaces());
  });

  it('keeps small national capitals', async () => {
    const index = await loadPlaces();
    expect(names(index.search('vaduz', 1))).toEqual(['Vaduz, LI']);
    expect(index.search('valletta', 1)[0]?.countryCode).toBe('MT');
  });

  it('gets places by GeoNames id', async () => {
    const index = await loadPlaces();
    const paris = index.get('2988507');
    expect(paris).toMatchObject({ name: 'Paris', countryCode: 'FR', region: 'Île-de-France' });
    expect(paris?.lat).toBeCloseTo(48.85, 1);
    expect(index.get('nope')).toBeUndefined();
  });

  it('has a continent for every country in the dataset', async () => {
    const index = await loadPlaces();
    const missing = [...new Set(index.places.map((place) => place.countryCode))].filter(
      (code) => !continentOf(code)
    );
    expect(missing).toEqual([]);
  });

  it('loads stripped Natural Earth country shapes', async () => {
    const world = await loadWorld();
    expect(world.type).toBe('FeatureCollection');
    expect(world.features.length).toBeGreaterThan(150);
    for (const feature of world.features) {
      expect(Object.keys(feature.properties).sort()).toEqual(['iso_a2', 'name']);
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
    }
    const codes = world.features.map((feature) => feature.properties.iso_a2);
    expect(codes).toEqual(expect.arrayContaining(['FR', 'NO', 'US', 'BR', 'AU']));
    expect(await loadWorld()).toBe(world);
  });

  it('exposes attribution text', () => {
    expect(placesAttribution).toBe(
      'City data © GeoNames (CC BY 4.0). Country shapes: Natural Earth.'
    );
  });
});

describe('search', () => {
  it('ranks prefixes by population', async () => {
    const index = await loadPlaces();
    expect(index.search('par')[0]).toMatchObject({ name: 'Paris', countryCode: 'FR' });
    expect(index.search('lon')[0]).toMatchObject({ name: 'London', countryCode: 'GB' });
  });

  it('ranks prefixes above substrings', async () => {
    const index = await loadPlaces();
    const results = index.search('york', 20);
    const firstSubstring = results.findIndex((place) => !/\byork/i.test(place.name));
    const lastPrefix = results.map((place) => /\byork/i.test(place.name)).lastIndexOf(true);
    expect(results.length).toBeGreaterThan(0);
    if (firstSubstring !== -1) expect(lastPrefix).toBeLessThan(firstSubstring);
  });

  it('ignores accents and case', async () => {
    const index = await loadPlaces();
    for (const query of ['Zürich', 'zurich', 'ZURICH']) {
      expect(index.search(query)[0]).toMatchObject({ name: 'Zürich', countryCode: 'CH' });
    }
    for (const query of ['São Paulo', 'sao paulo', 'sao pa']) {
      expect(index.search(query)[0]).toMatchObject({ name: 'São Paulo', countryCode: 'BR' });
    }
  });

  it('matches words inside multi-word names', async () => {
    const index = await loadPlaces();
    expect(names(index.search('paulo', 3))).toContain('São Paulo, BR');
  });

  it('treats "St." and "Saint" alike', async () => {
    const index = await loadPlaces();
    expect(names(index.search('st petersburg'))).toEqual(
      expect.arrayContaining(['Saint Petersburg, RU', 'St. Petersburg, US'])
    );
    expect(index.search('saint petersburg russia')[0]).toMatchObject({ countryCode: 'RU' });
    expect(index.search('st. louis')[0]).toMatchObject({ name: 'St. Louis', countryCode: 'US' });
    expect(index.search('stockh')[0]).toMatchObject({ name: 'Stockholm' });
  });

  it('understands "city, country" and "city region" queries', async () => {
    const index = await loadPlaces();
    expect(names(index.search('paris fr'))[0]).toBe('Paris, FR');
    expect(names(index.search('Paris, France'))[0]).toBe('Paris, FR');
    expect(names(index.search('paris, fran'))[0]).toBe('Paris, FR');

    const springfield = index.search('springfield il');
    expect(springfield).toHaveLength(1);
    expect(springfield[0]).toMatchObject({ region: 'Illinois', countryCode: 'US' });

    const portland = index.search('Portland, Oregon, United States');
    expect(portland[0]).toMatchObject({ name: 'Portland', region: 'Oregon' });
    expect(index.search('portland maine')[0]).toMatchObject({ region: 'Maine' });
    expect(index.search('london uk')[0]).toMatchObject({ countryCode: 'GB' });
    expect(index.search('london ontario')[0]).toMatchObject({ countryCode: 'CA' });
  });

  it('finds cities by common exonyms and reports the alias', async () => {
    const index = await loadPlaces();
    expect(index.search('cologne')[0]).toMatchObject({ name: 'Köln', countryCode: 'DE' });
    expect(index.searchMatches('cologne')[0]).toMatchObject({ alias: 'Cologne' });
    expect(index.search('munich')[0]).toMatchObject({ id: '2867714', countryCode: 'DE' });
    expect(index.searchMatches('münchen')[0]).toMatchObject({
      place: { id: '2867714' },
      alias: 'Munchen',
    });
    expect(index.search('bombay')[0]).toMatchObject({ name: 'Mumbai', countryCode: 'IN' });
    expect(index.search('wien')[0]).toMatchObject({ name: 'Vienna', countryCode: 'AT' });
    expect(index.search('calcutta')[0]).toMatchObject({ name: 'Kolkata' });
    expect(index.search('peking')[0]).toMatchObject({ name: 'Beijing' });
    expect(index.search('cologne germany')[0]).toMatchObject({ name: 'Köln' });
    // Primary-name matches stay first; plain name matches carry no alias.
    expect(index.searchMatches('paris')[0]).toEqual({ place: expect.objectContaining({ name: 'Paris' }) });
    const canton = index.search('canton', 20);
    expect(canton[0]).toMatchObject({ name: 'Canton', countryCode: 'US' });
    expect(canton.map((place) => place.name)).toContain('Guangzhou');
  });

  it('returns nothing for empty or unknown queries', async () => {
    const index = await loadPlaces();
    expect(index.search('')).toEqual([]);
    expect(index.search('  ,  ')).toEqual([]);
    expect(index.search('qqqxxzz')).toEqual([]);
  });

  it('respects the limit', async () => {
    const index = await loadPlaces();
    expect(index.search('san')).toHaveLength(8);
    expect(index.search('san', 3)).toHaveLength(3);
  });
});

describe('formatting', () => {
  it('normalizes text', () => {
    expect(normalizeText('  São-Paulo, BR ')).toBe('sao paulo br');
  });

  it('names countries with a fallback', () => {
    expect(countryName('DE')).toBe('Germany');
    expect(countryName('de', 'fr')).toBe('Allemagne');
    expect(countryName('not a code')).toBe('not a code');
  });

  it('adds the region only for ambiguous names', async () => {
    const index = await loadPlaces();
    expect(formatPlace(index.search('hamburg')[0])).toBe('Hamburg, Germany');
    expect(formatPlace(index.search('portland oregon')[0])).toBe(
      'Portland, Oregon, United States'
    );
    expect(formatPlace(index.search('paris')[0], 'fr')).toBe('Paris, France');
  });
});

describe('geo helpers', () => {
  const paris = { lat: 48.8566, lon: 2.3522 };
  const newYork = { lat: 40.7128, lon: -74.006 };

  it('computes great-circle distances', () => {
    expect(distanceKm(paris, newYork)).toBeGreaterThan(5837 * 0.99);
    expect(distanceKm(paris, newYork)).toBeLessThan(5837 * 1.01);
    expect(distanceKm(paris, paris)).toBe(0);
  });

  it('interpolates arcs between the endpoints', () => {
    const arc = greatCircle(paris, newYork);
    expect(arc).toHaveLength(65);
    expect(arc[0]).toEqual([paris.lon, paris.lat]);
    expect(arc[64]).toEqual([newYork.lon, newYork.lat]);
    // The arc bows north of both endpoints.
    expect(Math.max(...arc.map(([, lat]) => lat))).toBeGreaterThan(paris.lat);
    expect(greatCircle(paris, newYork, 4)).toHaveLength(5);
  });

  it('keeps antimeridian crossings continuous', () => {
    const tokyo = { lat: 35.68, lon: 139.69 };
    const sanFrancisco = { lat: 37.77, lon: -122.42 };
    const arc = greatCircle(tokyo, sanFrancisco, 32);
    for (let i = 1; i < arc.length; i++) {
      expect(Math.abs(arc[i][0] - arc[i - 1][0])).toBeLessThan(180);
    }
    const [lastLon, lastLat] = arc[arc.length - 1];
    expect(lastLon).toBeCloseTo(sanFrancisco.lon + 360, 6);
    expect(lastLat).toBeCloseTo(sanFrancisco.lat, 6);
  });

  it('handles identical endpoints', () => {
    expect(greatCircle(paris, paris, 2)).toEqual([
      [paris.lon, paris.lat],
      [paris.lon, paris.lat],
      [paris.lon, paris.lat],
    ]);
  });

  it('maps countries to continents', () => {
    expect(continentOf('FR')).toBe('Europe');
    expect(continentOf('br')).toBe('South America');
    expect(continentOf('US')).toBe('North America');
    expect(continentOf('JP')).toBe('Asia');
    expect(continentOf('NG')).toBe('Africa');
    expect(continentOf('AU')).toBe('Oceania');
    expect(continentOf('AQ')).toBe('Antarctica');
    expect(continentOf('ZZ')).toBeUndefined();
    const all = Object.values(CONTINENT_COUNTRIES).flatMap((rows) => rows.join(' ').split(' '));
    expect(new Set(all).size).toBe(all.length);
  });
});
