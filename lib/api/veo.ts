// Video generation integration
// Note: Google Veo API is not yet publicly available.
// This module is prepared for when it becomes available.
// For now, clips are marked complete with just the image.
// Can be extended to use:
// - Runway ML Gen-3
// - Pika Labs
// - Stable Video Diffusion via Replicate

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
  // Video generation API not yet available
  // Return success with the image URL as a placeholder
  // When Veo or another API becomes available, implement here

  console.log(`Video generation: using image as placeholder for "${request.direction}"`);

  // Return the image URL as both video and thumbnail
  // The UI will display the image in place of video
  return {
    success: true,
    videoUrl: request.imageUrl, // Image URL as placeholder
    thumbnailUrl: request.imageUrl,
  };
}

export async function checkOperationStatus(
  operationId: string
): Promise<VeoOperationStatus> {
  // Not needed with passthrough implementation
  return {
    done: true,
    videoUrl: operationId, // operationId contains the image URL in passthrough mode
    thumbnailUrl: operationId,
  };
}

export async function pollForCompletion(
  operationId: string,
  options?: {
    maxWaitMs?: number;
    pollIntervalMs?: number;
  }
): Promise<VeoOperationStatus> {
  // Not needed with passthrough implementation
  return {
    done: true,
    videoUrl: operationId,
    thumbnailUrl: operationId,
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
