const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export const POI_CATEGORIES = {
  cafe:       { label: 'Cafe',        icon: '☕', amenity: 'cafe' },
  restaurant: { label: 'Restaurant',  icon: '🍽️', amenity: 'restaurant' },
  fuel:       { label: 'Gas',         icon: '⛽', amenity: 'fuel' },
  pharmacy:   { label: 'Pharmacy',    icon: '💊', amenity: 'pharmacy' },
  hospital:   { label: 'Hospital',    icon: '🏥', amenity: 'hospital' },
  atm:        { label: 'ATM',         icon: '🏧', amenity: 'atm' },
  parking:    { label: 'Parking',     icon: '🅿️', amenity: 'parking' },
  charging:   { label: 'Charging',    icon: '⚡', amenity: 'charging_station' },
};

/**
 * Search for POIs near a location using Overpass API.
 * Mirrors the pattern used in radars.js.
 * @param {string} category - key from POI_CATEGORIES
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius - search radius in meters
 * @returns {Promise<Array>}
 */
export async function searchPOI(category, lat, lng, radius = 3000) {
  const cat = POI_CATEGORIES[category];
  if (!cat) return [];

  const query = `[out:json][timeout:15];
node["amenity"="${cat.amenity}"](around:${radius},${lat},${lng});
out body;`;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) throw new Error(`Overpass error: ${res.status}`);

    const data = await res.json();
    return data.elements
      .filter((el) => el.lat && el.lon)
      .map((el) => ({
        lat: el.lat,
        lng: el.lon,
        name: el.tags?.name || cat.label,
        shortName: el.tags?.name || cat.label,
        category,
        icon: cat.icon,
      }));
  } catch (err) {
    console.warn(`POI search failed for ${category}:`, err);
    return [];
  }
}
