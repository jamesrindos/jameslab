import { GoogleGenerativeAI } from '@google/generative-ai';
import type { POI } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

const POI_GENERATION_PROMPT = `You are a location scout identifying filming locations. Given the location "{location}" and the creative direction "{direction}", identify 8-12 specific points of interest for cinematic b-roll footage.

CRITICAL REQUIREMENTS FOR COORDINATES:
1. Use EXACT, REAL coordinates for well-known landmarks - do NOT estimate or approximate
2. Only include locations that have Google Street View coverage (public roads and paths)
3. Prefer famous landmarks, main streets, public squares, and tourist areas where Street View exists
4. Double-check that coordinates point to the ACTUAL location, not nearby areas

Location types to consider:
- Famous landmarks (bridges, monuments, towers, statues)
- Main commercial streets and plazas
- Historic buildings and architecture
- Waterfronts, piers, and boardwalks
- Popular parks and gardens (main entrances)
- Transit hubs (train stations, major intersections)

IMPORTANT: Return ONLY a valid JSON array with no additional text or markdown. Each object must have:
- name: string (official name of the point of interest)
- description: string (brief visual description)
- lat: number (EXACT latitude to 4+ decimal places)
- lng: number (EXACT longitude to 4+ decimal places)
- relevanceReason: string (why this matches the creative direction)

Example with REAL coordinates:
[{"name":"Eiffel Tower","description":"Iconic iron lattice tower with panoramic city views","lat":48.8584,"lng":2.2945,"relevanceReason":"Perfect for establishing shots and golden hour cinematography"}]`;

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
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Try to extract JSON from the response
      const pois = parseGeminiResponse(text);

      if (pois.length > 0) {
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
    typeof poi.description === 'string' &&
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

// Fallback POI generator for when Gemini fails completely
export function generateFallbackPOIs(
  locationName: string,
  lat: number,
  lng: number
): POI[] {
  // Generate a simple grid of points around the center
  const offsets = [
    { lat: 0.01, lng: 0.01 },
    { lat: 0.01, lng: -0.01 },
    { lat: -0.01, lng: 0.01 },
    { lat: -0.01, lng: -0.01 },
    { lat: 0, lng: 0.015 },
    { lat: 0, lng: -0.015 },
    { lat: 0.015, lng: 0 },
    { lat: -0.015, lng: 0 },
  ];

  return offsets.map((offset, index) => ({
    name: `${locationName} Area ${index + 1}`,
    description: `Exploring the streets and atmosphere near ${locationName}`,
    lat: lat + offset.lat,
    lng: lng + offset.lng,
    relevanceReason: 'Street-level exploration point',
  }));
}
