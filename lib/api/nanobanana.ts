// NanoBanana Pro API - Gemini 2.5 Flash Image (aka "Nano Banana")
// Google's state-of-the-art image generation and editing model
// Docs: https://ai.google.dev/gemini-api/docs/image-generation

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY!;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Gemini 2.5 Flash Image is the "Nano Banana" model
const NANOBANANA_MODEL = 'gemini-2.0-flash-exp-image-generation';

export interface NanoBananaEnhanceRequest {
  imageUrl: string;
  direction: string;
  poiName: string;
  category?: string;
  style?: 'cinematic' | 'documentary' | 'commercial' | 'artistic';
}

export interface NanoBananaEnhanceResponse {
  success: boolean;
  enhancedImageUrl?: string;
  error?: string;
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return { base64, mimeType: contentType };
}

export async function enhanceImage(
  request: NanoBananaEnhanceRequest
): Promise<NanoBananaEnhanceResponse> {
  const prompt = buildStagingPrompt(request.poiName, request.category, request.direction);

  try {
    console.log(`NanoBanana: Staging scene for "${request.poiName}" (${request.category})`);

    // Fetch the source image and convert to base64
    const { base64, mimeType } = await fetchImageAsBase64(request.imageUrl);

    // Call Gemini Image Generation API for scene staging
    const response = await fetch(
      `${GEMINI_API_URL}/models/${NANOBANANA_MODEL}:generateContent?key=${NANOBANANA_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 0.8,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API error: ${response.status}`;

      // Check if it's a quota/access error - fall back to original
      if (response.status === 403 || response.status === 429 || response.status === 400) {
        console.warn(`NanoBanana: API error (${response.status}) - using original image`);
        return {
          success: true,
          enhancedImageUrl: request.imageUrl,
        };
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('NanoBanana: Response received');

    // Extract the generated image from the response
    const candidates = data.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          // Convert base64 image to data URL
          const imageMime = part.inlineData.mimeType || 'image/png';
          const enhancedImageUrl = `data:${imageMime};base64,${part.inlineData.data}`;

          console.log('NanoBanana: Successfully staged scene');
          return {
            success: true,
            enhancedImageUrl,
          };
        }
      }
    }

    // No image in response - fall back to original
    console.warn('NanoBanana: No image in response, using original');
    return {
      success: true,
      enhancedImageUrl: request.imageUrl,
    };
  } catch (error) {
    console.error('NanoBanana API error:', error);

    // Graceful fallback to original image
    return {
      success: true,
      enhancedImageUrl: request.imageUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function buildStagingPrompt(poiName: string, category?: string, direction?: string): string {
  // Get scene-specific staging instructions based on category
  const staging = getStagingInstructions(category);

  return `Transform this street view image of "${poiName}" into a premium stock footage frame ready for high-budget film production.

SCENE STAGING REQUIREMENTS:
${staging.people}
${staging.activity}
${staging.atmosphere}

CINEMATIC ENHANCEMENTS:
- Apply professional color grading with rich, filmic tones
- Add depth and dimension with subtle atmospheric haze
- Enhance lighting to create golden hour warmth
- Ensure 4K-quality sharpness and detail
- Remove any watermarks, logos, or UI elements

CREATIVE DIRECTION: ${direction || 'Cinematic establishing shot'}

IMPORTANT:
- Keep the location architecture and layout accurate
- Add realistic people and activity that belong in this setting
- Make it look like a frame from a major motion picture
- Output should be photorealistic, not illustrated

Generate the enhanced, staged version of this scene.`;
}

function getStagingInstructions(category?: string): { people: string; activity: string; atmosphere: string } {
  switch (category) {
    case 'restaurant':
      return {
        people: '- Add well-dressed patrons at outdoor tables, couples and small groups',
        activity: '- Show waitstaff serving, people enjoying meals and conversation',
        atmosphere: '- Warm evening lighting, string lights if applicable, inviting ambiance',
      };

    case 'beach':
      return {
        people: '- Add beachgoers spread naturally across the sand - families, couples, joggers',
        activity: '- Show people swimming, sunbathing, walking along shoreline, children playing',
        atmosphere: '- Golden sunset/sunrise light, gentle waves, seagulls in distance',
      };

    case 'park':
      return {
        people: '- Add diverse park visitors - joggers, dog walkers, families with children',
        activity: '- Show picnics, people reading on benches, kids on playground, couples strolling',
        atmosphere: '- Dappled sunlight through trees, lush green grass, peaceful setting',
      };

    case 'street':
    case 'shopping':
      return {
        people: '- Add shoppers with bags, pedestrians of various ages, window browsers',
        activity: '- Show people entering shops, street musicians, outdoor cafe patrons',
        atmosphere: '- Vibrant but not crowded, afternoon light, clean and inviting streets',
      };

    case 'landmark':
    case 'historic':
      return {
        people: '- Add tourists taking photos, tour groups, locals walking by',
        activity: '- Show people admiring architecture, posing for pictures, guided tours',
        atmosphere: '- Majestic lighting that highlights architectural details, sense of grandeur',
      };

    case 'civic':
      return {
        people: '- Add students, families, professionals going about their day',
        activity: '- Show community activity - people entering buildings, outdoor gatherings',
        atmosphere: '- Clean, welcoming civic environment with American flags if appropriate',
      };

    case 'scenic':
      return {
        people: '- Add a few hikers, photographers, couples enjoying the view',
        activity: '- Show people at overlooks, taking photos, pointing at scenery',
        atmosphere: '- Dramatic natural lighting, panoramic depth, awe-inspiring scale',
      };

    case 'entertainment':
      return {
        people: '- Add excited visitors, families, groups of friends',
        activity: '- Show people at entrances, taking selfies, enjoying attractions',
        atmosphere: '- Energetic vibe, colorful and lively, sense of fun and excitement',
      };

    default:
      return {
        people: '- Add a natural mix of locals and visitors appropriate to the setting',
        activity: '- Show authentic daily life and activity for this type of location',
        atmosphere: '- Professional cinematic lighting with warm, inviting tones',
      };
  }
}

// Batch processing for multiple images
export async function enhanceImages(
  requests: NanoBananaEnhanceRequest[],
  concurrency = 2
): Promise<NanoBananaEnhanceResponse[]> {
  const results: NanoBananaEnhanceResponse[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(request => enhanceImage(request))
    );
    results.push(...batchResults);

    // Add delay between batches to avoid rate limits
    if (i + concurrency < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}
