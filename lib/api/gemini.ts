import { GoogleGenerativeAI } from '@google/generative-ai';
import type { POI } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

const POI_GENERATION_PROMPT = `You are a meticulous location scout for a premium stock footage production. Your task is to identify exactly 4 of the BEST filming locations in "{location}".

CREATIVE DIRECTION: {direction}

TIME PERIOD: Modern day (present time) unless the creative direction specifies otherwise.

YOUR SELECTION CRITERIA - Choose locations that:
1. Are ICONIC and instantly recognizable for this area
2. Have VERIFIED Google Street View coverage (main roads, public areas)
3. Would look compelling in professional stock footage
4. Represent diverse visual variety (don't pick 4 similar locations)

THINK CAREFULLY about each selection:
- What is the single most famous landmark in this area?
- What is the main commercial/downtown street?
- Is there a notable waterfront, beach, or natural feature?
- What historic or cultural site defines this place?

COORDINATE ACCURACY IS CRITICAL:
- Use coordinates you are CERTAIN about
- Prefer well-known locations with easily verifiable coordinates
- The Street View camera should be ON A PUBLIC ROAD facing the POI

FOR EACH OF THE 4 LOCATIONS:
{
  "name": "Official name (e.g., 'Central Park', 'Main Street', 'City Hall')",
  "description": "2-3 sentences: What does it look like? What makes it visually striking? What activity happens here? Describe as if briefing a cinematographer.",
  "lat": 40.785091,
  "lng": -73.968285,
  "relevanceReason": "Why this location is essential for capturing {location}",
  "category": "landmark|restaurant|beach|park|historic|shopping|street|scenic|civic"
}

LOCATION DIVERSITY - Your 4 picks should include:
1. The signature landmark or most recognizable spot
2. A vibrant street scene (downtown, main street, commercial area)
3. A natural or scenic location (waterfront, park, viewpoint)
4. A cultural/historic site OR a local character spot (cafe district, market)

Return ONLY a valid JSON array with exactly 4 locations. No markdown, no explanation.`;

export async function generatePOIs(
  location: string,
  direction: string,
  maxRetries = 3
): Promise<POI[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = POI_GENERATION_PROMPT
    .replace(/{location}/g, location)
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
        // Limit to 4 POIs maximum
        const limitedPois = pois.slice(0, 4);
        console.log(`Successfully generated ${limitedPois.length} POIs`);
        return limitedPois;
      }

      throw new Error('Empty POI list returned');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Gemini API attempt ${attempt + 1} failed:`, lastError.message);

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
  let cleanText = text.trim();
  cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

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
    !poi.name.includes('Area ') &&
    typeof poi.description === 'string' &&
    poi.description.length > 20 &&
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

// Fallback POI generator - only 4 locations
export function generateFallbackPOIs(
  locationName: string,
  lat: number,
  lng: number
): POI[] {
  const fallbackTypes = [
    { name: `${locationName} Town Center`, category: 'street', offset: { lat: 0, lng: 0 } },
    { name: `${locationName} Main Street`, category: 'street', offset: { lat: 0.003, lng: 0.003 } },
    { name: `${locationName} Park`, category: 'park', offset: { lat: -0.003, lng: 0.002 } },
    { name: `${locationName} Historic District`, category: 'historic', offset: { lat: 0.002, lng: -0.003 } },
  ];

  return fallbackTypes.map((type) => ({
    name: type.name,
    description: `A scenic location in ${locationName} featuring characteristic architecture and local atmosphere. Modern day setting with typical community activity.`,
    lat: lat + type.offset.lat,
    lng: lng + type.offset.lng,
    relevanceReason: 'Key location for capturing the essence of ' + locationName,
    category: type.category,
  }));
}
