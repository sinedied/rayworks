#!/usr/bin/env node
// Regenerates the bundled place assets in src/lib/places/:
//   - cities.data.json  GeoNames cities (CC BY 4.0), compact tuples, plus search aliases
//                       (exonyms such as "Cologne" for Köln) confirmed by Natural Earth
//   - world-110m.json   Natural Earth 110m admin-0 countries (public domain)
//   - continents.ts     ISO-2 → continent from GeoNames countryInfo.txt
// Downloads are cached in node_modules/.cache/places. Pass --refresh to re-download.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, inflateRawSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src/lib/places');
const cacheDir = join(root, 'node_modules/.cache/places');
const refresh = process.argv.includes('--refresh');

const SOURCES = {
  cities: 'https://download.geonames.org/export/dump/cities15000.zip',
  admin1: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
  countryInfo: 'https://download.geonames.org/export/dump/countryInfo.txt',
  world:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
  populatedPlaces:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson',
};

// Population floor for ordinary cities. National capitals (PPLC) are always kept, and
// first-order admin seats (PPLA) are kept down to the 15,000 floor of the source file.
const MIN_POPULATION = 50_000;
const MIN_ADMIN_SEAT_POPULATION = 15_000;

// Search aliases: at most this many per city, drawn from the GeoNames `alternatenames` column
// and kept only when Natural Earth confirms them as a Latin-script localized or former name.
const MAX_ALIASES = 6;
const ALIAS_LANGUAGES = ['EN', 'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'PL', 'SV', 'HU', 'TR', 'ID', 'VI'];
// Tagalog/Cebuano "City of X" entries carry English names (Lungsod ng Cologne, Dakbayan sa Bombay).
const ENGLISH_WRAPPER = /^(?:Lungsod ng|Dakbayan sa) (.+)$/;
// Natural Earth matches by GeoNames id, or by name within this distance in degrees.
const NEARBY_DEGREES = 0.25;

async function download(name, url) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, url.split('/').pop());
  if (!refresh && existsSync(file)) return readFileSync(file);
  console.log(`Downloading ${name}: ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(file, buffer);
  return buffer;
}

/** Extracts one entry from a zip archive using its central directory. */
function unzipEntry(zip, entryName) {
  const eocdSignature = 0x06054b50;
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== eocdSignature) eocd--;
  if (eocd < 0) throw new Error('Invalid zip: no end of central directory');
  const entries = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === entryName) {
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = zip.subarray(start, start + compressedSize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`Unsupported zip compression method ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`Zip entry not found: ${entryName}`);
}

const round2 = (value) => Math.round(value * 100) / 100;
const roundPopulation = (value) => {
  if (value < 1000) return value;
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 2);
  return Math.round(value / magnitude) * magnitude;
};
const stripDiacritics = (value) => value.normalize('NFD').replace(/\p{M}/gu, '');
const tsvRows = (text) =>
  text
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('\t'));

const searchKey = (value) =>
  stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** ASCII letters, spaces, hyphens and apostrophes; no all-caps codes such as "NYC" or "HCM". */
