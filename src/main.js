import './style.css';
import { t, getLang, cycleLang, applyTranslations } from './modules/i18n.js';
import {
  initMap, flyTo, setGpsMarker, setMapTheme, getMap, getGpsPosition,
  addTrafficLayer, removeTrafficLayer,
  addRadarMarkers, removeRadarMarkers,
  addPoiMarkers, removePoiMarkers,
  updateGpsPosition, setFollowMode, getFollowMode, onFollowChange, centerOnGps,
  setMapRegion, setupLongPress,
} from './modules/map.js';
import { initRouting, addWaypoint, setWaypoints, removeWaypointByIndex, clearRoute, setInteractive, getWaypointCoords, getDirections } from './modules/routing.js';
import { searchLocation, reverseGeocode, setSearchRegion } from './modules/search.js';
import { detectRegion } from './modules/cities.js';
import { getCurrentPosition, watchPosition } from './modules/geolocation.js';
import { fetchSpeedCameras, checkCameraProximity } from './modules/radars.js';
import { searchPOI } from './modules/poi.js';
import { snapToRoad } from './modules/snap.js';
import { installOrsProxy } from './modules/ors-proxy.js';
import { startNavigation, updatePosition as navUpdatePosition, stopNavigation, isActive as isNavActive, isOffRoute } from './modules/navigation.js';
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
  showNavHud,
  hideNavHud,
  updateNavHud,
  showPlaceCard,
  hidePlaceCard,
  showRouteAlternatives,
  clearRouteAlternatives,
} from './modules/ui.js';

// --- State ---
let waypointNames = new Map();
let currentWaypoints = [];
let currentTheme = localStorage.getItem('uznav-theme') || 'dark';
let cameras = [];
let lastCameraAlertTime = 0;
let gpsAvailable = false;
let lastRoute = null;
let allRoutes = [];
let selectedRouteIndex = 0;
let lastSpeedKmh = 0;
let rerouteTimer = null;

// --- Init ---
initUI();
applyTranslations();
setupSidebarToggle();
setupSearch(handleSearch, handleAutocomplete);

// Language toggle — cycles EN → RU → UZ → EN
const langToggleBtn = document.getElementById('lang-toggle');
langToggleBtn.textContent = getLang().toUpperCase();
langToggleBtn.addEventListener('click', () => {
  const next = cycleLang();
  langToggleBtn.textContent = next.toUpperCase();
});

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
      onRoutesStart: showCalculating,
      onWaypointAdd: handleWaypointAdd,
      onWaypointChange: handleWaypointChange,
    }, getRoutingOptions());
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

// Routing options (avoid highways / tolls / ferries)
function showCalculating() {
  document.getElementById('route-calculating').classList.remove('hidden');
}
function hideCalculating() {
  document.getElementById('route-calculating').classList.add('hidden');
}

function getRoutingOptions() {
  return {
    avoidHighways: document.getElementById('avoid-highways-toggle').checked,
    avoidTolls:    document.getElementById('avoid-tolls-toggle').checked,
    avoidFerries:  document.getElementById('avoid-ferries-toggle').checked,
  };
}

function reinitRouting() {
  const coords = getWaypointCoords();
  initRouting(getMap(), {
    onRoutesFound: handleRouteFound,
    onWaypointAdd: handleWaypointAdd,
    onWaypointChange: handleWaypointChange,
  }, getRoutingOptions());
  if (coords.length >= 2) setWaypoints(coords);
}

const avoidHighwaysToggle = document.getElementById('avoid-highways-toggle');
const avoidTollsToggle    = document.getElementById('avoid-tolls-toggle');
const avoidFerriesToggle  = document.getElementById('avoid-ferries-toggle');

avoidHighwaysToggle.checked = localStorage.getItem('uznav-avoid-highways') === 'true';
avoidTollsToggle.checked    = localStorage.getItem('uznav-avoid-tolls')    === 'true';
avoidFerriesToggle.checked  = localStorage.getItem('uznav-avoid-ferries')  === 'true';

[
  [avoidHighwaysToggle, 'uznav-avoid-highways'],
  [avoidTollsToggle,    'uznav-avoid-tolls'],
  [avoidFerriesToggle,  'uznav-avoid-ferries'],
].forEach(([el, key]) => {
  el.addEventListener('change', () => {
    localStorage.setItem(key, el.checked);
    reinitRouting();
  });
});

