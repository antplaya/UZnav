import './style.css';
import {
  initMap, flyTo, setGpsMarker, setMapTheme, getMap,
  addTrafficLayer, removeTrafficLayer,
  addRadarMarkers, removeRadarMarkers,
  updateGpsPosition, setFollowMode, getFollowMode, onFollowChange, centerOnGps,
} from './modules/map.js';
import { initRouting, addWaypoint, removeWaypointByIndex, clearRoute } from './modules/routing.js';
import { searchLocation, reverseGeocode } from './modules/search.js';
import { getCurrentPosition, watchPosition } from './modules/geolocation.js';
import { fetchSpeedCameras, checkCameraProximity } from './modules/radars.js';
import {
  initUI,
  setupSidebarToggle,
  setupSearch,
  showSearchResults,
  hideSearchResults,
  renderWaypoints,
  showRouteSummary,
  hideRouteSummary,
  renderDirections,
  hideDirections,
  setGpsStatus,
  showToast,
  updateSpeedDisplay,
  setLocateButtonState,
} from './modules/ui.js';

// --- State ---
let waypointNames = new Map();
let currentWaypoints = [];
let currentTheme = localStorage.getItem('uznav-theme') || 'dark';
let cameras = [];
let lastCameraAlertTime = 0;
let gpsAvailable = false;

// --- Init ---
initUI();
setupSidebarToggle();
setupSearch(handleSearch);

// Theme toggle
if (currentTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  if (currentTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('uznav-theme', currentTheme);

  setMapTheme(currentTheme, () => {
    initRouting(getMap(), {
      onRoutesFound: handleRouteFound,
      onWaypointAdd: handleWaypointAdd,
      onWaypointChange: handleWaypointChange,
    });
    // Re-add radar markers after theme change if enabled
    if (document.getElementById('radars-toggle').checked && cameras.length > 0) {
      addRadarMarkers(cameras);
    }
  });
});

// Traffic toggle
const trafficToggle = document.getElementById('traffic-toggle');
trafficToggle.checked = localStorage.getItem('uznav-traffic') === 'true';

trafficToggle.addEventListener('change', () => {
  localStorage.setItem('uznav-traffic', trafficToggle.checked);
  if (trafficToggle.checked) {
    addTrafficLayer();
  } else {
    removeTrafficLayer();
  }
});

// Radars toggle
const radarsToggle = document.getElementById('radars-toggle');
const savedRadars = localStorage.getItem('uznav-radars');
radarsToggle.checked = savedRadars === null ? true : savedRadars === 'true';

radarsToggle.addEventListener('change', () => {
  localStorage.setItem('uznav-radars', radarsToggle.checked);
  if (radarsToggle.checked && cameras.length > 0) {
    addRadarMarkers(cameras);
  } else {
    removeRadarMarkers();
  }
});

// Clear route button
document.getElementById('clear-route-btn').addEventListener('click', () => {
  clearRoute();
  waypointNames.clear();
  currentWaypoints = [];
  renderWaypoints([], () => {});
  hideRouteSummary();
  hideDirections();
});

// Locate / Follow GPS button
const locateBtn = document.getElementById('locate-btn');
locateBtn.addEventListener('click', () => {
  if (!gpsAvailable) {
    showToast('GPS not available', 'info');
    return;
  }

  const current = getFollowMode();
  if (current === 'off') {
    setFollowMode('follow');
    setLocateButtonState('follow');
    centerOnGps();
  } else if (current === 'follow') {
    setFollowMode('follow-heading');
    setLocateButtonState('follow-heading');
  } else {
    setFollowMode('off');
    setLocateButtonState('off');
  }
});

// When map interaction disables follow mode, update button
onFollowChange((mode) => {
  setLocateButtonState(mode);
});

// Init map, then routing, GPS, and layers
initMap().then((map) => {
  // Init routing
  initRouting(map, {
    onRoutesFound: handleRouteFound,
    onWaypointAdd: handleWaypointAdd,
    onWaypointChange: handleWaypointChange,
  });

  // Enable traffic if saved
  if (trafficToggle.checked) {
    addTrafficLayer();
  }

  // Load speed cameras
  loadSpeedCameras();

  // Init GPS
  initGps();
});

// --- Speed Cameras ---

async function loadSpeedCameras() {
  cameras = await fetchSpeedCameras();
  if (cameras.length > 0 && radarsToggle.checked) {
    addRadarMarkers(cameras);
  }
}

// --- Handlers ---

function coordKey(lng, lat) {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`;
}

async function handleWaypointAdd({ lng, lat }) {
  const key = coordKey(lng, lat);
  try {
    const name = await reverseGeocode(lat, lng);
    waypointNames.set(key, name);
  } catch {
    waypointNames.set(key, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  }
  refreshWaypointList();
}

async function handleSearch(query) {
  if (!query || query.trim().length < 2) {
    hideSearchResults();
    return;
  }

  try {
    const results = await searchLocation(query);
    if (results.length === 0) {
      showToast('No results found', 'info');
      return;
    }

    showSearchResults(results, (result) => {
      const key = coordKey(result.lng, result.lat);
      waypointNames.set(key, result.shortName);
      addWaypoint(result.lng, result.lat);
      flyTo(result.lng, result.lat, 12);
    });
  } catch (err) {
    showToast('Search failed. Try again.', 'error');
    console.error('Search error:', err);
  }
}

function handleRouteFound(route) {
  showRouteSummary(route.distance, route.duration);
  if (route.steps && route.steps.length > 0) {
    renderDirections(route.steps);
  }
}

function handleWaypointChange(coords) {
  currentWaypoints = coords;
  refreshWaypointList();

  if (coords.length < 2) {
    hideRouteSummary();
    hideDirections();
  }
}

function refreshWaypointList() {
  const waypoints = currentWaypoints.map((c) => {
    const key = coordKey(c[0], c[1]);
    return {
      name: waypointNames.get(key) || `${c[1].toFixed(4)}, ${c[0].toFixed(4)}`,
      coords: c,
    };
  });

  renderWaypoints(waypoints, (index) => {
    const c = currentWaypoints[index];
    if (c) {
      waypointNames.delete(coordKey(c[0], c[1]));
    }
    removeWaypointByIndex(index);
  });
}

async function initGps() {
  setGpsStatus('GPS...');

  const pos = await getCurrentPosition();
  if (pos) {
    gpsAvailable = true;
    updateGpsPosition(pos.lat, pos.lng, pos.heading, pos.speed);
    setGpsStatus('GPS active');
    document.getElementById('gps-status').classList.add('active');

    watchPosition((newPos) => {
      if (newPos) {
        // Update map marker + follow mode camera
        updateGpsPosition(newPos.lat, newPos.lng, newPos.heading, newPos.speed);

        // Update speed display (convert m/s → km/h)
        const speedKmh = (newPos.speed !== null && newPos.speed >= 0)
          ? newPos.speed * 3.6
          : null;
        updateSpeedDisplay(speedKmh);

        // Speed camera proximity alert
        if (cameras.length > 0 && radarsToggle.checked) {
          const now = Date.now();
          if (now - lastCameraAlertTime > 30000) { // max 1 alert per 30s
            const nearby = checkCameraProximity(newPos.lat, newPos.lng, cameras);
            if (nearby) {
              lastCameraAlertTime = now;
              const msg = nearby.maxspeed
                ? `Speed camera ahead! Limit: ${nearby.maxspeed} km/h`
                : 'Speed camera ahead!';
              showToast(msg, 'warning');
            }
          }
        }
      }
    });
  } else {
    setGpsStatus('No GPS');
  }
}
