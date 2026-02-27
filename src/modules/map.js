import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { UZBEKISTAN_CENTER, UZBEKISTAN_ZOOM, UZBEKISTAN_CITIES } from './cities.js';

let map;
let currentTheme = 'dark';
let cityMarkers = [];
let gpsMarker = null;
let gpsMarkerEl = null;
let gpsArrowEl = null;
let radarMarkers = [];
let trafficRefreshTimer = null;

// ===== FOLLOW MODE =====
let followMode = 'off'; // 'off' | 'follow' | 'follow-heading'
let onFollowModeChange = null;
let ignoreNextInteraction = false;

const VECTOR_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/bright',
};

/**
 * Initialize MapLibre GL JS map with dark tiles and city markers.
 * @returns {Promise<maplibregl.Map>}
 */
export function initMap() {
  const savedTheme = localStorage.getItem('uznav-theme') || 'dark';
  currentTheme = savedTheme;

  return new Promise((resolve) => {
    map = new maplibregl.Map({
      container: 'map',
      style: VECTOR_STYLES[currentTheme],
      center: [UZBEKISTAN_CENTER[1], UZBEKISTAN_CENTER[0]],
      zoom: UZBEKISTAN_ZOOM,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Detect user interaction to disable follow mode
    map.on('dragstart', handleUserInteraction);
    map.on('wheel', handleUserInteraction);
    map.on('pitchstart', handleUserInteraction);

    map.on('load', () => {
      addCityMarkers();
      addHousenumberLayer();
      resolve(map);
    });
  });
}

function handleUserInteraction() {
  if (ignoreNextInteraction) {
    ignoreNextInteraction = false;
    return;
  }
  if (followMode !== 'off') {
    followMode = 'off';
    if (onFollowModeChange) onFollowModeChange('off');
  }
}

/**
 * Add city markers as DOM elements (HTML markers).
 */
function addCityMarkers() {
  // Remove existing markers
  cityMarkers.forEach((m) => m.remove());
  cityMarkers = [];

  UZBEKISTAN_CITIES.forEach((city) => {
    const el = document.createElement('div');
    el.className = city.capital ? 'city-marker capital' : 'city-marker';

    const dot = document.createElement('div');
    dot.className = 'city-dot';
    el.appendChild(dot);

    const label = document.createElement('div');
    label.className = 'city-label';
    label.textContent = city.name;
    el.appendChild(label);

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([city.lng, city.lat])
      .addTo(map);

    cityMarkers.push(marker);
  });
}

/**
 * Add building housenumber labels from OpenMapTiles vector data.
 */
function addHousenumberLayer() {
  if (map.getLayer('housenumber')) return;

  map.addLayer({
    id: 'housenumber',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'housenumber',
    minzoom: 17,
    layout: {
      'text-field': '{housenumber}',
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
    },
    paint: {
      'text-color': currentTheme === 'dark' ? '#aaa' : '#555',
      'text-halo-color': currentTheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
      'text-halo-width': 1,
    },
  });
}

let gpsLastPos = null;

/**
 * Create or get GPS marker DOM element.
 */
function ensureGpsMarker() {
  if (!gpsMarkerEl) {
    gpsMarkerEl = document.createElement('div');
    gpsMarkerEl.className = 'gps-marker';

    const pulse = document.createElement('div');
    pulse.className = 'gps-pulse';
    gpsMarkerEl.appendChild(pulse);

    const dot = document.createElement('div');
    dot.className = 'gps-dot';
    gpsMarkerEl.appendChild(dot);

    gpsArrowEl = document.createElement('div');
    gpsArrowEl.className = 'gps-arrow';
    gpsMarkerEl.appendChild(gpsArrowEl);
  }
  return gpsMarkerEl;
}

/**
 * Add/update GPS position marker on the map.
 */
export function setGpsMarker(lat, lng) {
  gpsLastPos = { lat, lng };

  if (gpsMarker) {
    gpsMarker.setLngLat([lng, lat]);
  } else {
    const el = ensureGpsMarker();
    gpsMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);
  }
}

/**
 * Update GPS heading arrow rotation.
 */
function setGpsHeading(heading) {
  if (!gpsArrowEl) return;
  if (heading !== null && heading !== undefined && !isNaN(heading)) {
    gpsArrowEl.style.transform = `rotate(${heading}deg)`;
    gpsArrowEl.classList.add('visible');
  } else {
    gpsArrowEl.classList.remove('visible');
  }
}

// ===== FOLLOW MODE API =====

export function setFollowMode(mode) {
  followMode = mode;
  if (mode === 'off') {
    // Reset bearing and pitch when exiting follow mode
    ignoreNextInteraction = true;
    map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }
}

export function getFollowMode() {
  return followMode;
}

export function onFollowChange(callback) {
  onFollowModeChange = callback;
}

/**
 * Update GPS position and apply follow mode camera behavior.
 */
export function updateGpsPosition(lat, lng, heading, speed) {
  setGpsMarker(lat, lng);
  setGpsHeading(heading);

  if (followMode === 'off') return;

  ignoreNextInteraction = true;

  if (followMode === 'follow') {
    map.easeTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 16),
      bearing: 0,
      pitch: 0,
      duration: 500,
    });
  } else if (followMode === 'follow-heading') {
    const bearing = (heading !== null && heading !== undefined && !isNaN(heading))
      ? heading
      : map.getBearing();
    map.easeTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 16),
      bearing,
      pitch: 50,
      duration: 500,
    });
  }
}

