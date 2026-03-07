import { formatDistance, formatTime } from './utils.js';

let els = {};

export function initUI() {
  els = {
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    searchResults: document.getElementById('search-results'),
    waypointsList: document.getElementById('waypoints-list'),
    clearRouteBtn: document.getElementById('clear-route-btn'),
    routeSummary: document.getElementById('route-summary'),
    totalDistance: document.getElementById('total-distance'),
    totalTime: document.getElementById('total-time'),
    directionsContainer: document.getElementById('directions-container'),
    directionsList: document.getElementById('directions-list'),
    gpsBtn: document.getElementById('gps-btn'),
    gpsStatus: document.getElementById('gps-status'),
  };
}

export function setupSidebarToggle() {
  els.sidebarToggle.addEventListener('click', () => {
    els.sidebar.classList.toggle('collapsed');
    els.sidebarToggle.classList.toggle('collapsed');
  });
}

export function setupSearch(onSearch, onAutocomplete) {
  let debounceTimer = null;

  els.searchBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    onSearch(els.searchInput.value);
  });

  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      onSearch(els.searchInput.value);
    }
  });

  if (onAutocomplete) {
    els.searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const val = els.searchInput.value.trim();
      if (val.length < 3) {
        hideSearchResults();
        return;
      }
      // Debounce 600ms to respect Nominatim rate limits
      debounceTimer = setTimeout(() => onAutocomplete(val), 600);
    });
  }
}

export function showSearchResults(results, onSelect) {
  hideSearchResults();
  if (results.length === 0) return;

  els.searchResults.classList.remove('hidden');
  els.searchResults.innerHTML = '';

  results.forEach((result) => {
    const li = document.createElement('li');
    li.className = 'search-result-item';
    li.textContent = result.shortName || result.name;
    li.title = result.name;
    li.addEventListener('click', () => {
      onSelect(result);
      hideSearchResults();
      els.searchInput.value = '';
    });
    els.searchResults.appendChild(li);
  });
}

export function hideSearchResults() {
  els.searchResults.classList.add('hidden');
  els.searchResults.innerHTML = '';
}

/**
 * Render waypoints in the sidebar list.
 * @param {Array<{name: string, coords: [number, number]}>} waypoints
 * @param {Function} onRemove - called with index
 */
export function renderWaypoints(waypoints, onRemove) {
  els.waypointsList.innerHTML = '';

  waypoints.forEach((wp, index) => {
    const li = document.createElement('li');
    li.className = 'waypoint-item';

    const letter = document.createElement('span');
    letter.className = 'waypoint-letter';
    letter.textContent = String.fromCharCode(65 + index);

    const label = document.createElement('span');
    label.className = 'waypoint-label';
    label.textContent = wp.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'waypoint-remove';
    removeBtn.textContent = '\u00d7';
    removeBtn.setAttribute('aria-label', `Remove ${wp.name}`);
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(index);
    });

    li.appendChild(letter);
    li.appendChild(label);
    li.appendChild(removeBtn);
    els.waypointsList.appendChild(li);
  });
}

export function showRouteSummary(distance, time) {
  els.routeSummary.classList.remove('hidden');
  els.totalDistance.textContent = formatDistance(distance);
  els.totalTime.textContent = formatTime(time);
}

export function hideRouteSummary() {
  els.routeSummary.classList.add('hidden');
}

export function renderDirections(steps) {
  els.directionsContainer.classList.remove('hidden');
  els.directionsList.innerHTML = '';

  steps.forEach((step) => {
    if (!step.maneuver) return;

    const li = document.createElement('li');
    li.className = 'direction-step';

    const text = document.createElement('span');
    text.className = 'direction-text';
    text.textContent = step.name
      ? `${formatManeuver(step.maneuver)} on ${step.name}`
      : formatManeuver(step.maneuver);

    const dist = document.createElement('span');
    dist.className = 'direction-distance';
    dist.textContent = step.distance ? formatDistance(step.distance) : '';

    li.appendChild(text);
    li.appendChild(dist);
    els.directionsList.appendChild(li);
  });
}

function formatManeuver(maneuver) {
  const type = maneuver.type || '';
  const modifier = maneuver.modifier || '';

  const types = {
    depart: 'Depart',
    arrive: 'Arrive',
    turn: `Turn ${modifier}`,
    'new name': `Continue on`,
    merge: `Merge ${modifier}`,
    'on ramp': `Take ramp ${modifier}`,
    'off ramp': `Exit ${modifier}`,
    fork: `Fork ${modifier}`,
    'end of road': `At end of road, turn ${modifier}`,
    continue: `Continue ${modifier}`,
    roundabout: `Roundabout, exit ${modifier}`,
    rotary: `Rotary, exit ${modifier}`,
    'roundabout turn': `Roundabout turn ${modifier}`,
    notification: '',
  };

  return types[type] || `${type} ${modifier}`.trim() || 'Continue';
}

export function hideDirections() {
  els.directionsContainer.classList.add('hidden');
  els.directionsList.innerHTML = '';
}

export function setGpsStatus(status) {
  if (els.gpsStatus) {
    els.gpsStatus.textContent = status;
  }
}

export function updateSpeedDisplay(speedKmh) {
  const display = document.getElementById('speed-display');
  const value = document.getElementById('speed-value');
  if (!display || !value) return;

  if (speedKmh !== null && speedKmh >= 0) {
    value.textContent = Math.round(speedKmh);
    display.classList.remove('hidden');
  } else {
    display.classList.add('hidden');
  }
}

export function setLocateButtonState(mode) {
  const btn = document.getElementById('locate-btn');
  if (!btn) return;
  btn.classList.remove('active', 'heading');
  if (mode === 'follow') btn.classList.add('active');
  if (mode === 'follow-heading') btn.classList.add('active', 'heading');
}

