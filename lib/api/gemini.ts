import { GoogleGenerativeAI } from '@google/generative-ai';
import type { POI } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

const POI_GENERATION_PROMPT = `You are a professional location scout for a high-budget film production. Your job is to identify SPECIFIC, REAL, NAMED locations in "{location}" for cinematic b-roll footage.

CREATIVE DIRECTION: {direction}

CRITICAL REQUIREMENTS:
1. Return ONLY real, named establishments and landmarks that actually exist
2. Use EXACT GPS coordinates (verify these are accurate to the actual location)
3. Include a MIX of location types for visual variety
4. Every location must be accessible via Google Street View (public roads)

REQUIRED LOCATION TYPES (include at least one of each that exists in the area):
- Signature landmark or monument (the most recognizable spot)
- Main Street / Downtown commercial district
- Popular restaurant, cafe, or bar with outdoor presence
- Beach, waterfront, pier, or marina (if coastal)
- Park, garden, or nature area with scenic views
- Historic building, church, or cultural institution
- School, university, or library
- Shopping center, boutique street, or local market
- Sports facility, stadium, or recreation area
- Scenic overlook or photo-worthy viewpoint

FOR EACH LOCATION PROVIDE:
- name: The ACTUAL business name or official landmark name (e.g., "Joe's Clam Shack", "Islip Town Beach", "St. Mary's Church")
- description: 1-2 detailed sentences describing what makes this location visually interesting for filming. Include architectural details, atmosphere, typical activity, and best time of day to shoot.
- lat: Exact latitude (6 decimal places)
- lng: Exact longitude (6 decimal places)
- relevanceReason: How this location serves the creative direction
- category: One of: landmark, restaurant, beach, park, historic, shopping, entertainment, scenic, street, civic

EXAMPLE OUTPUT:
[
  {
    "name": "Babylon Village Main Street",
    "description": "Charming tree-lined commercial street with boutique shops, outdoor cafes, and historic storefronts. Victorian-era lampposts and flower planters create a quintessential small-town American atmosphere. Best shot during golden hour when warm light fills the street.",
    "lat": 40.695631,
    "lng": -73.325821,
    "relevanceReason": "Perfect establishing shot showing local character and community life",
    "category": "street"
  },
  {
    "name": "Fire Island Lighthouse",
    "description": "Historic 168-foot tall black and white striped lighthouse built in 1858. Surrounded by maritime forest and dunes with sweeping ocean views. The iconic structure provides dramatic silhouettes at sunrise and sunset.",
    "lat": 40.632442,
    "lng": -73.218768,
    "relevanceReason": "Iconic regional landmark perfect for establishing shots and aerial reveals",
    "category": "landmark"
  }
]

Return ONLY a valid JSON array with 8-12 locations. No markdown, no explanation, just the JSON array.`;

export async function generatePOIs(
  location: string,
  direction: string,
  maxRetries = 3
): Promise<POI[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = POI_GENERATION_PROMPT
    .replace('{location}', location)
    .replace('{direction}', direction);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Gemini POI generation attempt ${attempt + 1} for "${location}"`);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('Gemini response received, parsing...');

      // Try to extract JSON from the response
      const pois = parseGeminiResponse(text);

      if (pois.length > 0) {
        console.log(`Successfully generated ${pois.length} POIs`);
        return pois;
      }

      // If we got an empty array, retry with stricter prompt
      throw new Error('Empty POI list returned');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Gemini API attempt ${attempt + 1} failed:`, lastError.message);

      // Exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  throw new Error(`Failed to generate POIs after ${maxRetries} attempts: ${lastError?.message}`);
}

function parseGeminiResponse(text: string): POI[] {
  // Clean up the response - remove markdown code blocks if present
  let cleanText = text.trim();

  // Remove markdown code blocks
  cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Try to find JSON array in the text
  const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in response');
  }

  const jsonText = jsonMatch[0];

  try {
    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    // Validate and clean each POI
    const validPOIs: POI[] = [];

    for (const item of parsed) {
      if (isValidPOI(item)) {
        validPOIs.push({
          name: String(item.name).trim(),
          description: String(item.description).trim(),
          lat: Number(item.lat),
          lng: Number(item.lng),
          relevanceReason: String(item.relevanceReason).trim(),
          category: String(item.category || 'landmark').trim(),
        });
      }
    }

    return validPOIs;
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function isValidPOI(obj: unknown): obj is POI {
  if (!obj || typeof obj !== 'object') return false;

  const poi = obj as Record<string, unknown>;

  return (
    typeof poi.name === 'string' &&
    poi.name.length > 0 &&
    !poi.name.includes('Area ') && // Reject generic names
    typeof poi.description === 'string' &&
    poi.description.length > 20 && // Require meaningful descriptions
    typeof poi.lat === 'number' &&
    !isNaN(poi.lat) &&
    poi.lat >= -90 &&
    poi.lat <= 90 &&
    typeof poi.lng === 'number' &&
    !isNaN(poi.lng) &&
    poi.lng >= -180 &&
    poi.lng <= 180 &&
    typeof poi.relevanceReason === 'string'
  );
}

// Fallback POI generator - uses Google Places API style naming
export function generateFallbackPOIs(
  locationName: string,
  lat: number,
  lng: number
): POI[] {
  // These are generic but named fallbacks - should rarely be used
  const fallbackTypes = [
    { name: `${locationName} Town Center`, category: 'street', offset: { lat: 0, lng: 0 } },
    { name: `${locationName} Main Street`, category: 'street', offset: { lat: 0.005, lng: 0.005 } },
    { name: `${locationName} Public Park`, category: 'park', offset: { lat: -0.005, lng: 0.005 } },
    { name: `${locationName} Waterfront`, category: 'scenic', offset: { lat: 0.008, lng: -0.005 } },
    { name: `${locationName} Historic District`, category: 'historic', offset: { lat: -0.005, lng: -0.005 } },
    { name: `${locationName} Shopping District`, category: 'shopping', offset: { lat: 0.003, lng: 0.008 } },
    { name: `${locationName} Community Center`, category: 'civic', offset: { lat: -0.008, lng: 0 } },
    { name: `${locationName} Recreation Area`, category: 'park', offset: { lat: 0, lng: -0.01 } },
  ];

  return fallbackTypes.map((type) => ({
    name: type.name,
    description: `A scenic location in ${locationName} perfect for establishing shots and capturing local atmosphere. Features characteristic architecture and community activity.`,
    lat: lat + type.offset.lat,
    lng: lng + type.offset.lng,
    relevanceReason: 'Local point of interest for b-roll footage',
    category: type.category,
  }));
}
