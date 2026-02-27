/**
 * Navigation state machine — tracks progress along an OSRM route.
 */

let active = false;
let steps = [];
let currentStepIndex = 0;
let totalDistance = 0;
let totalDuration = 0;

const MANEUVER_ADVANCE_RADIUS = 50; // meters — advance step when within this distance
const ARRIVAL_RADIUS = 30; // meters — consider arrived when this close to final maneuver

/**
 * Haversine distance between two lat/lng points in meters.
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Start navigation with OSRM route data.
 * @param {{ steps: Array, distance: number, duration: number }} route
 */
export function startNavigation(route) {
  steps = route.steps || [];
  totalDistance = route.distance || 0;
  totalDuration = route.duration || 0;
  currentStepIndex = 0;
  active = true;
}

/**
 * Update navigation state with current GPS position.
 * @param {number} lat
 * @param {number} lng
 * @returns {{ currentStep, nextStep, distanceToNextManeuver, remainingDistance, remainingTime, eta, arrived } | null}
 */
export function updatePosition(lat, lng) {
  if (!active || steps.length === 0) return null;

  // Check if we should advance to next step
  while (currentStepIndex < steps.length - 1) {
    const nextStep = steps[currentStepIndex + 1];
    if (!nextStep.maneuver || !nextStep.maneuver.location) break;

    const [mLng, mLat] = nextStep.maneuver.location;
    const dist = haversine(lat, lng, mLat, mLng);

    if (dist < MANEUVER_ADVANCE_RADIUS) {
      currentStepIndex++;
    } else {
      break;
    }
  }

  const currentStep = steps[currentStepIndex];
  const nextStep = currentStepIndex < steps.length - 1 ? steps[currentStepIndex + 1] : null;

  // Distance to next maneuver
  let distanceToNextManeuver = 0;
  if (nextStep && nextStep.maneuver && nextStep.maneuver.location) {
    const [mLng, mLat] = nextStep.maneuver.location;
    distanceToNextManeuver = haversine(lat, lng, mLat, mLng);
  }

  // Remaining distance and time (sum of remaining steps)
  let remainingDistance = 0;
  let remainingTime = 0;
  for (let i = currentStepIndex; i < steps.length; i++) {
    remainingDistance += steps[i].distance || 0;
    remainingTime += steps[i].duration || 0;
  }

  // Subtract already-traveled portion of current step (approximate)
  if (currentStep && currentStep.distance > 0 && distanceToNextManeuver > 0) {
    const stepProgress = Math.max(0, currentStep.distance - distanceToNextManeuver);
    remainingDistance = Math.max(0, remainingDistance - stepProgress);
    const timeFraction = stepProgress / currentStep.distance;
    remainingTime = Math.max(0, remainingTime - (currentStep.duration || 0) * timeFraction);
  }

  // ETA
  const eta = new Date(Date.now() + remainingTime * 1000);

  // Check arrival — last step, close to final maneuver
  let arrived = false;
  if (currentStepIndex >= steps.length - 1) {
    const lastStep = steps[steps.length - 1];
    if (lastStep.maneuver && lastStep.maneuver.location) {
      const [mLng, mLat] = lastStep.maneuver.location;
      arrived = haversine(lat, lng, mLat, mLng) < ARRIVAL_RADIUS;
    }
  }

  return {
    currentStep,
    nextStep,
    distanceToNextManeuver,
    remainingDistance,
    remainingTime,
    eta,
    arrived,
  };
}

/**
 * Stop navigation and clear state.
 */
export function stopNavigation() {
  active = false;
  steps = [];
  currentStepIndex = 0;
  totalDistance = 0;
  totalDuration = 0;
}

/**
 * Check if navigation is currently active.
 */
export function isActive() {
  return active;
}
