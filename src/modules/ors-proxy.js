/**
 * ORS (OpenRouteService) proxy — intercepts OSRM requests from
 * maplibre-gl-directions and routes them through ORS instead.
 *
 * Get a free API key at https://openrouteservice.org/dev/#/signup
 */
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImNkYWNhOWVmNGM2MzRjOWFhOTcwYmMwNWI5MGViOWQ1IiwiaCI6Im11cm11cjY0In0=';

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
const OSRM_HOST = 'router.project-osrm.org';

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

function convertOrsToOsrm(orsData, originalCoords) {
  const feature = orsData.features?.[0];
  if (!feature) return { code: 'NoRoute' };

  const props     = feature.properties;
  const geometry  = feature.geometry; // GeoJSON LineString
  const segment   = props.segments?.[0];
  if (!segment) return { code: 'NoRoute' };

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
    code: 'Ok',
    routes: [{
      distance: props.summary.distance,
      duration: props.summary.duration,
      geometry,
      legs: [{ distance: props.summary.distance, duration: props.summary.duration, steps }],
    }],
    waypoints: originalCoords.map((c) => ({ hint: '', location: c, name: '', distance: 0 })),
  };
}

async function orsProxy(osrmUrl, init, origFetch) {
  const urlObj   = new URL(osrmUrl);
  const parts    = urlObj.pathname.split('/');
  const coordStr = parts[parts.length - 1];
  const coords   = coordStr.split(';').map((c) => c.split(',').map(Number));

  const exclude  = urlObj.searchParams.get('exclude') || '';
  const orsBody  = { coordinates: coords, instructions: true, instructions_format: 'text' };

  const avoidFeatures = [];
  if (exclude.includes('motorway')) avoidFeatures.push('highways');
  if (exclude.includes('toll'))     avoidFeatures.push('tollways');
  if (exclude.includes('ferry'))    avoidFeatures.push('ferries');
  if (avoidFeatures.length) orsBody.options = { avoid_features: avoidFeatures };

  try {
    const orsRes = await origFetch(ORS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': ORS_API_KEY },
      body: JSON.stringify(orsBody),
    });
    if (!orsRes.ok) throw new Error(`ORS ${orsRes.status}`);
    const orsData  = await orsRes.json();
    const osrmData = convertOrsToOsrm(orsData, coords);
    return new Response(JSON.stringify(osrmData), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[ors-proxy] failed:', err);
    return new Response(JSON.stringify({ code: 'Error', message: err.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export function installOrsProxy() {
  if (!ORS_API_KEY) {
    console.warn('[ors-proxy] No API key set — falling back to public OSRM');
    return;
  }
  const origFetch = window.fetch.bind(window);
  window.fetch = function (url, init) {
    if (typeof url === 'string' && url.includes(OSRM_HOST)) {
      return orsProxy(url, init, origFetch);
    }
    return origFetch(url, init);
  };
  console.log('[ors-proxy] installed — routing via OpenRouteService');
}
