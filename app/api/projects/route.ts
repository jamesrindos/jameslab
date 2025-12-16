import { NextRequest, NextResponse } from 'next/server';
import { createProject, createClipsFromPOIs, updateProjectStatus, updateClip, getClip } from '@/lib/db';
import { discoverRealPOIs } from '@/lib/api/places-poi';
import { getOptimalStreetViewImage } from '@/lib/api/streetview';
import { enhanceImage } from '@/lib/api/nanobanana';
import type { CreateProjectRequest } from '@/types';

// Background pipeline processing - NO Veo, focus on quality images
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

      const { url: streetViewUrl } = await getOptimalStreetViewImage(
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

    // Step 2: Enhance with NanoBanana
    if (clip.street_view_url && !clip.nanobanana_url) {
      await updateClip(clipId, { status: 'enhancing' });

      console.log(`NanoBanana enhancing ${clip.poi_name}`);
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

    // Step 3: Mark as completed (No Veo - focusing on image quality)
    // Use the enhanced image as the final output
    await updateClip(clipId, {
      video_url: clip.nanobanana_url || clip.street_view_url,
      video_thumbnail_url: clip.nanobanana_url || clip.street_view_url,
      status: 'completed',
    });
    console.log(`Clip completed: ${clip.poi_name}`);

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
    let project;
    try {
      project = await createProject({
        location_name: body.location_name,
        location_lat: body.location_lat,
        location_lng: body.location_lng,
        direction: body.direction,
      });
    } catch (dbError) {
      console.error('Database error creating project:', dbError);
      const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      // Check for common infrastructure errors
      if (errorMsg.includes('<!DOCTYPE') || errorMsg.includes('522') || errorMsg.includes('timeout')) {
        return NextResponse.json(
          { error: 'Database temporarily unavailable. Please try again in a moment.' },
          { status: 503 }
        );
      }
      throw dbError;
    }

    // Update status to processing
    await updateProjectStatus(project.id, 'processing');

    // Discover REAL POIs using Google Places API
    console.log(`Discovering real POIs for ${body.location_name}`);
    const realPOIs = await discoverRealPOIs(
      body.location_name,
      body.location_lat,
      body.location_lng,
      4 // Get exactly 4 POIs
    );

    console.log(`Discovered ${realPOIs.length} real POIs:`);
    realPOIs.forEach(poi => console.log(`  - ${poi.name} (${poi.category})`));

    // Convert to the POI format expected by createClipsFromPOIs
    const pois = realPOIs.map(poi => ({
      name: poi.name,
      description: poi.description,
      lat: poi.lat,
      lng: poi.lng,
      relevanceReason: poi.relevanceReason,
      category: poi.category,
    }));

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
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Clean up HTML error responses from infrastructure issues
    if (errorMsg.includes('<!DOCTYPE') || errorMsg.includes('522') || errorMsg.includes('Connection timed out')) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: errorMsg.length > 200 ? 'An unexpected error occurred' : errorMsg },
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
