import MapLibreGlDirections from '@maplibre/maplibre-gl-directions';
import '@maplibre/maplibre-gl-directions/dist/style.css';

let directions = null;

/**
 * Initialize MapLibre GL Directions plugin.
 * @param {maplibregl.Map} map
 * @param {object} callbacks
 * @param {Function} callbacks.onRoutesFound - called with route data
 * @param {Function} callbacks.onWaypointAdd - called with {lng, lat} when waypoint added via map click
 * @param {Function} callbacks.onWaypointChange - called when waypoints change (any reason)
 */
export function initRouting(map, { onRoutesFound, onWaypointAdd, onWaypointChange }) {
  // Clean up previous instance if re-initializing (e.g. after theme change)
  if (directions) {
    try { directions.destroy(); } catch { /* may not exist */ }
    directions = null;
  }

  directions = new MapLibreGlDirections(map, {
    api: 'https://router.project-osrm.org/route/v1',
    profile: 'driving',
    requestOptions: {
      overview: 'full',
      steps: 'true',
      geometries: 'geojson',
    },
  });

  directions.interactive = true;

  // Listen for route results (v0.7 API: e.data IS the Directions object)
  directions.on('fetchroutesend', (e) => {
    if (e.data && e.data.routes && e.data.routes.length > 0) {
      const route = e.data.routes[0];
      onRoutesFound({
        distance: route.distance, // meters
        duration: route.duration, // seconds
        steps: route.legs ? route.legs.flatMap((leg) => leg.steps || []) : [],
      });
    }
  });

  // Listen for waypoint added (from map click)
  // v0.7 API: e.data has {index}, get coords from waypointsCoordinates
  directions.on('addwaypoint', (e) => {
    if (e.data && e.data.index !== undefined) {
      const coords = directions.waypointsCoordinates[e.data.index];
      if (coords) {
        onWaypointAdd({ lng: coords[0], lat: coords[1] });
      }
    }
    notifyChange();
  });

  const notifyChange = () => {
    const coords = directions.waypointsCoordinates;
    onWaypointChange(coords);
  };

  directions.on('removewaypoint', notifyChange);
  directions.on('movewaypoint', notifyChange);
  directions.on('setwaypoints', notifyChange);
}

/**
 * Set waypoints programmatically (from search or GPS).
 * @param {Array<[number, number]>} coords - array of [lng, lat]
 */
export function setWaypoints(coords) {
  if (!directions) return;
  directions.setWaypoints(coords);
}

/**
 * Add a single waypoint at the end.
 * @param {number} lng
 * @param {number} lat
 */
export function addWaypoint(lng, lat) {
  if (!directions) return;
  directions.addWaypoint([lng, lat]);
}

/**
 * Remove a waypoint by index.
 * @param {number} index
 */
export function removeWaypointByIndex(index) {
  if (!directions) return;
  directions.removeWaypoint(index);
}

/**
 * Clear all waypoints and route.
 */
export function clearRoute() {
  if (!directions) return;
  directions.clear();
}

/**
 * Get current waypoint coordinates.
 * @returns {Array<[number, number]>}
 */
export function getWaypointCoords() {
  if (!directions) return [];
  return directions.waypointsCoordinates;
}

export function setInteractive(enabled) {
  if (directions) directions.interactive = enabled;
}

export function getDirections() {
  return directions;
}
