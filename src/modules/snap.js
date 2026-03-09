const OSRM_MATCH = 'https://router.project-osrm.org/match/v1/driving';

let lastSnappedPos = null;
let pendingCtrl = null;
let lastSnapTime = 0;
const THROTTLE_MS = 800;         // faster refresh for smoother tracking
const SNAP_SKIP_SPEED_MS = 22;  // skip snapping above ~80 km/h (22 m/s) — too fast to benefit

/**
 * Snap a GPS coordinate to the nearest road using OSRM /match.
 * Duplicates the point (OSRM requires ≥2 points).
 * Throttled to avoid hammering the public API.
 * @returns {Promise<{lat, lng}|null>}
 */
export async function snapToRoad(lng, lat, speedMs = 0) {
  // At high speed the snap result is stale before it arrives — use raw GPS
  if (speedMs >= SNAP_SKIP_SPEED_MS) return null;

  const now = Date.now();
  if (now - lastSnapTime < THROTTLE_MS && lastSnappedPos) return lastSnappedPos;
  lastSnapTime = now;

  if (pendingCtrl) pendingCtrl.abort();
  const ctrl = new AbortController();
  pendingCtrl = ctrl;

  try {
    const res = await fetch(
      `${OSRM_MATCH}/${lng},${lat};${lng},${lat}?radiuses=50;50&geometries=geojson&overview=false&timestamps=0;1`,
      { signal: ctrl.signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok') return null;
    const tp = data.tracepoints?.find((t) => t !== null);
    if (tp?.location) {
      lastSnappedPos = { lng: tp.location[0], lat: tp.location[1] };
      return lastSnappedPos;
    }
    return null;
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('Snap to road failed:', e);
    return null;
  } finally {
    pendingCtrl = null;
  }
}

export function getLastSnappedPos() {
  return lastSnappedPos;
}