const isPlausibleAlias = (value) =>
  /^[A-Za-z][A-Za-z '-]{2,39}$/.test(value) && !(value.length <= 4 && value === value.toUpperCase());

/** Indexes Natural Earth populated places by GeoNames id and by country. */
async function loadAliasSources() {
  const source = JSON.parse(
    (await download('Natural Earth 10m populated places', SOURCES.populatedPlaces)).toString()
  );
  const byId = new Map();
  const byCountry = new Map();
  for (const { properties: props } of source.features) {
    const names = [];
    // Former or alternate names first ("Madras", "Calcutta"), then localized names.
    for (const value of [props.NAMEPAR, props.NAMEALT]) {
      if (value) names.push({ name: value, weight: 12 });
    }
    ALIAS_LANGUAGES.forEach((language, index) => {
      const value = props[`NAME_${language}`];
      if (value) names.push({ name: value, weight: 10 - index / 100 });
    });
    const entry = {
      lat: props.LATITUDE,
      lon: props.LONGITUDE,
      keys: new Set([props.NAME, props.NAMEASCII, props.NAME_EN].filter(Boolean).map(searchKey)),
      names,
    };
    if (props.GEONAMESID > 0) byId.set(String(props.GEONAMESID), entry);
    const iso = props.ISO_A2;
    if (/^[A-Z]{2}$/.test(iso ?? '')) {
      if (!byCountry.has(iso)) byCountry.set(iso, []);
      byCountry.get(iso).push(entry);
    }
  }
  return { byId, byCountry };
}

/** Natural Earth record for a GeoNames row: by id, else the nearest same-named place. */
function naturalEarthFor(row, sources) {
  const direct = sources.byId.get(row[0]);
  if (direct) return direct;
  const lat = Number(row[4]);
  const lon = Number(row[5]);
  const names = [row[1], row[2]].map(searchKey);
  let best;
  let bestDistance = Infinity;
  for (const entry of sources.byCountry.get(row[8]) ?? []) {
    const distance = Math.hypot(entry.lat - lat, entry.lon - lon);
    if (distance > NEARBY_DEGREES || distance >= bestDistance) continue;
    if (!names.some((name) => entry.keys.has(name))) continue;
    best = entry;
    bestDistance = distance;
  }
  return best;
}

/**
 * Up to MAX_ALIASES exonyms for a city, e.g. "Cologne" for Köln or "Bombay" for Mumbai. Candidates
 * come from the GeoNames `alternatenames` column; Natural Earth (or an English "City of X" entry)
 * confirms they are real localized names rather than transliteration noise. Names the primary
 * name already finds by prefix are skipped. Joined with "|", or '' when there are none.
 */
function aliasesFor(row, sources) {
  const primaryKeys = [searchKey(row[1]), searchKey(row[2])];
  const column = new Map();
  for (const value of row[3].split(',')) {
    const wrapped = ENGLISH_WRAPPER.exec(value);
    const name = stripDiacritics(wrapped ? wrapped[1] : value).trim();
    if (!isPlausibleAlias(name)) continue;
    const key = searchKey(name);
    const current = column.get(key);
    if (!current || wrapped) column.set(key, { name, english: current?.english || !!wrapped });
  }

  const scores = new Map();
  const confirm = (value, weight) => {
    const key = searchKey(stripDiacritics(value));
    const candidate = column.get(key);
    if (!candidate || primaryKeys.some((primary) => primary.startsWith(key))) return;
    scores.set(key, (scores.get(key) ?? 0) + weight);
  };
  for (const { name, weight } of naturalEarthFor(row, sources)?.names ?? []) confirm(name, weight);
  for (const [key, { english }] of column) if (english) confirm(key, 10);

  const keys = [...scores.keys()].sort((a, b) => scores.get(b) - scores.get(a) || a.localeCompare(b));
  // "Pekin" is redundant next to "Peking": a prefix search for either finds the longer one.
  const kept = keys.filter((key) => !keys.some((other) => other !== key && other.startsWith(key)));
  return kept
    .slice(0, MAX_ALIASES)
    .map((key) => column.get(key).name)
    .join('|');
}

const formatSize = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

function report(file, content) {
  const raw = Buffer.byteLength(content);
  const gz = gzipSync(content, { level: 9 }).length;
  console.log(`${file}: ${formatSize(raw)} raw, ${formatSize(gz)} gzip`);
}

async function buildCities() {
  const [zip, admin1Text, aliasSources] = await Promise.all([
    download('GeoNames cities15000', SOURCES.cities),
    download('GeoNames admin1 codes', SOURCES.admin1),
    loadAliasSources(),
  ]);

  const admin1 = new Map(tsvRows(admin1Text.toString('utf8')).map(([key, name]) => [key, name]));
  const rows = tsvRows(unzipEntry(zip, 'cities15000.txt').toString('utf8'));

  const kept = rows.filter((row) => {
    const featureCode = row[7];
    const population = Number(row[14]);
    if (featureCode === 'PPLC') return true;
    if (featureCode === 'PPLA') return population >= MIN_ADMIN_SEAT_POPULATION;
    return population >= MIN_POPULATION;
  });

  // Regions are deduplicated into a table; a short alphabetic admin1 code (US states,
  // Swiss cantons, UK nations...) is kept so queries like "springfield il" can match.
  const regions = [];
  const regionIndex = new Map();
  const regionOf = (countryCode, admin1Code) => {
    const key = `${countryCode}.${admin1Code}`;
    const name = admin1.get(key);
    if (!name) return -1;
    if (!regionIndex.has(key)) {
      regionIndex.set(key, regions.length);
      regions.push(/^[A-Z]{2,3}$/.test(admin1Code) ? [name, admin1Code] : [name]);
    }
    return regionIndex.get(key);
  };

  kept.sort(
    (a, b) =>
      a[8].localeCompare(b[8]) || a[10].localeCompare(b[10]) || a[1].localeCompare(b[1])
  );

  // Tuple: [numeric GeoNames id, name, asciiName (only when it differs from the stripped
  // name), region index or -1, ISO-2 country, lat, lon, population to 3 significant digits,
  // then "|"-joined search aliases only when the city has any].
  let aliasCount = 0;
  const cities = kept.map((row) => {
    const [id, name, asciiName] = row;
    const ascii = stripDiacritics(name) === asciiName ? '' : asciiName;
    const aliases = aliasesFor(row, aliasSources);
    if (aliases) aliasCount += aliases.split('|').length;
    return [
      Number(id),
      name,
      ascii,
      regionOf(row[8], row[10]),
      row[8],
      round2(Number(row[4])),
      round2(Number(row[5])),
      roundPopulation(Number(row[14])),
      ...(aliases ? [aliases] : []),
    ];
  });

  const content = JSON.stringify({ regions, cities });
  writeFileSync(join(outDir, 'cities.data.json'), content);
  const countries = new Set(cities.map((city) => city[4]));
  console.log(
    `cities.data.json: ${cities.length} cities (of ${rows.length}), ${countries.size} countries, ${regions.length} regions, ${aliasCount} aliases on ${cities.filter((city) => city.length > 8).length} cities`
  );
  report('cities.data.json', content);
  return countries;
}

function roundRing(ring) {
  const out = [];
  for (const [lon, lat] of ring) {
    const point = [round2(lon), round2(lat)];
    const last = out[out.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  const [first] = out;
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([...first]);
  return out.length >= 4 ? out : null;
}

function roundPolygon(polygon) {
  const rings = [];
  for (const ring of polygon) {
    const rounded = roundRing(ring);
    if (rounded) rings.push(rounded);
    else if (rings.length === 0) return null;
  }
  return rings;
}

async function buildWorld() {
  const source = JSON.parse(
    (await download('Natural Earth 110m countries', SOURCES.world)).toString()
  );
  const features = [];
  for (const feature of source.features) {
    const props = feature.properties;
    // Natural Earth uses -99 for a few ISO_A2 values (France, Norway...); ISO_A2_EH fills them.
    const iso =
      [props.ISO_A2, props.ISO_A2_EH].find((code) => /^[A-Z]{2}$/.test(code ?? '')) ?? '';
    const { type, coordinates } = feature.geometry;
    const polygons = (type === 'Polygon' ? [coordinates] : coordinates)
      .map(roundPolygon)
      .filter(Boolean);
    if (polygons.length === 0) continue;
    features.push({
      type: 'Feature',
      properties: { iso_a2: iso, name: props.NAME },
      geometry:
        polygons.length === 1
          ? { type: 'Polygon', coordinates: polygons[0] }
          : { type: 'MultiPolygon', coordinates: polygons },
    });
  }
  const content = JSON.stringify({ type: 'FeatureCollection', features });
  writeFileSync(join(outDir, 'world-110m.json'), content);
  console.log(`world-110m.json: ${features.length} countries`);
  report('world-110m.json', content);
}

async function buildContinents(cityCountries) {
  const text = (await download('GeoNames country info', SOURCES.countryInfo)).toString('utf8');
  const names = {
    AF: 'Africa',
    AN: 'Antarctica',
    AS: 'Asia',
    EU: 'Europe',
    NA: 'North America',
    OC: 'Oceania',
    SA: 'South America',
  };
  const byContinent = Object.fromEntries(Object.keys(names).map((code) => [code, []]));
  for (const row of tsvRows(text)) {
    const iso = row[0];
    const continent = row[8];
    if (/^[A-Z]{2}$/.test(iso) && byContinent[continent]) byContinent[continent].push(iso);
  }
  const known = new Set(Object.values(byContinent).flat());
  const missing = [...cityCountries].filter((code) => !known.has(code));
  if (missing.length) throw new Error(`No continent for: ${missing.join(', ')}`);

  const entries = Object.entries(byContinent).map(([code, isos]) => {
    const sorted = isos.sort();
    const chunks = [];
    for (let i = 0; i < sorted.length; i += 20) chunks.push(sorted.slice(i, i + 20).join(' '));
    return `  '${names[code]}': [\n${chunks.map((chunk) => `    '${chunk}',`).join('\n')}\n  ],`;
  });
  const content = `// Generated by scripts/build-places.mjs from GeoNames countryInfo.txt (CC BY 4.0).
// Do not edit by hand; run \`npm run places:build\`.
export const CONTINENT_COUNTRIES = {
${entries.join('\n')}
} as const;
`;
  writeFileSync(join(outDir, 'continents.ts'), content);
  console.log(`continents.ts: ${known.size} countries`);
}

mkdirSync(outDir, { recursive: true });
const cityCountries = await buildCities();
await buildWorld();
await buildContinents(cityCountries);