// ===== NAVIGATION HUD =====

export function showNavHud() {
  const hud = document.getElementById('nav-hud');
  if (hud) hud.classList.remove('hidden');
  // Hide standalone speed display when HUD is active
  const sd = document.getElementById('speed-display');
  if (sd) sd.classList.add('hidden');
}

export function hideNavHud() {
  const hud = document.getElementById('nav-hud');
  if (hud) hud.classList.add('hidden');
}

/**
 * Update all navigation HUD elements.
 */
export function updateNavHud({ distanceToTurn, instruction, maneuverType, maneuverModifier, eta, remaining, speed, speedLimit }) {
  const distEl = document.getElementById('nav-distance-to-turn');
  const instrEl = document.getElementById('nav-instruction');
  const iconEl = document.getElementById('nav-maneuver-icon');
  const etaEl = document.getElementById('nav-eta');
  const remEl = document.getElementById('nav-remaining');
  const spdEl = document.getElementById('nav-speed');
  const limContainer = document.getElementById('nav-speed-limit-container');
  const limEl = document.getElementById('nav-speed-limit');

  if (distEl) distEl.textContent = formatDistance(distanceToTurn);
  if (instrEl) instrEl.textContent = instruction || '';
  if (iconEl) iconEl.innerHTML = getManeuverSvg(maneuverType, maneuverModifier);

  if (etaEl && eta) {
    const h = eta.getHours().toString().padStart(2, '0');
    const m = eta.getMinutes().toString().padStart(2, '0');
    etaEl.textContent = `${h}:${m}`;
  }

  if (remEl) remEl.textContent = formatDistance(remaining);
  if (spdEl) spdEl.textContent = speed !== null ? Math.round(speed) : '0';

  // Speed limit
  if (limContainer && limEl) {
    if (speedLimit && speedLimit > 0) {
      limContainer.classList.remove('hidden');
      limEl.textContent = speedLimit;
      // Speeding state
      const spdStat = spdEl?.closest('.nav-stat');
      if (speed > speedLimit) {
        limContainer.classList.add('speeding');
        if (spdStat) spdStat.classList.add('speeding');
      } else {
        limContainer.classList.remove('speeding');
        if (spdStat) spdStat.classList.remove('speeding');
      }
    } else {
      limContainer.classList.add('hidden');
      limContainer.classList.remove('speeding');
      const spdStat = spdEl?.closest('.nav-stat');
      if (spdStat) spdStat.classList.remove('speeding');
    }
  }
}

/**
 * Get SVG icon for a maneuver type + modifier.
 */
function getManeuverSvg(type, modifier) {
  const color = '#fff';
  const sw = '2.5';

  // Arrow pointing up (straight)
  const straight = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><line x1="20" y1="35" x2="20" y2="8"/><polyline points="12,16 20,8 28,16"/></svg>`;

  // Turn right
  const turnRight = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M15 35 L15 18 Q15 12 21 12 L32 12"/><polyline points="26,6 32,12 26,18"/></svg>`;

  // Turn left
  const turnLeft = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M25 35 L25 18 Q25 12 19 12 L8 12"/><polyline points="14,6 8,12 14,18"/></svg>`;

  // Sharp right
  const sharpRight = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><line x1="15" y1="8" x2="15" y2="22"/><line x1="15" y1="22" x2="30" y2="35"/><polyline points="30,28 30,35 23,35"/></svg>`;

  // Sharp left
  const sharpLeft = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><line x1="25" y1="8" x2="25" y2="22"/><line x1="25" y1="22" x2="10" y2="35"/><polyline points="10,28 10,35 17,35"/></svg>`;

  // Slight right
  const slightRight = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="35" x2="16" y2="20"/><line x1="16" y1="20" x2="28" y2="8"/><polyline points="22,8 28,8 28,14"/></svg>`;

  // Slight left
  const slightLeft = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><line x1="24" y1="35" x2="24" y2="20"/><line x1="24" y1="20" x2="12" y2="8"/><polyline points="18,8 12,8 12,14"/></svg>`;

  // U-turn
  const uturn = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 35 L14 16 Q14 8 22 8 Q30 8 30 16 L30 35"/><polyline points="8,28 14,35 20,28"/></svg>`;

  // Roundabout
  const roundabout = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="18" r="8"/><line x1="20" y1="26" x2="20" y2="36"/><polyline points="14,12 20,10 26,12"/></svg>`;

  // Arrive (flag)
  const arrive = `<svg viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="35"/><path d="M12 8 L30 14 L12 20" fill="rgba(255,255,255,0.3)"/></svg>`;

  const mod = (modifier || '').toLowerCase();

  switch (type) {
    case 'depart':
    case 'continue':
    case 'new name':
      return straight;
    case 'arrive':
      return arrive;
    case 'turn':
    case 'end of road':
      if (mod.includes('sharp') && mod.includes('right')) return sharpRight;
      if (mod.includes('sharp') && mod.includes('left')) return sharpLeft;
      if (mod.includes('slight') && mod.includes('right')) return slightRight;
      if (mod.includes('slight') && mod.includes('left')) return slightLeft;
      if (mod.includes('right')) return turnRight;
      if (mod.includes('left')) return turnLeft;
      if (mod.includes('uturn') || mod.includes('u-turn')) return uturn;
      return straight;
    case 'merge':
    case 'on ramp':
    case 'off ramp':
    case 'fork':
      if (mod.includes('right')) return slightRight;
      if (mod.includes('left')) return slightLeft;
      return straight;
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return roundabout;
    default:
      return straight;
  }
}

export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
