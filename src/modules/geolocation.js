/**
 * GPS geolocation with graceful fallback.
 */

let watchId = null;

function extractPosition(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    speed: pos.coords.speed,       // m/s or null
    heading: pos.coords.heading,   // degrees 0-360 or null
    accuracy: pos.coords.accuracy, // meters
  };
}

/**
 * Try to get the current GPS position.
 * @returns {Promise<{lat, lng, speed, heading, accuracy} | null>}
 */
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(extractPosition(pos)),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Watch GPS position and call onUpdate with each new position.
 * @param {Function} onUpdate - called with {lat, lng, speed, heading, accuracy} or null on error
 * @returns {Function} stop - call to stop watching
 */
export function watchPosition(onUpdate) {
  if (!navigator.geolocation) {
    onUpdate(null);
    return () => {};
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => onUpdate(extractPosition(pos)),
    () => onUpdate(null),
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    }
  );

  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };
}
