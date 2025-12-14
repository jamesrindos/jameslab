// Google Veo 3.1 API integration for video generation

const GOOGLE_VEO_API_KEY = process.env.GOOGLE_VEO_API_KEY!;
const GOOGLE_VEO_API_URL = process.env.GOOGLE_VEO_API_URL || 'https://generativelanguage.googleapis.com/v1beta';

export interface VeoGenerateRequest {
  imageUrl: string;
  direction: string;
  duration?: number; // 4-6 seconds
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

export async function generateVideo(
  request: VeoGenerateRequest
): Promise<VeoGenerateResponse> {
  const prompt = buildVideoPrompt(request.direction, request.cameraMotion);

  try {
    const response = await fetch(`${GOOGLE_VEO_API_URL}/models/veo-3.1:generateVideo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GOOGLE_VEO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: {
          url: request.imageUrl,
        },
        prompt,
        config: {
          duration_seconds: request.duration || 5,
          output_format: 'mp4',
          resolution: '1080p',
          fps: 24,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Veo returns an operation ID for async processing
    if (data.name) {
      return {
        success: true,
        operationId: data.name,
      };
    }

    // If video is immediately available (unlikely)
    if (data.video?.url) {
      return {
        success: true,
        videoUrl: data.video.url,
        thumbnailUrl: data.video.thumbnail_url,
      };
    }

    throw new Error('Unexpected API response format');
  } catch (error) {
    console.error('Veo API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkOperationStatus(
  operationId: string
): Promise<VeoOperationStatus> {
  try {
    const response = await fetch(`${GOOGLE_VEO_API_URL}/${operationId}`, {
      headers: {
        'Authorization': `Bearer ${GOOGLE_VEO_API_KEY}`,
      },
    });

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

      return {
        done: true,
        videoUrl: data.response?.video?.url,
        thumbnailUrl: data.response?.video?.thumbnail_url,
      };
    }

    return { done: false };
  } catch (error) {
    console.error('Error checking operation status:', error);
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
  const maxWait = options?.maxWaitMs || 120000; // 2 minutes default
  const pollInterval = options?.pollIntervalMs || 5000; // 5 seconds default
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const status = await checkOperationStatus(operationId);

    if (status.done) {
      return status;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    done: true,
    error: 'Operation timed out',
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
    static: 'minimal movement, focus on atmospheric elements',
  };

  const motion = cameraMotion
    ? motionDescriptions[cameraMotion]
    : 'subtle cinematic motion with slow push-in or gentle pan';

  return `Subtle cinematic motion. ${direction}.
Camera: ${motion}.
Duration: 4-6 seconds.
Maintain photorealistic quality, no morphing artifacts.
Keep the movement smooth and professional.
Preserve the atmosphere and mood of the original image.`;
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
