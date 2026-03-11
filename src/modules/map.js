/**
 * Map module — Yandex Maps JS API v3 implementation.
 * Keeps the same exported API as the previous MapLibre version.
 */
import { UZBEKISTAN_CENTER, UZBEKISTAN_ZOOM, UZBEKISTAN_CITIES, getRegion } from './cities.js';

let map;
let schemeLayer;
let featuresLayer;
let currentTheme = 'dark';

// Markers
let cityMarkers = [];
let gpsMarker = null;
let gpsMarkerEl = null;
let gpsArrowEl = null;
let radarMarkers = [];
let poiMarkers = [];
let routeFeature = null;

// Follow mode
let followMode = 'off'; // 'off' | 'follow' | 'follow-heading'
let onFollowModeChange = null;
let ignoreNextAction = false;

// GPS state
let gpsLastPos = null;

const DEG2RAD = Math.PI / 180;

/**
 * Initialize Yandex Maps v3 map.
 * @returns {Promise<object>} map instance
 */
export async function initMap() {
  const savedTheme = localStorage.getItem('uznav-theme') || 'dark';
  currentTheme = savedTheme;

  await ymaps3.ready;

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapListener, YMapControls } = ymaps3;

  map = new YMap(document.getElementById('map'), {
    location: {
      center: [UZBEKISTAN_CENTER[1], UZBEKISTAN_CENTER[0]], // [lng, lat]
      zoom: UZBEKISTAN_ZOOM,
    },
    behaviors: ['drag', 'pinchZoom', 'scrollZoom', 'dblClick', 'pinchRotate', 'mouseRotate', 'mouseTilt'],
  });

  // Base tile layer
  schemeLayer = new YMapDefaultSchemeLayer({ theme: currentTheme });
  map.addChild(schemeLayer);

  // Features layer (markers + route lines)
  featuresLayer = new YMapDefaultFeaturesLayer();
  map.addChild(featuresLayer);

  // Detect user interaction to disable follow mode
  const listener = new YMapListener({
    layer: 'any',
    onActionStart: ({ type }) => {
      if (ignoreNextAction) {
        ignoreNextAction = false;
        return;
      }
      // Only user-initiated drag/zoom/rotate disables follow
      if (['drag', 'scrollZoom', 'pinchZoom', 'mouseRotate', 'mouseTilt', 'pinchRotate'].includes(type)) {
        if (followMode !== 'off') {
          followMode = 'off';
          if (onFollowModeChange) onFollowModeChange('off');
        }
      }
    },
  });
  map.addChild(listener);

  addCityMarkers();

  return map;
}

// ===== CITY MARKERS =====

let currentRegionKey = 'uz';

export function setMapRegion(regionKey) {
  currentRegionKey = regionKey;
  addCityMarkers();
}

function addCityMarkers() {
  cityMarkers.forEach((m) => map.removeChild(m));
  cityMarkers = [];

  const { YMapMarker } = ymaps3;
  const region = getRegion(currentRegionKey);

  region.cities.forEach((city) => {
    const el = document.createElement('div');
    el.className = city.capital ? 'city-marker capital' : 'city-marker';

    const dot = document.createElement('div');
    dot.className = 'city-dot';
    el.appendChild(dot);

    const label = document.createElement('div');
    label.className = 'city-label';
    label.textContent = city.name;
    el.appendChild(label);

    const marker = new YMapMarker({ coordinates: [city.lng, city.lat] }, el);
    map.addChild(marker);
    cityMarkers.push(marker);
  });
}

// ===== GPS MARKER =====

