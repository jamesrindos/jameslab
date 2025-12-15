// Google Veo video generation via Gemini API
// Requires paid tier API key for Veo access
// Docs: https://ai.google.dev/gemini-api/docs/video

const GOOGLE_VEO_API_KEY = process.env.GOOGLE_VEO_API_KEY!;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Use veo-2.0 as it's more widely available, fallback behavior if not accessible
const VEO_MODEL = 'veo-2.0-generate-001';

export interface VeoGenerateRequest {
  imageUrl: string;
  direction: string;
  duration?: number; // 5-8 seconds
  cameraMotion?: 'push_in' | 'pull_out' | 'pan_left' | 'pan_right' | 'parallax' | 'static';
}

export interface VeoGenerateResponse {
  success: boolean;
  operationId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface VeoOperationStatus {
  done: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
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

export async function generateVideo(
  request: VeoGenerateRequest
): Promise<VeoGenerateResponse> {
  const prompt = buildVideoPrompt(request.direction, request.cameraMotion);

  try {
    console.log(`Veo: Starting video generation for "${request.direction}"`);

    // Fetch the source image and convert to base64
    const { base64, mimeType } = await fetchImageAsBase64(request.imageUrl);

    // Call Veo API
    const response = await fetch(
      `${GEMINI_API_URL}/models/${VEO_MODEL}:generateVideos?key=${GOOGLE_VEO_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: prompt,
              image: {
                bytesBase64Encoded: base64,
                mimeType: mimeType,
              },
            },
          ],
          parameters: {
            aspectRatio: '16:9',
            durationSeconds: request.duration || 5,
            personGeneration: 'allow_all',
            numberOfVideos: 1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API error: ${response.status}`;

      // Check if it's a quota/access error
      if (response.status === 403 || response.status === 429) {
        console.warn('Veo: API access denied - falling back to image passthrough');
        return {
          success: true,
          videoUrl: request.imageUrl,
          thumbnailUrl: request.imageUrl,
        };
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Veo: API response received', JSON.stringify(data).slice(0, 200));

    // Veo returns an operation for async processing
    if (data.name) {
      return {
        success: true,
        operationId: data.name,
      };
    }

    // If video is immediately available
    if (data.predictions?.[0]?.video) {
      const videoData = data.predictions[0].video;
      return {
        success: true,
        videoUrl: videoData.uri || videoData.url,
        thumbnailUrl: request.imageUrl,
      };
    }

    // Fallback to image if unexpected response
    console.warn('Veo: Unexpected response format, using image fallback');
    return {
      success: true,
      videoUrl: request.imageUrl,
      thumbnailUrl: request.imageUrl,
    };
  } catch (error) {
    console.error('Veo API error:', error);

    // Graceful fallback to image
    return {
      success: true,
      videoUrl: request.imageUrl,
      thumbnailUrl: request.imageUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkOperationStatus(
  operationId: string
): Promise<VeoOperationStatus> {
  try {
    const response = await fetch(
      `${GEMINI_API_URL}/${operationId}?key=${GOOGLE_VEO_API_KEY}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.done) {
      if (data.error) {
        return {
          done: true,
          error: data.error.message || 'Operation failed',
        };
      }

      // Extract video URL from response
      const videoUrl = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                       data.response?.videos?.[0]?.uri ||
                       data.metadata?.generatedVideos?.[0]?.video?.uri;

      return {
        done: true,
        videoUrl: videoUrl,
        thumbnailUrl: videoUrl, // Use video URL as thumbnail for now
      };
    }

    return { done: false };
  } catch (error) {
    console.error('Error checking Veo operation status:', error);
    return {
      done: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function pollForCompletion(
  operationId: string,
  options?: {
    maxWaitMs?: number;
    pollIntervalMs?: number;
  }
): Promise<VeoOperationStatus> {
  const maxWait = options?.maxWaitMs || 300000; // 5 minutes for video generation
  const pollInterval = options?.pollIntervalMs || 10000; // 10 seconds
  const startTime = Date.now();

  console.log(`Veo: Polling operation ${operationId}`);

  while (Date.now() - startTime < maxWait) {
    const status = await checkOperationStatus(operationId);

    if (status.done) {
      console.log(`Veo: Operation completed`, status.videoUrl ? 'with video' : 'with error');
      return status;
    }

    console.log(`Veo: Still processing... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    done: true,
    error: 'Video generation timed out after 5 minutes',
  };
}

function buildVideoPrompt(
  direction: string,
  cameraMotion?: VeoGenerateRequest['cameraMotion']
): string {
  const motionDescriptions: Record<string, string> = {
    push_in: 'slow cinematic push-in toward the subject',
    pull_out: 'gentle pull-out revealing more of the scene',
    pan_left: 'smooth horizontal pan from right to left',
    pan_right: 'smooth horizontal pan from left to right',
    parallax: 'subtle parallax drift with depth separation',
    static: 'minimal movement, focus on atmospheric elements like clouds or leaves',
  };

  const motion = cameraMotion
    ? motionDescriptions[cameraMotion]
    : 'subtle cinematic motion with slow push-in or gentle pan';

  return `Cinematic b-roll footage. ${direction}. Camera movement: ${motion}. Photorealistic quality, smooth motion, no morphing artifacts. Preserve the atmosphere and lighting of the original scene.`;
}

// Helper to determine best camera motion based on scene
export function suggestCameraMotion(
  direction: string
): VeoGenerateRequest['cameraMotion'] {
  const dirLower = direction.toLowerCase();

  if (dirLower.includes('architecture') || dirLower.includes('building') || dirLower.includes('landmark')) {
    return 'push_in';
  }

  if (dirLower.includes('landscape') || dirLower.includes('vista') || dirLower.includes('panorama')) {
    return 'pan_right';
  }

  if (dirLower.includes('street') || dirLower.includes('market') || dirLower.includes('crowd')) {
    return 'parallax';
  }

  if (dirLower.includes('moody') || dirLower.includes('atmospheric') || dirLower.includes('calm')) {
    return 'static';
  }

  return 'push_in'; // Default
}
