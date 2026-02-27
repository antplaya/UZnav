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

export function setupSearch(onSearch) {
  els.searchBtn.addEventListener('click', () => {
    onSearch(els.searchInput.value);
  });

  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch(els.searchInput.value);
    }
  });
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
