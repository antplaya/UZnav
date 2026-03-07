import { getRegion } from './cities.js';

// Yandex Geocoder (primary — best UZ address coverage)
const YANDEX_GEOCODER_URL = 'https://geocode-maps.yandex.ru/1.x/';
// User must set their own API key from https://developer.tech.yandex.com/
const YANDEX_API_KEY = '';

// Nominatim (fallback — free, no key needed)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

let currentRegionKey = 'uz';

/**
 * Set the active region for search biasing.
 */
export function setSearchRegion(regionKey) {
  currentRegionKey = regionKey;
}

/**
 * Search for locations. Tries Yandex first (for UZ), falls back to Nominatim.
 */
export async function searchLocation(query) {
  if (!query || query.trim().length < 2) return [];

  if (YANDEX_API_KEY && currentRegionKey === 'uz') {
    try {
      const results = await searchYandex(query);
      if (results.length > 0) return results;
    } catch (e) {
      console.warn('Yandex geocoder failed, falling back to Nominatim:', e);
    }
  }

  return searchNominatim(query);
}

async function searchYandex(query) {
  const region = getRegion('uz');
  const bbox = `${region.bounds.west},${region.bounds.south}~${region.bounds.east},${region.bounds.north}`;

  const params = new URLSearchParams({
    apikey: YANDEX_API_KEY,
    geocode: query.trim(),
    format: 'json',
    lang: 'en_US',
    results: '5',
    bbox,
    rspn: '1',
  });

  const res = await fetch(`${YANDEX_GEOCODER_URL}?${params}`);
  if (!res.ok) throw new Error(`Yandex geocoding failed: ${res.status}`);

  const data = await res.json();
  const members = data.response?.GeoObjectCollection?.featureMember || [];

  return members.map((item) => {
    const geo = item.GeoObject;
    const pos = geo.Point.pos.split(' '); // "lng lat"
    return {
      name: geo.metaDataProperty?.GeocoderMetaData?.text || geo.name,
      shortName: geo.name,
      lat: parseFloat(pos[1]),
      lng: parseFloat(pos[0]),
    };
  });
}

async function searchNominatim(query) {
  const region = getRegion(currentRegionKey);

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'jsonv2',
    limit: '5',
    countrycodes: region.countrycodes,
    viewbox: `${region.bounds.west},${region.bounds.north},${region.bounds.east},${region.bounds.south}`,
    bounded: '0',
    addressdetails: '1',
  });

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'UZnav/1.0' },
  });

  if (!res.ok) throw new Error(`Nominatim geocoding failed: ${res.status}`);

  const data = await res.json();
  return data.map((item) => ({
    name: item.display_name,
    shortName: item.name || item.display_name.split(',')[0],
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

/**
 * Reverse geocode coordinates to a place name.
 * Tries Yandex first (for UZ), falls back to Nominatim.
 */
export async function reverseGeocode(lat, lng) {
  if (YANDEX_API_KEY && currentRegionKey === 'uz') {
    try {
      const name = await reverseYandex(lat, lng);
      if (name) return name;
    } catch { /* fall through */ }
  }

  return reverseNominatim(lat, lng);
}

async function reverseYandex(lat, lng) {
  const params = new URLSearchParams({
    apikey: YANDEX_API_KEY,
    geocode: `${lng},${lat}`,
    format: 'json',
    lang: 'en_US',
    results: '1',
    kind: 'house',
  });

  const res = await fetch(`${YANDEX_GEOCODER_URL}?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  const members = data.response?.GeoObjectCollection?.featureMember || [];
  if (members.length > 0) {
    const geo = members[0].GeoObject;
    return geo.name || geo.metaDataProperty?.GeocoderMetaData?.text?.split(',')[0] || null;
  }
  return null;
}

async function reverseNominatim(lat, lng) {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: 'jsonv2',
    zoom: '16',
  });

  try {
    const res = await fetch(`${REVERSE_URL}?${params}`, {
      headers: { 'User-Agent': 'UZnav/1.0' },
    });
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    return data.display_name
      ? data.display_name.split(',')[0]
      : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
