import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { UZBEKISTAN_CENTER, UZBEKISTAN_ZOOM, UZBEKISTAN_CITIES, getRegion } from './cities.js';

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

function makeYandexStyle(theme) {
  const isDark = theme === 'dark';
  return {
    version: 8,
    sources: {
      'yandex-map': {
        type: 'raster',
        tiles: ['https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ru_RU'],
        tileSize: 256,
        attribution: '© <a href="https://yandex.com/maps/" target="_blank">Yandex Maps</a>',
        maxzoom: 19,
      },
    },
    layers: [{
      id: 'yandex-map-layer',
      type: 'raster',
      source: 'yandex-map',
      paint: isDark ? {
        'raster-brightness-max': 0.6,
        'raster-saturation': -0.4,
        'raster-contrast': 0.1,
      } : {},
    }],
  };
}

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
      style: makeYandexStyle(currentTheme),
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

let currentRegionKey = 'uz';

/**
 * Switch to a different region — update city markers and fly to region center.
 */
export function setMapRegion(regionKey) {
  currentRegionKey = regionKey;
  addCityMarkers();
}

/**
 * Add city markers as DOM elements (HTML markers).
 */
function addCityMarkers() {
  // Remove existing markers
  cityMarkers.forEach((m) => m.remove());
  cityMarkers = [];

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

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([city.lng, city.lat])
      .addTo(map);

    cityMarkers.push(marker);
  });
}

/**
 * Add building housenumber labels from VersaTiles (Shortbread schema "addresses" layer).
 * OpenFreeMap tiles don't include housenumber data, so we overlay VersaTiles as a second source.
 */
function addHousenumberLayer() {
  if (map.getLayer('housenumber')) return;

  if (!map.getSource('versatiles')) {
    map.addSource('versatiles', {
      type: 'vector',
      tiles: ['https://tiles.versatiles.org/tiles/osm/{z}/{x}/{y}'],
      maxzoom: 14,
    });
  }

  map.addLayer({
    id: 'housenumber',
    type: 'symbol',
    source: 'versatiles',
    'source-layer': 'addresses',
    minzoom: 17,
    layout: {
      'text-field': '{housenumber}',
      'text-font': ['Noto Sans Regular'],
      'text-size': 13,
    },
    paint: {
      'text-color': currentTheme === 'dark' ? '#aaa' : '#555',
      'text-halo-color': currentTheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
      'text-halo-width': 1.5,
    },
  });
}

let gpsLastPos = null;

/**
 * Create or get GPS marker DOM element (Tesla car icon).
 */
