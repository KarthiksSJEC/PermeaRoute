export const ROUTE_PLAN_STORAGE_KEY = 'permearoute_route_plan';
export const SELECTED_ROUTE_STORAGE_KEY = 'permearoute_selected_route_id';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function loadRoutePlan() {
  if (typeof window === 'undefined') {
    return null;
  }

  return safeJsonParse(window.localStorage.getItem(ROUTE_PLAN_STORAGE_KEY), null);
}

export function saveRoutePlan(routePlan) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ROUTE_PLAN_STORAGE_KEY, JSON.stringify(routePlan));
}

export function loadSelectedRouteId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(SELECTED_ROUTE_STORAGE_KEY);
}

export function saveSelectedRouteId(routeId) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!routeId) {
    window.sessionStorage.removeItem(SELECTED_ROUTE_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(SELECTED_ROUTE_STORAGE_KEY, routeId);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(start, end) {
  const radiusKm = 6371;
  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLng = toRadians(end.lng - start.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(start.lat)) *
      Math.cos(toRadians(end.lat)) *
      Math.sin(deltaLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

function interpolatePoint(start, end, factor) {
  return {
    lat: start.lat + (end.lat - start.lat) * factor,
    lng: start.lng + (end.lng - start.lng) * factor,
  };
}

function offsetPoint(start, end, factor, direction, magnitudeScale) {
  const midpoint = interpolatePoint(start, end, factor);
  const deltaLat = end.lat - start.lat;
  const deltaLng = end.lng - start.lng;
  const length = Math.sqrt(deltaLat ** 2 + deltaLng ** 2) || 1;
  const perpendicularLat = -(deltaLng / length);
  const perpendicularLng = deltaLat / length;

  return {
    lat: midpoint.lat + perpendicularLat * magnitudeScale * direction,
    lng: midpoint.lng + perpendicularLng * magnitudeScale * direction,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function geocodePlace(placeName) {
  const queryVariants = [placeName, `${placeName}, India`];

  for (const query of queryVariants) {
    const url = `${NOMINATIM_BASE_URL}/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    try {
      const results = await fetchJson(url);
      if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        return {
          name: placeName,
          lat: Number(first.lat),
          lng: Number(first.lon),
          label: first.display_name,
        };
      }
    } catch (error) {
      // Try the next variant.
      console.warn(`Geocode failed for ${query}:`, error);
    }
  }

  return null;
}

async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

  try {
    const result = await fetchJson(url);
    const address = result?.address || {};
    return (
      address.road ||
      address.neighbourhood ||
      address.suburb ||
      address.city_district ||
      address.city ||
      result?.name ||
      result?.display_name?.split(',')?.[0] ||
      null
    );
  } catch (error) {
    console.warn('Reverse geocode failed:', error);
    return null;
  }
}

function fallbackCoordinateForName(placeName, index = 0) {
  const seed = Array.from(placeName).reduce((sum, character) => sum + character.charCodeAt(0), 0) + index * 97;
  const lat = 12.8 + ((seed % 40) / 100);
  const lng = 74.7 + (((seed * 3) % 40) / 100);
  return { name: placeName, lat, lng, label: placeName };
}

export async function buildRoutePlan(startName, destinationName) {
  const start = (await geocodePlace(startName)) || fallbackCoordinateForName(startName, 0);
  const destination = (await geocodePlace(destinationName)) || fallbackCoordinateForName(destinationName, 1);

  const routeConfigs = [
    { routeId: 'route-a', routeName: 'Route A', factor: 0.42, direction: 1 },
    { routeId: 'route-b', routeName: 'Route B', factor: 0.5, direction: -1 },
    { routeId: 'route-c', routeName: 'Route C', factor: 0.58, direction: 1 },
  ];

  const magnitudeScale = Math.min(Math.max(haversineKm(start, destination) / 400, 0.008), 0.03);

  const routes = await Promise.all(
    routeConfigs.map(async (config) => {
      const samplingCoords = offsetPoint(start, destination, config.factor, config.direction, magnitudeScale);
      const samplingJunction =
        (await reverseGeocode(samplingCoords.lat, samplingCoords.lng)) ||
        `${config.routeName} Sampling Junction`;

      return {
        routeId: config.routeId,
        routeName: config.routeName,
        samplingJunction,
        start,
        destination,
        samplingCoords,
        path: [start, samplingCoords, destination],
        distanceKm: Number(
          (haversineKm(start, samplingCoords) + haversineKm(samplingCoords, destination)).toFixed(2)
        ),
        latestPi: null,
        isBlocked: false,
        active: false,
        feedCount: 0,
        reportStatus: 'PENDING',
      };
    })
  );

  return {
    start,
    destination,
    generatedAt: Date.now(),
    routes,
    bestRouteId: null,
    finalized: false,
    updatedAt: Date.now(),
  };
}

export function scoreRoutePlan(routePlan, feeds) {
  if (!routePlan || !Array.isArray(routePlan.routes)) {
    return routePlan;
  }

  const activeFeeds = Array.isArray(feeds) ? feeds : [];
  const scoredRoutes = routePlan.routes.map((route) => {
    const matchingFeed = activeFeeds.find((feed) => feed.route_id === route.routeId);
    const latestPi = matchingFeed?.latest_pi?.pi ?? null;
    const active = Boolean(matchingFeed?.active) && Boolean(matchingFeed?.last_seen_ts);

    return {
      ...route,
      latestPi,
      active,
      feedCount: matchingFeed ? 1 : 0,
      reportStatus: latestPi === null ? 'WAITING' : active ? 'ACTIVE' : 'STALE',
    };
  });

  const finalized = Date.now() - routePlan.generatedAt >= 30000;
  
  const updatedRoutes = scoredRoutes.map((route) => {
    const isBlocked = route.latestPi !== null && route.latestPi < 40;
    return {
      ...route,
      isBlocked,
    };
  });

  const eligibleRoutes = updatedRoutes.filter(r => !r.isBlocked);
  const bestRoute = eligibleRoutes.length > 0
    ? eligibleRoutes.reduce((best, current) => current.distanceKm < best.distanceKm ? current : best)
    : null;

  return {
    ...routePlan,
    routes: updatedRoutes,
    bestRouteId: bestRoute?.routeId ?? null,
    finalized,
    updatedAt: Date.now(),
  };
}