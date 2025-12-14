import type { StreetViewParams } from '@/types';

const GOOGLE_STREET_VIEW_API_KEY = process.env.GOOGLE_STREET_VIEW_API_KEY!;

export interface StreetViewImage {
  url: string;
  heading: number;
  pitch: number;
  fov: number;
}

export async function getStreetViewImage(params: StreetViewParams): Promise<string> {
  const url = new URL('https://maps.googleapis.com/maps/api/streetview');
  url.searchParams.set('size', '640x640');
  url.searchParams.set('location', `${params.lat},${params.lng}`);
  url.searchParams.set('heading', String(params.heading));
  url.searchParams.set('pitch', String(params.pitch));
  url.searchParams.set('fov', String(params.fov));
  url.searchParams.set('key', GOOGLE_STREET_VIEW_API_KEY);

  return url.toString();
}

export async function checkStreetViewAvailability(
  lat: number,
  lng: number
): Promise<boolean> {
  const url = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('key', GOOGLE_STREET_VIEW_API_KEY);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    return data.status === 'OK';
  } catch {
    return false;
  }
}

export async function getMultipleStreetViewAngles(
  lat: number,
  lng: number,
  options?: {
    headings?: number[];
    pitch?: number;
    fov?: number;
  }
): Promise<StreetViewImage[]> {
  const headings = options?.headings || [0, 90, 180, 270];
  const pitch = options?.pitch ?? 10;
  const fov = options?.fov ?? 90;

  const images: StreetViewImage[] = [];

  for (const heading of headings) {
    const url = await getStreetViewImage({
      lat,
      lng,
      heading,
      pitch,
      fov,
    });

    images.push({
      url,
      heading,
      pitch,
      fov,
    });
  }

  return images;
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