function ensureGpsMarker() {
  if (!gpsMarkerEl) {
    gpsMarkerEl = document.createElement('div');
    gpsMarkerEl.className = 'gps-marker';

    const pulse = document.createElement('div');
    pulse.className = 'gps-pulse';
    gpsMarkerEl.appendChild(pulse);

    gpsArrowEl = document.createElement('div');
    gpsArrowEl.className = 'gps-car';
    gpsArrowEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 100" width="36" height="56">
      <ellipse cx="32" cy="95" rx="18" ry="4" fill="rgba(0,0,0,0.25)"/>
      <path d="M14 68 L14 52 Q14 30 20 22 L24 14 Q26 8 32 8 Q38 8 40 14 L44 22 Q50 30 50 52 L50 68 Q50 74 44 76 L20 76 Q14 74 14 68Z" fill="#e8e8e8" stroke="#bbb" stroke-width="1"/>
      <path d="M22 42 Q22 24 32 20 Q42 24 42 42Z" fill="#c8c8c8" stroke="#aaa" stroke-width="0.5"/>
      <path d="M23 42 Q23 28 32 24 Q41 28 41 42Z" fill="#90c8f0" opacity="0.85"/>
      <path d="M20 52 L22 42 L42 42 L44 52Z" fill="#90c8f0" opacity="0.7"/>
      <rect x="22" y="72" width="20" height="4" rx="2" fill="#ccc"/>
      <rect x="17" y="70" width="8" height="3" rx="1.5" fill="#fff" opacity="0.9"/>
      <rect x="39" y="70" width="8" height="3" rx="1.5" fill="#fff" opacity="0.9"/>
      <rect x="16" y="54" width="6" height="3" rx="1.5" fill="#ff4444" opacity="0.9"/>
      <rect x="42" y="54" width="6" height="3" rx="1.5" fill="#ff4444" opacity="0.9"/>
      <ellipse cx="18" cy="62" rx="5" ry="7" fill="#444" stroke="#666" stroke-width="1"/>
      <ellipse cx="46" cy="62" rx="5" ry="7" fill="#444" stroke="#666" stroke-width="1"/>
      <ellipse cx="18" cy="62" rx="2.5" ry="3.5" fill="#888"/>
      <ellipse cx="46" cy="62" rx="2.5" ry="3.5" fill="#888"/>
      <rect x="29" y="16" width="6" height="1.5" rx="0.5" fill="#cc0000"/>
      <rect x="31.5" y="16" width="1" height="4" rx="0.5" fill="#cc0000"/>
    </svg>`;
    gpsMarkerEl.appendChild(gpsArrowEl);
  }
  return gpsMarkerEl;
}

export function setGpsMarker(lat, lng) {
  const { YMapMarker } = ymaps3;

  if (gpsMarker) {
    gpsMarker.update({ coordinates: [lng, lat] });
  } else {
    const el = ensureGpsMarker();
    gpsMarker = new YMapMarker({ coordinates: [lng, lat] }, el);
    map.addChild(gpsMarker);
  }
}

function setGpsHeading(heading) {
  if (!gpsArrowEl) return;
  if (heading !== null && heading !== undefined && !isNaN(heading)) {
    gpsArrowEl.style.transform = `rotate(${heading}deg)`;
  }
}

// ===== FOLLOW MODE =====

export function setFollowMode(mode) {
  followMode = mode;
  if (mode === 'off') {
    ignoreNextAction = true;
    map.setCamera({ azimuth: 0, tilt: 0, duration: 500 });
  }
}

export function getFollowMode() {
  return followMode;
}

export function onFollowChange(callback) {
  onFollowModeChange = callback;
}

export function updateGpsPosition(lat, lng, heading, speed, snappedLat, snappedLng) {
  const dLat = snappedLat ?? lat;
  const dLng = snappedLng ?? lng;

  gpsLastPos = { lat: dLat, lng: dLng };
  setGpsMarker(dLat, dLng);
  setGpsHeading(heading);

  if (followMode === 'off') return;

  ignoreNextAction = true;

  if (followMode === 'follow') {
    map.setLocation({
      center: [dLng, dLat],
      zoom: Math.max(map.zoom, 16),
      duration: 500,
    });
    map.setCamera({ azimuth: 0, tilt: 0, duration: 500 });
  } else if (followMode === 'follow-heading') {
    const azimuth = (heading !== null && heading !== undefined && !isNaN(heading))
      ? heading * DEG2RAD
      : map.azimuth;

    // Offset center south by ~35% of viewport to show more road ahead
    const offsetLat = 0.0015 * Math.cos(azimuth);
    const offsetLng = 0.0015 * Math.sin(azimuth);

    map.setLocation({
      center: [dLng - offsetLng, dLat - offsetLat],
      zoom: Math.max(map.zoom, 17),
      duration: 500,
    });
    map.setCamera({
      azimuth: -azimuth, // Yandex azimuth: negative = clockwise rotation
      tilt: 50 * DEG2RAD,
      duration: 500,
    });
  }
}

// ===== LONG PRESS =====

export function setupLongPress(callback) {
  const { YMapListener } = ymaps3;
  let longPressTimer = null;
  let startCoords = null;
  let startScreen = null;

  const lpListener = new YMapListener({
    layer: 'any',
    onPointerDown: (object, event) => {
      startCoords = event.coordinates;
      startScreen = event.screenCoordinates;
      longPressTimer = setTimeout(() => {
        if (startCoords) {
          callback({ lng: startCoords[0], lat: startCoords[1] });
        }
        longPressTimer = null;
      }, 500);
    },
    onPointerMove: (object, event) => {
      if (longPressTimer && startScreen) {
        const dx = event.screenCoordinates[0] - startScreen[0];
        const dy = event.screenCoordinates[1] - startScreen[1];
        if (Math.hypot(dx, dy) > 10) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    },
    onPointerUp: () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    },
  });

  map.addChild(lpListener);

  // Prevent context menu on mobile
  document.getElementById('map').addEventListener('contextmenu', (e) => e.preventDefault());
}

// ===== CAMERA =====

export function centerOnGps() {
  if (!gpsLastPos) return;
  ignoreNextAction = true;
  map.setLocation({
    center: [gpsLastPos.lng, gpsLastPos.lat],
    zoom: Math.max(map.zoom, 17),
    duration: 800,
  });
}

export function setMapTheme(theme, onReady) {
  if (theme === currentTheme) return;
  currentTheme = theme;
  if (schemeLayer) {
    schemeLayer.update({ theme });
  }
  if (onReady) onReady();
}

export function flyTo(lng, lat, zoom = 12) {
  map.setLocation({ center: [lng, lat], zoom, duration: 1500 });
}

export function getMap() {
  return map;
}

export function getGpsPosition() {
  return gpsLastPos;
}

// ===== TRAFFIC OVERLAY =====
// Yandex v3 may support built-in traffic — for now, skip the raster tile approach.
// The traffic toggle will be a no-op until we find the v3 traffic API.

let trafficEnabled = false;

export function addTrafficLayer() {
  trafficEnabled = true;
  // TODO: Integrate Yandex v3 traffic layer when API is available
  console.log('[map] Traffic layer requested (not yet implemented for Yandex v3)');
}

export function removeTrafficLayer() {
  trafficEnabled = false;
}

// ===== RADAR MARKERS =====

export function addRadarMarkers(cameras) {
  removeRadarMarkers();
  const { YMapMarker } = ymaps3;

  cameras.forEach((cam) => {
    const el = document.createElement('div');
    el.className = 'radar-marker';
    el.title = cam.maxspeed ? `Speed limit: ${cam.maxspeed} km/h` : 'Speed camera';

    const marker = new YMapMarker({ coordinates: [cam.lng, cam.lat] }, el);
    map.addChild(marker);
    radarMarkers.push(marker);
  });
}

export function removeRadarMarkers() {
  radarMarkers.forEach((m) => { try { map.removeChild(m); } catch {} });
  radarMarkers = [];
}

// ===== POI MARKERS =====

export function addPoiMarkers(pois, onSelect) {
  removePoiMarkers();
  const { YMapMarker } = ymaps3;

  pois.forEach((poi) => {
    const el = document.createElement('div');
    el.className = `poi-marker poi-${poi.category}`;
    el.textContent = poi.icon;
    el.title = poi.name;
    if (onSelect) {
      el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(poi); });
    }

    const marker = new YMapMarker({ coordinates: [poi.lng, poi.lat] }, el);
    map.addChild(marker);
    poiMarkers.push(marker);
  });
}

export function removePoiMarkers() {
  poiMarkers.forEach((m) => { try { map.removeChild(m); } catch {} });
  poiMarkers = [];
}

// ===== ROUTE LINE =====

export function drawRoute(geometry) {
  clearRouteLines();
  if (!geometry || !geometry.coordinates) return;

  const { YMapFeature } = ymaps3;

  routeFeature = new YMapFeature({
    geometry: {
      type: 'LineString',
      coordinates: geometry.coordinates,
    },
    style: {
      stroke: [{ color: '#006efc', width: 6, opacity: 0.85 }],
    },
  });
  map.addChild(routeFeature);
}

export function clearRouteLines() {
  if (routeFeature) {
    try { map.removeChild(routeFeature); } catch {}
    routeFeature = null;
  }
}
