import { NextRequest, NextResponse } from 'next/server';
import { createProject, createClipsFromPOIs, updateProjectStatus, updateClip, getClip } from '@/lib/db';
import { generatePOIs, generateFallbackPOIs } from '@/lib/api/gemini';
import { getOptimalStreetViewImage } from '@/lib/api/streetview';
import { enhanceImage } from '@/lib/api/nanobanana';
import { generateVideo, pollForCompletion, suggestCameraMotion } from '@/lib/api/veo';
import type { CreateProjectRequest } from '@/types';

// Background pipeline processing
async function triggerPipelineProcessing(
  projectId: string,
  direction: string,
  clipIds: string[]
) {
  // Process asynchronously without blocking the response
  processClipsSequentially(projectId, direction, clipIds).catch(err => {
    console.error('Pipeline processing error:', err);
  });
}

async function processClipsSequentially(
  projectId: string,
  direction: string,
  clipIds: string[]
) {
  try {
    for (const clipId of clipIds) {
      await processClip(clipId, direction);
    }

    // Update project status based on clip results
    const { getClipsByProject } = await import('@/lib/db');
    const finalClips = await getClipsByProject(projectId);
    const allFailed = finalClips.every(c => c.status === 'failed');
    const allCompleted = finalClips.every(c => c.status === 'completed' || c.status === 'failed');

    if (allCompleted) {
      await updateProjectStatus(projectId, allFailed ? 'failed' : 'completed');
    }
  } catch (error) {
    console.error(`Pipeline error for project ${projectId}:`, error);
    await updateProjectStatus(projectId, 'failed');
  }
}

async function processClip(clipId: string, direction: string) {
  try {
    let clip = await getClip(clipId);
    if (!clip) return;

    console.log(`Processing clip: ${clip.poi_name} (${clip.poi_category})`);

    // Step 1: Fetch optimal Street View
    if (!clip.street_view_url) {
      await updateClip(clipId, { status: 'fetching_streetview' });

      const { url: streetViewUrl, metadata } = await getOptimalStreetViewImage(
        clip.poi_lat,
        clip.poi_lng,
        clip.poi_name,
        clip.poi_category
      );

      if (streetViewUrl) {
        clip = await updateClip(clipId, { street_view_url: streetViewUrl });
        console.log(`Street View fetched for ${clip.poi_name}`);
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

      console.log(`NanoBanana staging scene for ${clip.poi_name}`);
      const result = await enhanceImage({
        imageUrl: clip.street_view_url,
        direction,
        poiName: clip.poi_name,
        category: clip.poi_category,
      });

      if (result.success && result.enhancedImageUrl) {
        clip = await updateClip(clipId, { nanobanana_url: result.enhancedImageUrl });
        console.log(`NanoBanana completed for ${clip.poi_name}`);
      } else {
        // Use original as fallback
        clip = await updateClip(clipId, { nanobanana_url: clip.street_view_url });
        console.log(`NanoBanana fallback for ${clip.poi_name}: ${result.error}`);
      }
    }

    // Step 3: Generate video with Veo
    if (clip.nanobanana_url && !clip.video_url) {
      await updateClip(clipId, { status: 'generating_video' });

      console.log(`Veo generating video for ${clip.poi_name}`);
      const cameraMotion = suggestCameraMotion(direction);
      const result = await generateVideo({
        imageUrl: clip.nanobanana_url,
        direction,
        cameraMotion,
        duration: 5,
      });

      if (result.success) {
        if (result.videoUrl) {
          // Check if it's a real video URL or just an image fallback
          const isVideo = !result.videoUrl.startsWith('data:image') &&
                          !result.videoUrl.includes('streetviewpixels');

          await updateClip(clipId, {
            video_url: result.videoUrl,
            video_thumbnail_url: result.thumbnailUrl || clip.nanobanana_url,
            status: 'completed',
          });
          console.log(`Veo completed for ${clip.poi_name} (isVideo: ${isVideo})`);
        } else if (result.operationId) {
          console.log(`Veo polling operation for ${clip.poi_name}`);
          const pollResult = await pollForCompletion(result.operationId, {
            maxWaitMs: 300000, // 5 minutes
            pollIntervalMs: 10000, // 10 seconds
          });

          if (pollResult.videoUrl) {
            await updateClip(clipId, {
              video_url: pollResult.videoUrl,
              video_thumbnail_url: pollResult.thumbnailUrl || clip.nanobanana_url,
              status: 'completed',
            });
            console.log(`Veo poll completed for ${clip.poi_name}`);
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

export async function POST(request: NextRequest) {
  try {
    const body: CreateProjectRequest = await request.json();

    // Validate request body
    if (!body.location_name || !body.direction) {
      return NextResponse.json(
        { error: 'location_name and direction are required' },
        { status: 400 }
      );
    }

    if (typeof body.location_lat !== 'number' || typeof body.location_lng !== 'number') {
      return NextResponse.json(
        { error: 'location_lat and location_lng must be numbers' },
        { status: 400 }
      );
    }

    // Create the project in the database
    const project = await createProject({
      location_name: body.location_name,
      location_lat: body.location_lat,
      location_lng: body.location_lng,
      direction: body.direction,
    });

    // Update status to processing
    await updateProjectStatus(project.id, 'processing');

    // Generate POIs using Gemini
    let pois;
    try {
      console.log(`Generating POIs for ${body.location_name}`);
      pois = await generatePOIs(body.location_name, body.direction);
      console.log(`Generated ${pois.length} POIs`);
    } catch (error) {
      console.error('Failed to generate POIs with Gemini, using fallback:', error);
      pois = generateFallbackPOIs(
        body.location_name,
        body.location_lat,
        body.location_lng
      );
    }

    // Create clips for each POI
    const clips = await createClipsFromPOIs(project.id, pois);

    // Trigger pipeline processing in background
    triggerPipelineProcessing(project.id, body.direction, clips.map(c => c.id));

    return NextResponse.json({
      project: { ...project, status: 'processing' },
      pois,
      clips,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { getAllProjects } = await import('@/lib/db');
    const projects = await getAllProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
