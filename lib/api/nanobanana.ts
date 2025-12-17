// NanoBanana Pro API - Gemini 2.5 Flash Image (aka "Nano Banana")
// Google's state-of-the-art image generation and editing model
// Docs: https://ai.google.dev/gemini-api/docs/image-generation

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY!;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Gemini 2.5 Flash Image is the "Nano Banana" model
const NANOBANANA_MODEL = 'gemini-2.0-flash-exp-image-generation';

// Default prompt for cinematic enhancement - conservative, preserves original
export const DEFAULT_ENHANCEMENT_PROMPT = `Transform this image into cinematic high-quality footage while maintaining the exact original location, architecture, and spatial layout. Preserve all buildings, street signs, landmarks, and geographic features exactly as they appear. Enhance image quality: improve lighting for natural cinematic look, clean up visual noise and compression artifacts, sharpen details, enhance colors naturally without oversaturation. Remove temporary elements only: remove Google Street View watermarks, blur effects, camera rig artifacts, visible Street View car reflections. Maintain authentic street life: keep real pedestrians, vehicles, and urban activity as present in original. Adjust camera angle only if needed for better composition while keeping same viewpoint and perspective. Shot on cinema camera, photorealistic, natural lighting, clean professional aesthetic, --ar 16:9`;

export interface NanoBananaEnhanceRequest {
  imageUrl: string;
  direction: string;
  poiName: string;
  category?: string;
  customPrompt?: string; // For revisions - allows custom prompt override
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
  // Use custom prompt if provided (for revisions), otherwise use default
  const prompt = request.customPrompt || DEFAULT_ENHANCEMENT_PROMPT;

  try {
    console.log(`NanoBanana: Enhancing "${request.poiName}" - ${request.customPrompt ? 'custom prompt' : 'default prompt'}`);

    // Fetch the source image and convert to base64
    const { base64, mimeType } = await fetchImageAsBase64(request.imageUrl);

    // Call Gemini Image Generation API
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
            temperature: 0.4, // Lower temperature for more consistent, faithful results
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

          console.log('NanoBanana: Successfully enhanced image');
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

// Revise an image with a custom prompt
export async function reviseImage(
  imageUrl: string,
  customPrompt: string,
  poiName: string
): Promise<NanoBananaEnhanceResponse> {
  return enhanceImage({
    imageUrl,
    direction: '',
    poiName,
    customPrompt,
  });
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
