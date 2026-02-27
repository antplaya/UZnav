const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

let cachedCameras = null;

/**
 * Fetch speed cameras in Uzbekistan from OSM Overpass API.
 * Caches results in memory to avoid repeated API calls.
 * @returns {Promise<Array<{lat: number, lng: number, maxspeed: string, direction: string}>>}
 */
export async function fetchSpeedCameras() {
  if (cachedCameras) return cachedCameras;

  const query = `[out:json][timeout:25];
area["ISO3166-1"="UZ"][admin_level=2]->.uz;
(
  node["highway"="speed_camera"](area.uz);
  node["enforcement"](area.uz);
);
out body;`;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);

    const data = await res.json();
    cachedCameras = data.elements
      .filter((el) => el.lat && el.lon)
      .map((el) => ({
        lat: el.lat,
        lng: el.lon,
        maxspeed: el.tags?.maxspeed || '',
        direction: el.tags?.direction || '',
        type: el.tags?.enforcement || 'speed_camera',
      }));

    return cachedCameras;
  } catch (err) {
    console.warn('Failed to fetch speed cameras:', err);
    return [];
  }
}

/**
 * Check if a GPS position is near any speed camera.
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @param {Array} cameras - Array of camera objects
 * @param {number} thresholdMeters - Alert distance in meters (default 500)
 * @returns {object|null} Nearest camera within threshold, or null
 */
export function checkCameraProximity(lat, lng, cameras, thresholdMeters = 500) {
  if (!cameras || cameras.length === 0) return null;

  let nearest = null;
  let nearestDist = Infinity;

  for (const cam of cameras) {
    const dist = haversine(lat, lng, cam.lat, cam.lng);
    if (dist < thresholdMeters && dist < nearestDist) {
      nearest = cam;
      nearestDist = dist;
    }
  }

  return nearest;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
