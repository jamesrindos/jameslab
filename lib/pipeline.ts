// Pipeline orchestration for b-roll generation
import { updateClip, updateProjectStatus, getClip } from './db';
import { getOptimalStreetViewImage } from './api/streetview';
import { enhanceImage } from './api/nanobanana';
import { generateVideo, pollForCompletion, suggestCameraMotion } from './api/veo';
import type { Clip, Project } from '@/types';

export interface PipelineOptions {
  skipStreetView?: boolean;
  skipEnhancement?: boolean;
  skipVideoGeneration?: boolean;
}

export async function processClip(
  clip: Clip,
  direction: string,
  options?: PipelineOptions
): Promise<Clip> {
  let currentClip = clip;

  try {
    console.log(`Pipeline processing: ${clip.poi_name} (${clip.poi_category})`);

    // Step 1: Fetch optimal Street View imagery
    if (!options?.skipStreetView && !currentClip.street_view_url) {
      await updateClip(clip.id, { status: 'fetching_streetview' });

      const { url: streetViewUrl } = await getOptimalStreetViewImage(
        clip.poi_lat,
        clip.poi_lng,
        clip.poi_name,
        clip.poi_category
      );

      if (streetViewUrl) {
        currentClip = await updateClip(clip.id, {
          street_view_url: streetViewUrl,
        });
      } else {
        // No Street View available - mark as failed
        return await updateClip(clip.id, {
          status: 'failed',
          error_message: 'No Street View imagery available for this location',
        });
      }
    }

    // Step 2: Stage scene with NanoBanana
    if (!options?.skipEnhancement && currentClip.street_view_url && !currentClip.nanobanana_url) {
      await updateClip(clip.id, { status: 'enhancing' });

      const enhanceResult = await enhanceImage({
        imageUrl: currentClip.street_view_url,
        direction,
        poiName: clip.poi_name,
        category: clip.poi_category,
      });

      if (enhanceResult.success && enhanceResult.enhancedImageUrl) {
        currentClip = await updateClip(clip.id, {
          nanobanana_url: enhanceResult.enhancedImageUrl,
        });
      } else {
        // Enhancement failed - continue with original image
        console.warn(`Enhancement failed for clip ${clip.id}:`, enhanceResult.error);
        currentClip = await updateClip(clip.id, {
          nanobanana_url: currentClip.street_view_url, // Use original as fallback
        });
      }
    }

    // Step 3: Generate video with Veo
    if (!options?.skipVideoGeneration && currentClip.nanobanana_url && !currentClip.video_url) {
      await updateClip(clip.id, { status: 'generating_video' });

      const imageUrl = currentClip.nanobanana_url;
      const cameraMotion = suggestCameraMotion(direction);

      const generateResult = await generateVideo({
        imageUrl,
        direction,
        cameraMotion,
        duration: 5,
      });

      if (generateResult.success) {
        if (generateResult.videoUrl) {
          // Video immediately available
          currentClip = await updateClip(clip.id, {
            video_url: generateResult.videoUrl,
            video_thumbnail_url: generateResult.thumbnailUrl || currentClip.nanobanana_url,
            status: 'completed',
          });
        } else if (generateResult.operationId) {
          // Poll for completion
          const operationResult = await pollForCompletion(generateResult.operationId, {
            maxWaitMs: 300000, // 5 minutes
            pollIntervalMs: 10000,
          });

          if (operationResult.videoUrl) {
            currentClip = await updateClip(clip.id, {
              video_url: operationResult.videoUrl,
              video_thumbnail_url: operationResult.thumbnailUrl || currentClip.nanobanana_url,
              status: 'completed',
            });
          } else {
            throw new Error(operationResult.error || 'Video generation failed');
          }
        }
      } else {
        throw new Error(generateResult.error || 'Video generation failed');
      }
    }

    // If we skipped video generation, mark as completed with what we have
    if (options?.skipVideoGeneration && currentClip.nanobanana_url) {
      currentClip = await updateClip(clip.id, { status: 'completed' });
    }

    return currentClip;
  } catch (error) {
    console.error(`Error processing clip ${clip.id}:`, error);
    return await updateClip(clip.id, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function processProject(
  project: Project,
  clips: Clip[],
  options?: PipelineOptions
): Promise<void> {
  try {
    await updateProjectStatus(project.id, 'processing');

    // Process clips sequentially to avoid rate limits
    for (const clip of clips) {
      await processClip(clip, project.direction, options);
    }

    // Check if all clips completed successfully
    const processedClips = await Promise.all(
      clips.map(c => getClip(c.id))
    );

    const allFailed = processedClips.every(
      c => c?.status === 'failed'
    );

    if (allFailed) {
      await updateProjectStatus(project.id, 'failed');
    } else {
      await updateProjectStatus(project.id, 'completed');
    }
  } catch (error) {
    console.error(`Error processing project ${project.id}:`, error);
    await updateProjectStatus(project.id, 'failed');
  }
}

// Process clips in parallel with concurrency limit
export async function processClipsInParallel(
  clips: Clip[],
  direction: string,
  concurrency = 3,
  options?: PipelineOptions
): Promise<Clip[]> {
  const results: Clip[] = [];

  for (let i = 0; i < clips.length; i += concurrency) {
    const batch = clips.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(clip => processClip(clip, direction, options))
    );
    results.push(...batchResults);
  }

  return results;
}
