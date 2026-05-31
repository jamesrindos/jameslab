// POI Discovery using Google Places API
// Finds REAL points of interest with verified coordinates and data

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export interface RealPOI {
  name: string;
  description: string;
  lat: number;
  lng: number;
  relevanceReason: string;
  category: string;
  placeId: string;
  rating?: number;
  photoReference?: string;
}

// Fetch a Place Photo using the photo_reference
// Returns a high-quality image URL of the actual location
export async function getPlacePhotoUrl(
  photoReference: string,
  maxWidth: number = 1200
): Promise<string | null> {
  // The Places Photo API returns a redirect to the actual image
  // We construct the URL that will redirect to the photo
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${PLACES_API_KEY}`;

  try {
    // Fetch to get the redirected URL (the actual image URL)
    const response = await fetch(url, { redirect: 'follow' });
    if (response.ok) {
      // Return the final URL after redirect
      return response.url;
    }
    console.error('Place Photo API error:', response.status);
    return null;
  } catch (error) {
    console.error('Error fetching place photo:', error);
    return null;
  }
}

// Get multiple photo references for a place (for variety)
export async function getPlacePhotos(
  placeId: string,
  maxPhotos: number = 3
): Promise<string[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'photos');
  url.searchParams.set('key', PLACES_API_KEY);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.result?.photos) {
      return [];
    }

    // Return up to maxPhotos photo references
    return data.result.photos
      .slice(0, maxPhotos)
      .map((p: { photo_reference: string }) => p.photo_reference);
  } catch (error) {
    console.error('Error fetching place photos:', error);
    return [];
  }
}

// Place types to search for, in priority order
const POI_SEARCH_TYPES = [
  { type: 'tourist_attraction', category: 'landmark', priority: 1 },
  { type: 'museum', category: 'landmark', priority: 1 },
  { type: 'city_hall', category: 'civic', priority: 2 },
  { type: 'church', category: 'historic', priority: 2 },
  { type: 'park', category: 'park', priority: 2 },
  { type: 'restaurant', category: 'restaurant', priority: 3 },
  { type: 'cafe', category: 'restaurant', priority: 3 },
  { type: 'shopping_mall', category: 'shopping', priority: 3 },
  { type: 'library', category: 'civic', priority: 3 },
  { type: 'stadium', category: 'entertainment', priority: 2 },
  { type: 'aquarium', category: 'landmark', priority: 1 },
  { type: 'art_gallery', category: 'landmark', priority: 2 },
  { type: 'beach', category: 'beach', priority: 1 },
];

interface PlacesNearbyResult {
  results: Array<{
    place_id: string;
    name: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    rating?: number;
    types: string[];
    vicinity?: string;
    photos?: Array<{ photo_reference: string }>;
    user_ratings_total?: number;
  }>;
  status: string;
}

interface PlaceDetailsResult {
  result: {
    name: string;
    formatted_address?: string;
    editorial_summary?: { overview: string };
    reviews?: Array<{ text: string }>;
    types: string[];
    rating?: number;
    url?: string;
  };
  status: string;
}

async function searchNearbyPlaces(
  lat: number,
  lng: number,
  type: string,
  radius: number = 8000
): Promise<PlacesNearbyResult['results']> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', radius.toString());
  url.searchParams.set('type', type);
  url.searchParams.set('key', PLACES_API_KEY);

  const response = await fetch(url.toString());
  const data: PlacesNearbyResult = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error(`Places API error for type ${type}:`, data.status);
    return [];
  }

  return data.results || [];
}

async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult['result'] | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'name,formatted_address,editorial_summary,reviews,types,rating');
  url.searchParams.set('key', PLACES_API_KEY);

  const response = await fetch(url.toString());
  const data: PlaceDetailsResult = await response.json();

  if (data.status !== 'OK') {
    console.error(`Place details error for ${placeId}:`, data.status);
    return null;
  }

  return data.result;
}

function categorizePlace(types: string[]): string {
  if (types.includes('tourist_attraction') || types.includes('museum') || types.includes('aquarium')) {
    return 'landmark';
  }
  if (types.includes('beach')) return 'beach';
  if (types.includes('park')) return 'park';
  if (types.includes('restaurant') || types.includes('cafe') || types.includes('bar')) return 'restaurant';
  if (types.includes('shopping_mall') || types.includes('store')) return 'shopping';
  if (types.includes('church') || types.includes('cemetery')) return 'historic';
  if (types.includes('city_hall') || types.includes('library') || types.includes('school')) return 'civic';
  if (types.includes('stadium') || types.includes('amusement_park')) return 'entertainment';
  return 'landmark';
}

function generateDescription(
  name: string,
  types: string[],
  vicinity: string | undefined,
  editorialSummary: string | undefined,
  category: string
): string {
  // If we have an editorial summary from Google, use it
  if (editorialSummary && editorialSummary.length > 20) {
    return editorialSummary;
  }

  // Generate a cinematographer-style description based on category
  const categoryDescriptions: Record<string, string> = {
    landmark: `${name} is a distinctive landmark that anchors the visual character of this area. The architecture and setting offer strong compositional elements for establishing shots.`,
    beach: `${name} features a scenic shoreline with natural lighting opportunities throughout the day. The waterfront setting provides dynamic visual elements and open horizon lines.`,
    park: `${name} offers natural greenery and open spaces with dappled light filtering through trees. The setting provides a peaceful contrast to urban scenes.`,
    restaurant: `${name} showcases local dining culture with characteristic storefronts and outdoor seating areas. The facade and street presence add authentic neighborhood atmosphere.`,
    shopping: `${name} represents the commercial heart of the area with active storefronts and pedestrian activity. The setting captures everyday local life and commerce.`,
    historic: `${name} preserves architectural heritage with period details and craftsmanship. The structure provides visual gravitas and connects to the area's history.`,
    civic: `${name} serves as an institutional anchor for the community with formal architecture. The building represents local governance and public life.`,
    entertainment: `${name} draws crowds and activity, providing dynamic scenes of leisure and recreation. The venue adds energy and movement to the visual narrative.`,
  };

  const baseDesc = categoryDescriptions[category] || categoryDescriptions.landmark;

  if (vicinity) {
    return `${baseDesc} Located in ${vicinity}.`;
  }

  return baseDesc;
}

