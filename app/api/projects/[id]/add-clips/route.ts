import { NextRequest, NextResponse } from 'next/server';
import { getProject, createClipsFromPOIs, updateClip, getClip, updateProjectStatus } from '@/lib/db';
import { discoverRealPOIs, getPlacePhotoUrl } from '@/lib/api/places-poi';
import { getOptimalStreetViewImage } from '@/lib/api/streetview';
import { enhanceImage } from '@/lib/api/nanobanana';

// Background pipeline processing for new clips
async function processNewClips(
  projectId: string,
  direction: string,
  clipIds: string[]
) {
  try {
    // Set project to processing while we add new clips
    await updateProjectStatus(projectId, 'processing');

    for (const clipId of clipIds) {
      await processClip(clipId, direction);
    }

    // Check final status
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

    // Step 1: Get primary image - prefer Place Photo over Street View
    let primaryImageUrl: string | null = null;

    await updateClip(clipId, { status: 'fetching_streetview' });

    // Try Place Photo first (curated images of the actual location)
    if (clip.photo_reference) {
      console.log(`Fetching Place Photo for ${clip.poi_name}...`);
      const placePhotoUrl = await getPlacePhotoUrl(clip.photo_reference, 1200);
      if (placePhotoUrl) {
        primaryImageUrl = placePhotoUrl;
        clip = await updateClip(clipId, { place_photo_url: placePhotoUrl });
        console.log(`Place Photo fetched for ${clip.poi_name}`);
      }
    }

    // Fall back to Street View if no Place Photo
    if (!primaryImageUrl) {
      console.log(`No Place Photo, trying Street View for ${clip.poi_name}...`);
      const { url: streetViewUrl } = await getOptimalStreetViewImage(
        clip.poi_lat,
        clip.poi_lng,
        clip.poi_name,
        clip.poi_category
      );

      if (streetViewUrl) {
        primaryImageUrl = streetViewUrl;
        clip = await updateClip(clipId, { street_view_url: streetViewUrl });
        console.log(`Street View fetched for ${clip.poi_name}`);
      }
    }

    // If we still don't have an image, fail
    if (!primaryImageUrl) {
      await updateClip(clipId, {
        status: 'failed',
        error_message: 'No imagery available for this location',
      });
      return;
    }

    // Step 2: Enhance with NanoBanana
    const sourceImageUrl = clip.place_photo_url || clip.street_view_url;
    if (sourceImageUrl && !clip.nanobanana_url) {
      await updateClip(clipId, { status: 'enhancing' });

      console.log(`NanoBanana enhancing ${clip.poi_name}`);
      const result = await enhanceImage({
        imageUrl: sourceImageUrl,
        direction,
        poiName: clip.poi_name,
        category: clip.poi_category,
      });

      if (result.success && result.enhancedImageUrl) {
        clip = await updateClip(clipId, { nanobanana_url: result.enhancedImageUrl });
        console.log(`NanoBanana completed for ${clip.poi_name}`);
      } else {
        // Use original as fallback
        clip = await updateClip(clipId, { nanobanana_url: sourceImageUrl });
        console.log(`NanoBanana fallback for ${clip.poi_name}: ${result.error}`);
      }
    }

    // Step 3: Mark as completed
    const finalImageUrl = clip.nanobanana_url || clip.place_photo_url || clip.street_view_url;
    await updateClip(clipId, {
      video_url: finalImageUrl,
      video_thumbnail_url: finalImageUrl,
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { location_name, location_lat, location_lng } = body;

    if (!location_name || typeof location_lat !== 'number' || typeof location_lng !== 'number') {
      return NextResponse.json(
        { error: 'location_name, location_lat, and location_lng are required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log(`Adding new clips to project ${project.name || project.location_name} from ${location_name}`);

    // Discover POIs for the new location
    const realPOIs = await discoverRealPOIs(
      location_name,
      location_lat,
      location_lng,
      4 // Get 4 POIs
    );

    console.log(`Discovered ${realPOIs.length} POIs for ${location_name}`);

    // Convert to the POI format expected by createClipsFromPOIs
    const pois = realPOIs.map(poi => ({
      name: poi.name,
      description: poi.description,
      lat: poi.lat,
      lng: poi.lng,
      relevanceReason: poi.relevanceReason,
      category: poi.category,
      placeId: poi.placeId,
      photoReference: poi.photoReference,
    }));

    // Create new clips for this project
    const clips = await createClipsFromPOIs(id, pois);

    // Process the new clips in the background
    processNewClips(id, project.direction, clips.map(c => c.id)).catch(err => {
      console.error('Error processing new clips:', err);
    });

    return NextResponse.json({
      success: true,
      clips,
      message: `Added ${clips.length} new clips from ${location_name}`,
    });
  } catch (error) {
    console.error('Error adding clips to project:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