// Clear route button
document.getElementById('clear-route-btn').addEventListener('click', () => {
  if (isNavActive()) exitNavigation();
  clearRoute();
  waypointNames.clear();
  currentWaypoints = [];
  lastRoute = null;
  allRoutes = [];
  selectedRouteIndex = 0;
  hideCalculating();
  clearRouteAlternatives();
  renderWaypoints([], () => {});
  hideRouteSummary();
  hideDirections();
});

// Locate / Follow GPS button
const locateBtn = document.getElementById('locate-btn');
locateBtn.addEventListener('click', () => {
  if (!gpsAvailable) {
    showToast(t('gpsUnavailable'), 'info');
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

// --- Navigation ---

// Start navigation button
document.getElementById('start-nav-btn').addEventListener('click', () => {
  if (!lastRoute) {
    showToast(t('buildRouteFirst'), 'info');
    return;
  }
  if (!gpsAvailable) {
    showToast(t('gpsUnavailable'), 'info');
    return;
  }

  startNavigation(lastRoute);

  // Enter driving mode
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  sidebar.classList.add('collapsed');
  sidebarToggle.classList.add('collapsed');

  setInteractive(false);
  setFollowMode('follow-heading');
  setLocateButtonState('follow-heading');
  showNavHud();

  // Immediately populate HUD — don't wait for next GPS tick
  const gps = getGpsPosition();
  if (gps) syncNavHud(gps.lat, gps.lng);
});

// Edit route button (toggle map tap to add waypoints during nav)
const navEditBtn = document.getElementById('nav-edit-btn');
navEditBtn.addEventListener('click', () => {
  const isEditing = navEditBtn.classList.toggle('active');
  setInteractive(isEditing);
  showToast(isEditing ? t('addStopsMode') : t('editModeOff'), 'info');
});

// Exit navigation button
document.getElementById('nav-exit-btn').addEventListener('click', () => {
  exitNavigation();
});

function exitNavigation() {
  stopNavigation();
  clearTimeout(rerouteTimer);
  rerouteTimer = null;
  hideNavHud();
  setInteractive(true);
  navEditBtn.classList.remove('active');
  setFollowMode('off');
  setLocateButtonState('off');

  // Show sidebar
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  sidebar.classList.remove('collapsed');
  sidebarToggle.classList.remove('collapsed');

  // Re-show standalone speed display if GPS active
  const sd = document.getElementById('speed-display');
  if (sd && gpsAvailable) sd.classList.remove('hidden');
}

/**
 * Find nearest speed camera within radius and return its maxspeed as a number.
 */
function findNearbySpeedLimit(lat, lng) {
  if (cameras.length === 0 || !radarsToggle.checked) return null;
  const nearby = checkCameraProximity(lat, lng, cameras, 500);
  if (!nearby || !nearby.maxspeed) return null;
  const limit = parseInt(nearby.maxspeed, 10);
  return isNaN(limit) ? null : limit;
}

// Install ORS proxy (no-op if API key not set)
installOrsProxy();

// Init map, then routing, GPS, and layers
initMap().then((map) => {
  // Init routing
  initRouting(map, {
    onRoutesFound: handleRouteFound,
    onWaypointAdd: handleWaypointAdd,
    onWaypointChange: handleWaypointChange,
  }, getRoutingOptions());

  // Long-press to add waypoints — show place card immediately, geocode in background
  setupLongPress(({ lng, lat }) => {
    let name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    showPlaceCard({
      name,
      icon: '📍',
      routeLabel: isNavActive() ? t('addStop') : t('routeHere'),
      onRoute: () => {
        if (isNavActive()) {
          addWaypoint(lng, lat);
          showToast(t('stopAdded'), 'success');
        } else {
          routeToDestination({ lng, lat, shortName: name });
        }
      },
    });
    // Update name once reverse geocode finishes (non-blocking)
    reverseGeocode(lat, lng).then((resolved) => {
      name = resolved;
      document.getElementById('place-card-name').textContent = resolved;
    }).catch(() => {});
  });

  // POI category chips
  let activePoi = null;
  document.querySelectorAll('.poi-chip').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const category = btn.dataset.poi;

      if (activePoi === category) {
        removePoiMarkers();
        hideSearchResults();
        btn.classList.remove('active');
        activePoi = null;
        return;
      }

      document.querySelectorAll('.poi-chip').forEach((b) => b.classList.remove('active'));
      removePoiMarkers();
      activePoi = category;
      btn.classList.add('active');

      const gps = getGpsPosition();
      const center = gps || { lat: map.getCenter().lat, lng: map.getCenter().lng };

      showToast(t('searchingNearby'), 'info');
      const pois = await searchPOI(category, center.lat, center.lng, 3000);

      if (pois.length === 0) {
        showToast(t('noneFoundNearby'), 'info');
        btn.classList.remove('active');
        activePoi = null;
        return;
      }

      addPoiMarkers(pois, (poi) => {
        showPlaceCard({
          name: poi.name,
          sub: poi.category,
          icon: poi.icon,
          routeLabel: isNavActive() ? t('addStop') : t('routeHere'),
          onRoute: () => routeToDestination(poi),
        });
      });
      showSearchResults(pois, routeToDestination);
    });
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

function routeToDestination(result) {
  const gps = getGpsPosition();
  const destKey = coordKey(result.lng, result.lat);
  waypointNames.set(destKey, result.shortName);

  if (gps) {
    // Clear any existing route and build fresh GPS → destination
    clearRoute();
    waypointNames.clear();
    currentWaypoints = [];
    lastRoute = null;
    hideRouteSummary();
    hideDirections();

    waypointNames.set(destKey, result.shortName);
    const originKey = coordKey(gps.lng, gps.lat);
    reverseGeocode(gps.lat, gps.lng).then((name) => {
      waypointNames.set(originKey, name);
      refreshWaypointList();
    }).catch(() => {
      waypointNames.set(originKey, 'My location');
      refreshWaypointList();
    });
    setWaypoints([[gps.lng, gps.lat], [result.lng, result.lat]]);
  } else {
    addWaypoint(result.lng, result.lat);
  }
  flyTo(result.lng, result.lat, 14);
}

async function handleAutocomplete(query) {
  try {
    const results = await searchLocation(query);
    if (results.length === 0) {
      hideSearchResults();
      return;
    }
    showSearchResults(results, routeToDestination);
  } catch {
    // Silently ignore autocomplete errors
  }
}

async function handleSearch(query) {
  if (!query || query.trim().length < 2) {
    hideSearchResults();
    return;
  }

  try {
    const results = await searchLocation(query);
    if (results.length === 0) {
      showToast(t('noResults'), 'info');
      return;
    }

    showSearchResults(results, routeToDestination);
  } catch (err) {
    showToast(t('searchFailed'), 'error');
    console.error('Search error:', err);
  }
}

function handleRouteFound(routes) {
  hideCalculating();
  if (!routes) {
    showToast(t('searchFailed'), 'error');
    return;
  }
  allRoutes = routes;
  selectedRouteIndex = 0;
  lastRoute = routes[0];

  showRouteSummary(lastRoute.distance, lastRoute.duration);
  showRouteAlternatives(routes, 0, handleRouteSelect);
  if (lastRoute.steps?.length > 0) renderDirections(lastRoute.steps);

  if (isNavActive()) {
    // Re-arm navigation with the new (rerouted) route — always use fastest
    startNavigation(lastRoute);
  } else {
    // Auto-open sidebar so user can see route summary and Start button
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
      document.getElementById('sidebar-toggle').classList.remove('collapsed');
    }
  }
}

function handleRouteSelect(index) {
  selectedRouteIndex = index;
  lastRoute = allRoutes[index];

  // Tell the directions plugin which alternative to highlight on the map
  const dir = getDirections();
  if (dir && typeof dir.selectedRouteIndex !== 'undefined') {
    dir.selectedRouteIndex = index;
  }

  showRouteSummary(lastRoute.distance, lastRoute.duration);
  showRouteAlternatives(allRoutes, index, handleRouteSelect);
  if (lastRoute.steps?.length > 0) renderDirections(lastRoute.steps);
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

/**
 * Populate the navigation HUD from current GPS position.
 * Called on nav start AND on every GPS update while navigating.
 */
function syncNavHud(lat, lng) {
  const navState = navUpdatePosition(lat, lng);
  if (!navState) return;

  const speedLimit = findNearbySpeedLimit(lat, lng);
  const step = navState.nextStep || navState.currentStep;
  const maneuver = step?.maneuver || {};
  const instruction = step?.name
    ? `${formatManeuverShort(maneuver)} on ${step.name}`
    : formatManeuverShort(maneuver);

  updateNavHud({
    distanceToTurn: navState.distanceToNextManeuver,
    instruction,
    maneuverType: maneuver.type,
    maneuverModifier: maneuver.modifier,
    eta: navState.eta,
    remaining: navState.remainingDistance,
    speed: lastSpeedKmh,
    speedLimit: speedLimit || null,
  });

  if (navState.arrived) {
    showToast(t('arrived'), 'success');
    exitNavigation();
  }
}

function localizeModifier(mod) {
  const map = {
    'left': t('modLeft'), 'right': t('modRight'),
    'slight left': t('modSlightLeft'), 'slight right': t('modSlightRight'),
    'sharp left': t('modSharpLeft'), 'sharp right': t('modSharpRight'),
    'straight': t('modStraight'), 'uturn': t('modUturn'), 'u-turn': t('modUturn'),
  };
  return map[mod?.toLowerCase()] ?? mod ?? '';
}

function formatManeuverShort(maneuver) {
  const type = maneuver?.type || '';
  const mod = localizeModifier(maneuver?.modifier);
  const types = {
    depart: t('manDepart'),
    arrive: t('manArrive'),
    turn: `${t('manTurn')} ${mod}`.trim(),
    'new name': t('manContinue'),
    merge: `${t('manMerge')} ${mod}`.trim(),
    'on ramp': `${t('manRamp')} ${mod}`.trim(),
    'off ramp': `${t('manExit')} ${mod}`.trim(),
    fork: `${t('manFork')} ${mod}`.trim(),
    'end of road': `${t('manTurn')} ${mod}`.trim(),
    continue: t('manContinue'),
    roundabout: t('manRoundabout'),
    rotary: t('manRotary'),
  };
  return types[type] || t('manContinue');
}

async function initGps() {
  setGpsStatus(t('gpsSearching'));

  const pos = await getCurrentPosition();
  if (pos) {
    gpsAvailable = true;

    // Auto-detect region from GPS location
    const region = detectRegion(pos.lat, pos.lng);
    setMapRegion(region);
    setSearchRegion(region);
    flyTo(pos.lng, pos.lat, 12);

    updateGpsPosition(pos.lat, pos.lng, pos.heading, pos.speed);
    setGpsStatus(t('gpsActive'));
    document.getElementById('gps-status').classList.add('active');

    watchPosition(async (newPos) => {
      if (newPos) {
        // Snap GPS to nearest road, fall back to raw position
        const snapped = await snapToRoad(newPos.lng, newPos.lat, newPos.speed ?? 0);
        // Update map marker + follow mode camera (snapped position if available)
        updateGpsPosition(newPos.lat, newPos.lng, newPos.heading, newPos.speed, snapped?.lat, snapped?.lng);

        // Update speed display (convert m/s → km/h)
        const speedKmh = (newPos.speed !== null && newPos.speed >= 0)
          ? newPos.speed * 3.6
          : null;
        lastSpeedKmh = speedKmh || 0;

        // Navigation HUD update
        if (isNavActive()) {
          syncNavHud(newPos.lat, newPos.lng);

          // Auto-reroute if off route — longer delay reduces false triggers at high speed
          if (isOffRoute(newPos.lat, newPos.lng)) {
            if (!rerouteTimer) {
              rerouteTimer = setTimeout(() => {
                rerouteTimer = null;
                if (!isNavActive()) return;
                const dest = currentWaypoints[currentWaypoints.length - 1];
                if (!dest) return;
                showToast(t('recalculating'), 'info');
                setWaypoints([[newPos.lng, newPos.lat], dest]);
              }, 6000);
            }
          } else {
            clearTimeout(rerouteTimer);
            rerouteTimer = null;
          }
        } else {
          clearTimeout(rerouteTimer);
          rerouteTimer = null;
          updateSpeedDisplay(speedKmh);
        }

        // Speed camera proximity alert
        if (cameras.length > 0 && radarsToggle.checked) {
          const now = Date.now();
          if (now - lastCameraAlertTime > 30000) { // max 1 alert per 30s
            const nearby = checkCameraProximity(newPos.lat, newPos.lng, cameras);
            if (nearby) {
              lastCameraAlertTime = now;
              const msg = nearby.maxspeed
                ? `${t('cameraAhead')} ${nearby.maxspeed} ${t('kmhUnit')}`
                : t('cameraAhead');
              showToast(msg, 'warning');
            }
          }
        }
      }
    });
  } else {
    setGpsStatus(t('gpsNone'));
  }
}
