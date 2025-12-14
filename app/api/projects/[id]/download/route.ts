import { NextRequest, NextResponse } from 'next/server';
import { getProject, getClipsByProject } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const clips = await getClipsByProject(id);
    const completedClips = clips.filter(c => c.status === 'completed');

    if (completedClips.length === 0) {
      return NextResponse.json(
        { error: 'No completed clips available for download' },
        { status: 404 }
      );
    }

    // Return list of download URLs
    const downloads = completedClips.map(clip => {
      const safeName = clip.poi_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      return {
        clip_id: clip.id,
        poi_name: clip.poi_name,
        video_url: clip.video_url,
        enhanced_url: clip.nanobanana_url,
        original_url: clip.street_view_url,
        filename_base: safeName
      };
    });

    return NextResponse.json({
      project_id: project.id,
      location_name: project.location_name,
      total_clips: completedClips.length,
      downloads
    });
  } catch (error) {
    console.error('Error preparing bulk download:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