function generateRelevanceReason(name: string, category: string, rating?: number): string {
  const ratingNote = rating && rating >= 4.0 ? ` Highly rated (${rating}/5) by visitors.` : '';

  const reasons: Record<string, string> = {
    landmark: `Key visual anchor that defines the area's identity.${ratingNote}`,
    beach: `Natural waterfront setting essential for scenic variety.${ratingNote}`,
    park: `Green space providing natural contrast and breathing room.${ratingNote}`,
    restaurant: `Local dining scene capturing community character.${ratingNote}`,
    shopping: `Commercial activity showcasing everyday life.${ratingNote}`,
    historic: `Heritage architecture connecting past and present.${ratingNote}`,
    civic: `Institutional presence representing community identity.${ratingNote}`,
    entertainment: `Activity hub capturing local leisure culture.${ratingNote}`,
  };

  return reasons[category] || reasons.landmark;
}

export async function discoverRealPOIs(
  locationName: string,
  lat: number,
  lng: number,
  count: number = 4
): Promise<RealPOI[]> {
  console.log(`Discovering real POIs near ${locationName} (${lat}, ${lng})`);

  const allPlaces: Array<{
    place: PlacesNearbyResult['results'][0];
    searchType: typeof POI_SEARCH_TYPES[0];
  }> = [];

  // Search for each type of place
  for (const searchType of POI_SEARCH_TYPES) {
    try {
      const results = await searchNearbyPlaces(lat, lng, searchType.type);

      for (const place of results) {
        // Skip places with very few ratings (likely not significant)
        if (place.user_ratings_total && place.user_ratings_total < 10) continue;

        // Skip duplicates
        if (allPlaces.some(p => p.place.place_id === place.place_id)) continue;

        allPlaces.push({ place, searchType });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error searching for ${searchType.type}:`, error);
    }
  }

  console.log(`Found ${allPlaces.length} candidate places`);

  // Sort by priority and rating
  allPlaces.sort((a, b) => {
    // First by priority
    if (a.searchType.priority !== b.searchType.priority) {
      return a.searchType.priority - b.searchType.priority;
    }
    // Then by rating
    return (b.place.rating || 0) - (a.place.rating || 0);
  });

  // Select diverse POIs (avoid duplicates of same category)
  const selectedPlaces: typeof allPlaces = [];
  const usedCategories = new Set<string>();

  for (const item of allPlaces) {
    const category = item.searchType.category;

    // Allow max 2 of same category, prefer diversity
    const categoryCount = selectedPlaces.filter(p => p.searchType.category === category).length;
    if (categoryCount >= 2) continue;

    // Prefer first of each category for diversity
    if (usedCategories.size < 4 && usedCategories.has(category)) continue;

    selectedPlaces.push(item);
    usedCategories.add(category);

    if (selectedPlaces.length >= count) break;
  }

  // If we don't have enough, add more regardless of category
  if (selectedPlaces.length < count) {
    for (const item of allPlaces) {
      if (selectedPlaces.some(p => p.place.place_id === item.place.place_id)) continue;
      selectedPlaces.push(item);
      if (selectedPlaces.length >= count) break;
    }
  }

  console.log(`Selected ${selectedPlaces.length} diverse POIs`);

  // Get details for selected places and build final POIs
  const pois: RealPOI[] = [];

  for (const { place } of selectedPlaces) {
    try {
      const details = await getPlaceDetails(place.place_id);
      const category = categorizePlace(place.types);

      const description = generateDescription(
        place.name,
        place.types,
        place.vicinity,
        details?.editorial_summary?.overview,
        category
      );

      pois.push({
        name: place.name,
        description,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        relevanceReason: generateRelevanceReason(place.name, category, place.rating),
        category,
        placeId: place.place_id,
        rating: place.rating,
        photoReference: place.photos?.[0]?.photo_reference,
      });

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error getting details for ${place.name}:`, error);
    }
  }

  console.log(`Built ${pois.length} real POIs with details`);
  return pois;
}

// Search for a specific type of POI (e.g., "main street", "downtown")
export async function searchTextPOI(
  query: string,
  lat: number,
  lng: number
): Promise<RealPOI | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', '10000');
  url.searchParams.set('key', PLACES_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.length) {
    return null;
  }

  const place = data.results[0];
  const category = categorizePlace(place.types || []);

  return {
    name: place.name,
    description: generateDescription(place.name, place.types || [], place.formatted_address, undefined, category),
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    relevanceReason: generateRelevanceReason(place.name, category, place.rating),
    category,
    placeId: place.place_id,
    rating: place.rating,
  };
}
