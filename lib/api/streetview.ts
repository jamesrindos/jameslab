import type { StreetViewParams } from '@/types';

const GOOGLE_STREET_VIEW_API_KEY = process.env.GOOGLE_STREET_VIEW_API_KEY!;

export interface StreetViewImage {
  url: string;
  heading: number;
  pitch: number;
  fov: number;
}

export interface StreetViewMetadata {
  status: string;
  pano_id?: string;
  location?: {
    lat: number;
    lng: number;
  };
  date?: string;
}

// Get optimal Street View image for a POI
export async function getOptimalStreetViewImage(
  poiLat: number,
  poiLng: number,
  poiName: string,
  category?: string
): Promise<{ url: string; metadata: StreetViewMetadata | null }> {
  // First check if Street View is available at this exact location
  const metadata = await getStreetViewMetadata(poiLat, poiLng);

  if (metadata.status !== 'OK') {
    // Try nearby locations in a small radius
    const nearbyResult = await findNearbyStreetView(poiLat, poiLng);
    if (nearbyResult) {
      return nearbyResult;
    }

    // Return a placeholder or the best guess
    const url = await getStreetViewImage({
      lat: poiLat,
      lng: poiLng,
      heading: 0,
      pitch: 0,
      fov: 90,
    });
    return { url, metadata: null };
  }

  // Calculate optimal camera settings based on category
  const settings = getOptimalCameraSettings(category);

  // If we have the actual Street View location, point toward the POI
  let heading = settings.heading;
  if (metadata.location && (metadata.location.lat !== poiLat || metadata.location.lng !== poiLng)) {
    // Street View camera is offset from POI - calculate heading to point at POI
    heading = calculateHeadingToTarget(
      metadata.location.lat,
      metadata.location.lng,
      poiLat,
      poiLng
    );
  }

  const url = await getStreetViewImage({
    lat: metadata.location?.lat || poiLat,
    lng: metadata.location?.lng || poiLng,
    heading,
    pitch: settings.pitch,
    fov: settings.fov,
  });

  return { url, metadata };
}

// Get camera settings optimized for different POI types
function getOptimalCameraSettings(category?: string): { heading: number; pitch: number; fov: number } {
  switch (category) {
    case 'landmark':
    case 'historic':
      // Look up slightly for tall buildings/monuments
      return { heading: 0, pitch: 15, fov: 80 };

    case 'beach':
    case 'scenic':
      // Wide angle for landscapes
      return { heading: 0, pitch: 5, fov: 100 };

    case 'restaurant':
    case 'shopping':
      // Street level for storefronts
      return { heading: 0, pitch: 0, fov: 90 };

    case 'park':
      // Slight upward for trees/nature
      return { heading: 0, pitch: 10, fov: 95 };

    case 'street':
      // Level view down the street
      return { heading: 0, pitch: 0, fov: 90 };

    default:
      return { heading: 0, pitch: 5, fov: 90 };
  }
}

// Find Street View coverage near a location
async function findNearbyStreetView(
  lat: number,
  lng: number,
  radiusMeters = 100
): Promise<{ url: string; metadata: StreetViewMetadata } | null> {
  // Try a few nearby points
  const offsets = [
    { lat: 0.0005, lng: 0 },      // ~50m north
    { lat: -0.0005, lng: 0 },     // ~50m south
    { lat: 0, lng: 0.0005 },      // ~50m east
    { lat: 0, lng: -0.0005 },     // ~50m west
    { lat: 0.0003, lng: 0.0003 }, // diagonal
    { lat: -0.0003, lng: 0.0003 },
    { lat: 0.0003, lng: -0.0003 },
    { lat: -0.0003, lng: -0.0003 },
  ];

  for (const offset of offsets) {
    const testLat = lat + offset.lat;
    const testLng = lng + offset.lng;
    const metadata = await getStreetViewMetadata(testLat, testLng);

    if (metadata.status === 'OK') {
      // Found Street View - point toward the original POI
      const heading = calculateHeadingToTarget(
        metadata.location?.lat || testLat,
        metadata.location?.lng || testLng,
        lat,
        lng
      );

      const url = await getStreetViewImage({
        lat: testLat,
        lng: testLng,
        heading,
        pitch: 10,
        fov: 90,
      });

      return { url, metadata };
    }
  }

  return null;
}

export async function getStreetViewMetadata(
  lat: number,
  lng: number
): Promise<StreetViewMetadata> {
  const url = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('key', GOOGLE_STREET_VIEW_API_KEY);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    return data as StreetViewMetadata;
  } catch {
    return { status: 'ERROR' };
  }
}

export async function getStreetViewImage(params: StreetViewParams): Promise<string> {
  const url = new URL('https://maps.googleapis.com/maps/api/streetview');
  url.searchParams.set('size', '1280x720'); // Larger, cinematic aspect ratio
  url.searchParams.set('location', `${params.lat},${params.lng}`);
  url.searchParams.set('heading', String(Math.round(params.heading)));
  url.searchParams.set('pitch', String(params.pitch));
  url.searchParams.set('fov', String(params.fov));
  url.searchParams.set('key', GOOGLE_STREET_VIEW_API_KEY);

  return url.toString();
}

export async function checkStreetViewAvailability(
  lat: number,
  lng: number
): Promise<boolean> {
  const metadata = await getStreetViewMetadata(lat, lng);
  return metadata.status === 'OK';
}

export function calculateHeadingToTarget(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLng = toRad(toLng - fromLng);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);

  const x = Math.sin(dLng) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let heading = toDeg(Math.atan2(x, y));
  heading = (heading + 360) % 360;

  return heading;
}
