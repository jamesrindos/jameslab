import { NextRequest, NextResponse } from 'next/server';
import { getProject, getClipsByProject, updateClip, updateProjectStatus } from '@/lib/db';
import { getOptimalStreetViewImage } from '@/lib/api/streetview';
import { enhanceImage } from '@/lib/api/nanobanana';
import { generateVideo, pollForCompletion, suggestCameraMotion } from '@/lib/api/veo';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const clips = await getClipsByProject(id);
    if (clips.length === 0) {
      return NextResponse.json({ error: 'No clips found for project' }, { status: 400 });
    }

    // Start processing in background
    processProjectPipeline(project.id, project.direction, clips.map(c => c.id));

    return NextResponse.json({
      message: 'Processing started',
      project_id: project.id,
      clip_count: clips.length
    });
  } catch (error) {
    console.error('Error starting pipeline:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processProjectPipeline(
  projectId: string,
  direction: string,
  clipIds: string[]
) {
  try {
    await updateProjectStatus(projectId, 'processing');

    for (const clipId of clipIds) {
      await processClip(clipId, direction);
    }

    // Check final status
    const finalClips = await getClipsByProject(projectId);
    const allFailed = finalClips.every(c => c.status === 'failed');

    await updateProjectStatus(projectId, allFailed ? 'failed' : 'completed');
  } catch (error) {
    console.error(`Pipeline error for project ${projectId}:`, error);
    await updateProjectStatus(projectId, 'failed');
  }
}

async function processClip(clipId: string, direction: string) {
  try {
    // Get current clip state
    const { getClip } = await import('@/lib/db');
    let clip = await getClip(clipId);
    if (!clip) return;

    console.log(`Processing clip: ${clip.poi_name} (${clip.poi_category})`);

    // Step 1: Fetch optimal Street View
    if (!clip.street_view_url) {
      await updateClip(clipId, { status: 'fetching_streetview' });

      const { url: streetViewUrl } = await getOptimalStreetViewImage(
        clip.poi_lat,
        clip.poi_lng,
        clip.poi_name,
        clip.poi_category
      );

      if (streetViewUrl) {
        clip = await updateClip(clipId, { street_view_url: streetViewUrl });
      } else {
        await updateClip(clipId, {
          status: 'failed',
          error_message: 'No Street View coverage available',
        });
        return;
      }
    }

    // Step 2: Stage scene with NanoBanana
    if (clip.street_view_url && !clip.nanobanana_url) {
      await updateClip(clipId, { status: 'enhancing' });

      const result = await enhanceImage({
        imageUrl: clip.street_view_url,
        direction,
        poiName: clip.poi_name,
        category: clip.poi_category,
      });

      if (result.success && result.enhancedImageUrl) {
        clip = await updateClip(clipId, { nanobanana_url: result.enhancedImageUrl });
      } else {
        // Use original as fallback
        clip = await updateClip(clipId, { nanobanana_url: clip.street_view_url });
      }
    }

    // Step 3: Generate video with Veo
    if (clip.nanobanana_url && !clip.video_url) {
      await updateClip(clipId, { status: 'generating_video' });

      const cameraMotion = suggestCameraMotion(direction);
      const result = await generateVideo({
        imageUrl: clip.nanobanana_url,
        direction,
        cameraMotion,
        duration: 5,
      });

      if (result.success) {
        if (result.videoUrl) {
          await updateClip(clipId, {
            video_url: result.videoUrl,
            video_thumbnail_url: result.thumbnailUrl || clip.nanobanana_url,
            status: 'completed',
          });
        } else if (result.operationId) {
          const pollResult = await pollForCompletion(result.operationId, {
            maxWaitMs: 300000,
            pollIntervalMs: 10000,
          });

          if (pollResult.videoUrl) {
            await updateClip(clipId, {
              video_url: pollResult.videoUrl,
              video_thumbnail_url: pollResult.thumbnailUrl || clip.nanobanana_url,
              status: 'completed',
            });
          } else {
            throw new Error(pollResult.error || 'Video generation failed');
          }
        }
      } else {
        throw new Error(result.error || 'Video generation failed');
      }
    }
  } catch (error) {
    console.error(`Error processing clip ${clipId}:`, error);
    await updateClip(clipId, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
