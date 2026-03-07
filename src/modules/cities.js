/**
 * Region configurations with cities, center, zoom, and bounds.
 */

export const REGIONS = {
  uz: {
    name: 'Uzbekistan',
    center: [41.3775, 64.5853],
    zoom: 6,
    bounds: { south: 37.1722, north: 45.5900, west: 55.9983, east: 73.1321 },
    countrycodes: 'uz',
    cities: [
      { name: 'Tashkent', lat: 41.2995, lng: 69.2401, capital: true },
      { name: 'Samarkand', lat: 39.6542, lng: 66.9597 },
      { name: 'Bukhara', lat: 39.7745, lng: 64.4286 },
      { name: 'Khiva', lat: 41.3775, lng: 60.3639 },
      { name: 'Nukus', lat: 42.4628, lng: 59.6060 },
      { name: 'Fergana', lat: 40.3834, lng: 71.7870 },
      { name: 'Namangan', lat: 41.0011, lng: 71.6722 },
      { name: 'Andijan', lat: 40.7821, lng: 72.3442 },
      { name: 'Navoi', lat: 40.0984, lng: 65.3792 },
      { name: 'Karshi', lat: 38.8606, lng: 65.7983 },
      { name: 'Termez', lat: 37.2241, lng: 67.2783 },
      { name: 'Urgench', lat: 41.5500, lng: 60.6333 },
      { name: 'Jizzakh', lat: 40.1158, lng: 67.8422 },
      { name: 'Gulistan', lat: 40.4897, lng: 68.7842 },
    ],
  },
  us: {
    name: 'United States',
    center: [39.8283, -98.5795],
    zoom: 4,
    bounds: { south: 24.396, north: 49.384, west: -125.0, east: -66.934 },
    countrycodes: 'us',
    cities: [
      { name: 'New York', lat: 40.7128, lng: -74.0060, capital: false },
      { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
      { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
      { name: 'Houston', lat: 29.7604, lng: -95.3698 },
      { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
      { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
      { name: 'Washington DC', lat: 38.9072, lng: -77.0369, capital: true },
      { name: 'Miami', lat: 25.7617, lng: -80.1918 },
      { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
      { name: 'Denver', lat: 39.7392, lng: -104.9903 },
      { name: 'Dallas', lat: 32.7767, lng: -96.7970 },
      { name: 'Atlanta', lat: 33.7490, lng: -84.3880 },
    ],
  },
};

// Default region
const DEFAULT_REGION = 'uz';

/**
 * Detect region based on GPS coordinates.
 * @returns {string} region key ('uz', 'us', etc.)
 */
export function detectRegion(lat, lng) {
  for (const [key, region] of Object.entries(REGIONS)) {
    const b = region.bounds;
    if (lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east) {
      return key;
    }
  }
  return DEFAULT_REGION;
}

/**
 * Get region config by key.
 */
export function getRegion(key) {
  return REGIONS[key] || REGIONS[DEFAULT_REGION];
}

// Backward-compatible exports
export const UZBEKISTAN_CITIES = REGIONS.uz.cities;
export const UZBEKISTAN_CENTER = REGIONS.uz.center;
export const UZBEKISTAN_ZOOM = REGIONS.uz.zoom;
export const UZBEKISTAN_BOUNDS = REGIONS.uz.bounds;