function ensureGpsMarker() {
  if (!gpsMarkerEl) {
    gpsMarkerEl = document.createElement('div');
    gpsMarkerEl.className = 'gps-marker';

    const pulse = document.createElement('div');
    pulse.className = 'gps-pulse';
    gpsMarkerEl.appendChild(pulse);

    // Tesla car SVG — the whole element rotates with heading
    gpsArrowEl = document.createElement('div');
    gpsArrowEl.className = 'gps-car';
    gpsArrowEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 100" width="36" height="56">
      <!-- Shadow -->
      <ellipse cx="32" cy="95" rx="18" ry="4" fill="rgba(0,0,0,0.25)"/>
      <!-- Body -->
      <path d="M14 68 L14 52 Q14 30 20 22 L24 14 Q26 8 32 8 Q38 8 40 14 L44 22 Q50 30 50 52 L50 68 Q50 74 44 76 L20 76 Q14 74 14 68Z" fill="#e8e8e8" stroke="#bbb" stroke-width="1"/>
      <!-- Roof -->
      <path d="M22 42 Q22 24 32 20 Q42 24 42 42Z" fill="#c8c8c8" stroke="#aaa" stroke-width="0.5"/>
      <!-- Windshield -->
      <path d="M23 42 Q23 28 32 24 Q41 28 41 42Z" fill="#90c8f0" opacity="0.85"/>
      <!-- Rear window -->
      <path d="M20 52 L22 42 L42 42 L44 52Z" fill="#90c8f0" opacity="0.7"/>
      <!-- Front grille / bumper -->
      <rect x="22" y="72" width="20" height="4" rx="2" fill="#ccc"/>
      <!-- Headlights -->
      <rect x="17" y="70" width="8" height="3" rx="1.5" fill="#fff" opacity="0.9"/>
      <rect x="39" y="70" width="8" height="3" rx="1.5" fill="#fff" opacity="0.9"/>
      <!-- Taillights -->
      <rect x="16" y="54" width="6" height="3" rx="1.5" fill="#ff4444" opacity="0.9"/>
      <rect x="42" y="54" width="6" height="3" rx="1.5" fill="#ff4444" opacity="0.9"/>
      <!-- Wheels -->
      <ellipse cx="18" cy="62" rx="5" ry="7" fill="#444" stroke="#666" stroke-width="1"/>
      <ellipse cx="46" cy="62" rx="5" ry="7" fill="#444" stroke="#666" stroke-width="1"/>
      <ellipse cx="18" cy="62" rx="2.5" ry="3.5" fill="#888"/>
      <ellipse cx="46" cy="62" rx="2.5" ry="3.5" fill="#888"/>
      <!-- Tesla T logo -->
      <rect x="29" y="16" width="6" height="1.5" rx="0.5" fill="#cc0000"/>
      <rect x="31.5" y="16" width="1" height="4" rx="0.5" fill="#cc0000"/>
    </svg>`;
    gpsMarkerEl.appendChild(gpsArrowEl);
  }
  return gpsMarkerEl;
}

/**
 * Add/update GPS position marker on the map.
 */
export function setGpsMarker(lat, lng) {

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
 * Accepts optional snapped coordinates for road-snapped display.
 */
export function updateGpsPosition(lat, lng, heading, speed, snappedLat, snappedLng) {
  const dLat = snappedLat ?? lat;
  const dLng = snappedLng ?? lng;

  gpsLastPos = { lat: dLat, lng: dLng };
  setGpsMarker(dLat, dLng);
  setGpsHeading(heading);

  if (followMode === 'off') return;

  ignoreNextInteraction = true;

  if (followMode === 'follow') {
    map.easeTo({
      center: [dLng, dLat],
      zoom: Math.max(map.getZoom(), 16),
      bearing: 0,
      pitch: 0,
      duration: 500,
    });
  } else if (followMode === 'follow-heading') {
    const bearing = (heading !== null && heading !== undefined && !isNaN(heading))
      ? heading
      : map.getBearing();
    // Offset GPS dot to lower third of screen so more road ahead is visible (like Waze)
    const screenH = map.getContainer().clientHeight;
    map.easeTo({
      center: [dLng, dLat],
      zoom: Math.max(map.getZoom(), 17),
      bearing,
      pitch: 50,
      padding: { top: Math.round(screenH * 0.35), bottom: 0 },
      duration: 500,
    });
  }
}

/**
 * Set up long-press handler on the map canvas.
 * Fires callback after 500ms hold without significant movement.
 */
export function setupLongPress(callback) {
  const canvas = map.getCanvas();

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const startX = e.clientX;
    const startY = e.clientY;

    const timer = setTimeout(() => {
      const ll = map.unproject([x, y]);
      callback({ lng: ll.lng, lat: ll.lat });
    }, 500);

    const cancel = () => {
      clearTimeout(timer);
      canvas.removeEventListener('pointermove', move);
    };

    const move = (me) => {
      if (Math.hypot(me.clientX - startX, me.clientY - startY) > 10) cancel();
    };

    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', cancel, { once: true });
    canvas.addEventListener('pointercancel', cancel, { once: true });
  });

  // Prevent browser context menu on mobile long-press
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Center map on current GPS position (one-shot, used when entering follow mode).
 */
export function centerOnGps() {
  if (!gpsLastPos) return;
  ignoreNextInteraction = true;
  map.easeTo({
    center: [gpsLastPos.lng, gpsLastPos.lat],
    zoom: Math.max(map.getZoom(), 17),
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

  map.setStyle(makeYandexStyle(theme));

  map.once('style.load', () => {
    addCityMarkers();
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

export function getGpsPosition() {
  return gpsLastPos;
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

// ===== POI MARKERS =====

let poiMarkers = [];

export function addPoiMarkers(pois, onSelect) {
  removePoiMarkers();
  pois.forEach((poi) => {
    const el = document.createElement('div');
    el.className = `poi-marker poi-${poi.category}`;
    el.textContent = poi.icon;
    el.title = poi.name;
    if (onSelect) {
      el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(poi); });
    }
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([poi.lng, poi.lat])
      .addTo(map);
    poiMarkers.push(marker);
  });
}

export function removePoiMarkers() {
  poiMarkers.forEach((m) => m.remove());
  poiMarkers = [];
}
