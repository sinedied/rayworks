import type { Place, PlaceIndex, PlaceMatch, RawPlaceData } from './types';

/** Lowercases, strips diacritics and collapses punctuation to single spaces. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const displayNames = new Map<string, Intl.DisplayNames | null>();

function regionDisplayNames(locale: string): Intl.DisplayNames | null {
  if (!displayNames.has(locale)) {
    try {
      displayNames.set(locale, new Intl.DisplayNames([locale, 'en'], { type: 'region' }));
    } catch {
      displayNames.set(locale, null);
    }
  }
  return displayNames.get(locale) ?? null;
}

/** Localized country name for an ISO-2 code, falling back to the code itself. */
export function countryName(code: string, locale = 'en'): string {
  try {
    return regionDisplayNames(locale)?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Places whose name is shared by another place in the same country. */
const ambiguousIds = new Set<string>();

/** "Hamburg, Germany"; adds the region when the name is ambiguous within the country. */
export function formatPlace(place: Place, locale = 'en'): string {
  const parts = [place.name];
  if (place.region && place.region !== place.name && ambiguousIds.has(place.id)) {
    parts.push(place.region);
  }
  parts.push(countryName(place.countryCode, locale));
  return parts.join(', ');
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  AE: ['uae'],
  BA: ['bosnia'],
  CD: ['congo', 'drc', 'democratic republic of the congo'],
  CG: ['congo', 'republic of the congo'],
  CI: ['ivory coast', 'cote d ivoire'],
  CZ: ['czech republic'],
  GB: ['uk', 'great britain', 'britain'],
  HK: ['hong kong'],
  KP: ['north korea'],
  KR: ['korea', 'south korea'],
  MK: ['macedonia'],
  MM: ['burma', 'myanmar'],
  MO: ['macau', 'macao'],
  NL: ['holland'],
  PS: ['palestine'],
  RU: ['russia'],
  SZ: ['swaziland'],
  TR: ['turkey'],
  US: ['usa', 'united states of america', 'america'],
  VA: ['vatican'],
};

const ABBREVIATIONS: Record<string, string> = {
  ft: 'fort',
  mt: 'mount',
  st: 'saint',
  ste: 'sainte',
};

/** Expands "st"/"mt"/"ft" so "St. Petersburg" and "Saint Petersburg" find each other. */
function expandAbbreviations(tokens: string[], keepLast = false): string[] {
  return tokens.map((token, i) =>
    keepLast && i === tokens.length - 1 ? token : (ABBREVIATIONS[token] ?? token)
  );
}

type Entry = {
  place: Place;
  keys: string[];
  compactKeys: string[];
  /** Normalized exonyms ("cologne" for Köln), parallel to `aliases`. */
  aliasKeys: string[];
  aliases: string[];
  qualifiers: Set<string>;
};

/** Aliases rank just below primary-name matches of the same kind. */
const ALIAS_PENALTY = 0.5;

const MAX_TOKENS = 8;

/** 0 exact, 1 starts with, 2 word starts with, 3 substring; Infinity for no match. */
function nameRank(entry: Entry, query: string, compactQuery: string): number {
  let best = Infinity;
  for (const key of entry.keys) {
    if (key === query) return 0;
    if (key.startsWith(query)) best = Math.min(best, 1);
    else if (best > 2 && ` ${key}`.includes(` ${query}`)) best = 2;
  }
  if (best === Infinity && compactQuery.length >= 3) {
    for (const key of entry.compactKeys) {
      if (key.includes(compactQuery)) return 3;
    }
  }
  return best;
}

/** Best alias match, ranked like `nameRank` (no substring matches) plus the alias penalty. */
function aliasRank(entry: Entry, query: string): { rank: number; alias?: string } {
  let best = Infinity;
  let alias: string | undefined;
  entry.aliasKeys.forEach((key, i) => {
    const rank = key === query ? 0 : key.startsWith(query) ? 1 : ` ${key}`.includes(` ${query}`) ? 2 : Infinity;
    if (rank < best) {
      best = rank;
      alias = entry.aliases[i];
    }
  });
  return { rank: best + ALIAS_PENALTY, alias };
}

/** Whether `tokens` can be split into country/region terms; the last may be a prefix. */
function matchesQualifiers(qualifiers: Set<string>, tokens: string[]): boolean {
  const reachable = new Array<boolean>(tokens.length + 1).fill(false);
  reachable[0] = true;
  for (let start = 0; start < tokens.length; start++) {
    if (!reachable[start]) continue;
    let segment = '';
    for (let end = start; end < tokens.length; end++) {
      segment = segment ? `${segment} ${tokens[end]}` : tokens[end];
      if (qualifiers.has(segment)) reachable[end + 1] = true;
      else if (end === tokens.length - 1 && segment.length >= 2) {
        for (const term of qualifiers) {
          if (term.length > 3 && term.startsWith(segment)) {
            reachable[end + 1] = true;
            break;
          }
        }
      }
    }
  }
  return reachable[tokens.length];
}

/** Builds the searchable index from the compact generated data. */
export function createPlaceIndex(data: RawPlaceData): PlaceIndex {
  const countryTerms = new Map<string, string[]>();
  const termsForCountry = (code: string) => {
    let terms = countryTerms.get(code);
    if (!terms) {
      terms = [code.toLowerCase(), normalizeText(countryName(code)), ...(COUNTRY_ALIASES[code] ?? [])];
      countryTerms.set(code, terms);
    }
    return terms;
  };

  const places: Place[] = [];
  const entries: Entry[] = [];
  const byId = new Map<string, Place>();
  const nameCounts = new Map<string, number>();

  for (const [id, name, asciiName, regionIndex, countryCode, lat, lon, population, aliasList] of data.cities) {
    const region = data.regions[regionIndex];
    const place: Place = {
      id: String(id),
      name,
      ...(region ? { region: region[0] } : {}),
      countryCode,
      lat,
      lon,
      population,
    };
    const baseKeys = [normalizeText(name), normalizeText(asciiName)].filter(Boolean);
    const keys = [
      ...new Set([...baseKeys, ...baseKeys.map((key) => expandAbbreviations(key.split(' ')).join(' '))]),
    ];
    const qualifiers = new Set(termsForCountry(countryCode));
    if (region) {
      qualifiers.add(normalizeText(region[0]));
      if (region[1]) qualifiers.add(region[1].toLowerCase());
    }
    const aliases = aliasList ? aliasList.split('|') : [];
    places.push(place);
    byId.set(place.id, place);
    entries.push({
      place,
      keys,
      compactKeys: keys.map((key) => key.replace(/ /g, '')),
      aliasKeys: aliases.map(normalizeText),
      aliases,
      qualifiers,
    });
    const nameKey = `${countryCode}:${keys[0]}`;
    nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1);
  }

  for (const entry of entries) {
    if ((nameCounts.get(`${entry.place.countryCode}:${entry.keys[0]}`) ?? 0) > 1) {
      ambiguousIds.add(entry.place.id);
    }
  }

  function searchMatches(query: string, limit = 8): PlaceMatch[] {
    const tokens = normalizeText(query).split(' ').filter(Boolean).slice(0, MAX_TOKENS);
    if (tokens.length === 0 || limit <= 0) return [];

    const ranks = new Map<Entry, { rank: number; alias?: string }>();
    // Try every split of "<name> <country/region qualifiers>", e.g. "paris fr".
    for (let split = tokens.length; split >= 1; split--) {
      // A trailing token is still being typed: "st" may become "stockholm".
      const nameTokens = expandAbbreviations(tokens.slice(0, split), split === tokens.length);
      const nameQuery = nameTokens.join(' ');
      const compactQuery = nameTokens.join('');
      const qualifierTokens = tokens.slice(split);
      for (const entry of entries) {
        let match: { rank: number; alias?: string } = {
          rank: nameRank(entry, nameQuery, compactQuery),
        };
        if (match.rank > 0 && entry.aliasKeys.length) {
          const viaAlias = aliasRank(entry, nameQuery);
          if (viaAlias.rank < match.rank) match = viaAlias;
        }
        if (match.rank === Infinity || match.rank >= (ranks.get(entry)?.rank ?? Infinity)) continue;
        if (qualifierTokens.length && !matchesQualifiers(entry.qualifiers, qualifierTokens)) continue;
        ranks.set(entry, match);
      }
    }

    return [...ranks]
      .sort(
        ([a, matchA], [b, matchB]) =>
          matchA.rank - matchB.rank ||
          b.place.population - a.place.population ||
          a.place.name.localeCompare(b.place.name)
      )
      .slice(0, limit)
      .map(([entry, { alias }]) => (alias ? { place: entry.place, alias } : { place: entry.place }));
  }

  return {
    places,
    get: (id) => byId.get(id),
    search: (query, limit) => searchMatches(query, limit).map((match) => match.place),
    searchMatches,
  };
}
