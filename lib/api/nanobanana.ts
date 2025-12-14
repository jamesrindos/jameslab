// NanoBanana Pro API integration for cinematic image enhancement

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY!;
const NANOBANANA_API_URL = process.env.NANOBANANA_API_URL || 'https://api.nanobanana.pro/v1';

export interface NanoBananaEnhanceRequest {
  imageUrl: string;
  direction: string;
  style?: 'cinematic' | 'documentary' | 'commercial' | 'artistic';
}

export interface NanoBananaEnhanceResponse {
  success: boolean;
  enhancedImageUrl?: string;
  error?: string;
}

export async function enhanceImage(
  request: NanoBananaEnhanceRequest,
  maxRetries = 3
): Promise<NanoBananaEnhanceResponse> {
  const prompt = buildEnhancementPrompt(request.direction);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${NANOBANANA_API_URL}/enhance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NANOBANANA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: request.imageUrl,
          prompt,
          style: request.style || 'cinematic',
          preserve_aspect_ratio: true,
          output_format: 'png',
          quality: 'high',
        }),
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        enhancedImageUrl: data.output_url || data.url,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`NanoBanana API attempt ${attempt + 1} failed:`, lastError.message);

      // Exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt + 1) * 1000)
        );
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
  };
}

function buildEnhancementPrompt(direction: string): string {
  return `Transform this street-level photograph into a cinematic film still.
Style: ${direction}.
Maintain location authenticity while enhancing:
- Color grading (cinematic LUT style)
- Depth of field simulation
- Atmospheric haze/golden hour if applicable
- Remove UI artifacts, watermarks, Google branding
Keep the image photorealistic and professional.`;
}

// Batch processing for multiple images
export async function enhanceImages(
  requests: NanoBananaEnhanceRequest[],
  concurrency = 3
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
