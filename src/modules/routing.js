/**
 * Routing module — manages waypoints and fetches routes via ORS.
 * No map dependency — route rendering is handled by map.js.
 */
import { fetchOrsRoute, ORS_API_KEY } from './ors-proxy.js';

let waypoints = []; // Array of [lng, lat]
let callbacks = {};
let currentOptions = {};
let abortController = null;

/**
 * Initialize routing with callbacks.
 * @param {object} cbs
 * @param {Function} cbs.onRoutesFound - called with routes array or null
 * @param {Function} cbs.onRoutesStart - called when fetch starts
 * @param {Function} cbs.onWaypointAdd - called with {lng, lat} when waypoint added
 * @param {Function} cbs.onWaypointChange - called with waypoints array when changed
 * @param {object} options - { avoidHighways, avoidTolls, avoidFerries }
 */
export function initRouting(cbs, options = {}) {
  callbacks = cbs;
  currentOptions = options;
}

/**
 * Update routing options (avoid toggles) and re-fetch if route exists.
 */
export function updateRoutingOptions(options) {
  currentOptions = options;
  if (waypoints.length >= 2) fetchRoute();
}

/**
 * Set waypoints programmatically and fetch route.
 * @param {Array<[number, number]>} coords - array of [lng, lat]
 */
export function setWaypoints(coords) {
  waypoints = coords.map((c) => [...c]);
  notifyChange();
  if (waypoints.length >= 2) fetchRoute();
}

/**
 * Add a single waypoint at the end.
 */
export function addWaypoint(lng, lat) {
  waypoints.push([lng, lat]);
  if (callbacks.onWaypointAdd) callbacks.onWaypointAdd({ lng, lat });
  notifyChange();
  if (waypoints.length >= 2) fetchRoute();
}

/**
 * Remove a waypoint by index.
 */
export function removeWaypointByIndex(index) {
  if (index < 0 || index >= waypoints.length) return;
  waypoints.splice(index, 1);
  notifyChange();
  if (waypoints.length >= 2) fetchRoute();
}

/**
 * Clear all waypoints and route.
 */
export function clearRoute() {
  // Abort any in-flight request
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  waypoints = [];
  notifyChange();
}

/**
 * Get current waypoint coordinates.
 * @returns {Array<[number, number]>}
 */
export function getWaypointCoords() {
  return waypoints.map((c) => [...c]);
}

function notifyChange() {
  if (callbacks.onWaypointChange) callbacks.onWaypointChange(getWaypointCoords());
}

async function fetchRoute() {
  if (waypoints.length < 2) return;
  if (!ORS_API_KEY) {
    console.warn('[routing] No ORS API key — cannot fetch route');
    return;
  }

  // Abort previous request
  if (abortController) abortController.abort();
  abortController = new AbortController();

  if (callbacks.onRoutesStart) callbacks.onRoutesStart();

  try {
    const result = await fetchOrsRoute(waypoints, currentOptions);
    if (!result || !result.routes?.length) {
      if (callbacks.onRoutesFound) callbacks.onRoutesFound(null);
      return;
    }

    const routes = result.routes.map((r) => ({
      distance: r.distance,
      duration: r.duration,
      steps: r.steps || [],
      geometry: r.geometry,
    }));

    if (callbacks.onRoutesFound) callbacks.onRoutesFound(routes);
  } catch (err) {
    if (err.name === 'AbortError') return; // Silently ignore aborts
    console.error('[routing] fetch failed:', err);
    if (callbacks.onRoutesFound) callbacks.onRoutesFound(null);
  }
}