/**
 * Center map on current GPS position (one-shot, used when entering follow mode).
 */
export function centerOnGps() {
  if (!gpsLastPos) return;
  ignoreNextInteraction = true;
  map.easeTo({
    center: [gpsLastPos.lng, gpsLastPos.lat],
    zoom: Math.max(map.getZoom(), 16),
    duration: 800,
  });
}

/**
 * Switch map tiles between dark and light theme.
 */
export function setMapTheme(theme, onReady) {
  if (theme === currentTheme) return;
  const hadTraffic = !!map.getSource('yandex-traffic');
  currentTheme = theme;

  map.setStyle(VECTOR_STYLES[theme]);

  map.once('style.load', () => {
    addCityMarkers();
    addHousenumberLayer();
    if (hadTraffic) addTrafficLayer();
    if (onReady) onReady();
  });
}

export function flyTo(lng, lat, zoom = 12) {
  map.flyTo({ center: [lng, lat], zoom, duration: 1500 });
}

export function getMap() {
  return map;
}

// ===== TRAFFIC OVERLAY =====
// Yandex traffic tiles — only accessible from CIS region (Russia, Uzbekistan, etc.)

function trafficTileUrl() {
  return `https://core-jams-rdr.maps.yandex.net/1.1/tiles?l=trf,trfe&lang=en_US&x={x}&y={y}&z={z}&scale=1&tm=${Date.now()}`;
}

export function addTrafficLayer() {
  if (!map) return;
  if (map.getSource('yandex-traffic')) return;

  map.addSource('yandex-traffic', {
    type: 'raster',
    tiles: [trafficTileUrl()],
    tileSize: 256,
  });

  map.addLayer({
    id: 'yandex-traffic-layer',
    type: 'raster',
    source: 'yandex-traffic',
    paint: { 'raster-opacity': 0.7 },
  });

  // Auto-refresh traffic tiles every 2 minutes
  clearInterval(trafficRefreshTimer);
  trafficRefreshTimer = setInterval(() => {
    if (map.getSource('yandex-traffic')) {
      map.getSource('yandex-traffic').setTiles([trafficTileUrl()]);
    }
  }, 120000);
}

export function removeTrafficLayer() {
  if (!map) return;
  clearInterval(trafficRefreshTimer);
  trafficRefreshTimer = null;
  if (map.getLayer('yandex-traffic-layer')) map.removeLayer('yandex-traffic-layer');
  if (map.getSource('yandex-traffic')) map.removeSource('yandex-traffic');
}

// ===== RADAR MARKERS =====

export function addRadarMarkers(cameras) {
  removeRadarMarkers();

  cameras.forEach((cam) => {
    const el = document.createElement('div');
    el.className = 'radar-marker';
    el.title = cam.maxspeed ? `Speed limit: ${cam.maxspeed} km/h` : 'Speed camera';

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([cam.lng, cam.lat])
      .addTo(map);

    radarMarkers.push(marker);
  });
}

export function removeRadarMarkers() {
  radarMarkers.forEach((m) => m.remove());
  radarMarkers = [];
}
