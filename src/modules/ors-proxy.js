/**
 * ORS (OpenRouteService) routing client.
 *
 * Get a free API key at https://openrouteservice.org/dev/#/signup
 */
export const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImNkYWNhOWVmNGM2MzRjOWFhOTcwYmMwNWI5MGViOWQ1IiwiaCI6Im11cm11cjY0In0=';

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

const ORS_TYPE_MAP = {
  0:  { type: 'turn',           modifier: 'left' },
  1:  { type: 'turn',           modifier: 'right' },
  2:  { type: 'turn',           modifier: 'sharp left' },
  3:  { type: 'turn',           modifier: 'sharp right' },
  4:  { type: 'turn',           modifier: 'slight left' },
  5:  { type: 'turn',           modifier: 'slight right' },
  6:  { type: 'continue',       modifier: 'straight' },
  7:  { type: 'roundabout' },
  8:  { type: 'exit roundabout' },
  9:  { type: 'turn',           modifier: 'uturn' },
  10: { type: 'arrive' },
  11: { type: 'depart' },
  12: { type: 'fork',           modifier: 'slight left' },
  13: { type: 'fork',           modifier: 'slight right' },
};

/**
 * Fetch route from ORS and return in OSRM-compatible format.
 * @param {Array<[number,number]>} coords - array of [lng, lat]
 * @param {{ avoidHighways?: boolean, avoidTolls?: boolean, avoidFerries?: boolean }} options
 * @returns {Promise<{ routes: Array, waypoints: Array } | null>}
 */
export async function fetchOrsRoute(coords, options = {}) {
  const body = { coordinates: coords, instructions: true, instructions_format: 'text' };

  const avoidFeatures = [];
  if (options.avoidHighways) avoidFeatures.push('highways');
  if (options.avoidTolls)    avoidFeatures.push('tollways');
  if (options.avoidFerries)  avoidFeatures.push('ferries');
  if (avoidFeatures.length) body.options = { avoid_features: avoidFeatures };

  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': ORS_API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`ORS ${res.status}`);

  const orsData = await res.json();
  const feature = orsData.features?.[0];
  if (!feature) return null;

  const props    = feature.properties;
  const geometry = feature.geometry;
  const segment  = props.segments?.[0];
  if (!segment) return null;

  const steps = segment.steps.map((step) => {
    const maneuverInfo = ORS_TYPE_MAP[step.type] ?? { type: 'continue', modifier: 'straight' };
    const stepCoord    = geometry.coordinates[step.way_points[0]];
    return {
      distance: step.distance,
      duration: step.duration,
      name: step.name || '',
      maneuver: { ...maneuverInfo, location: stepCoord },
      geometry: {
        type: 'LineString',
        coordinates: geometry.coordinates.slice(step.way_points[0], step.way_points[1] + 1),
      },
    };
  });

  return {
    routes: [{
      distance: props.summary.distance,
      duration: props.summary.duration,
      geometry,
      steps,
    }],
    waypoints: coords.map((c) => ({ location: c, name: '' })),
  };
}
