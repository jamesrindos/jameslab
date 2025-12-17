import { NextRequest, NextResponse } from 'next/server';
import { getClip, updateClip } from '@/lib/db';
import { reviseImage, DEFAULT_ENHANCEMENT_PROMPT } from '@/lib/api/nanobanana';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    // Get the clip
    const clip = await getClip(id);
    if (!clip) {
      return NextResponse.json(
        { error: 'Clip not found' },
        { status: 404 }
      );
    }

    // Get the original source image (Place Photo or Street View)
    const sourceImageUrl = clip.place_photo_url || clip.street_view_url;
    if (!sourceImageUrl) {
      return NextResponse.json(
        { error: 'No source image available for revision' },
        { status: 400 }
      );
    }

    // Update clip status to indicate revision in progress
    await updateClip(id, { status: 'enhancing' });

    console.log(`Revising clip ${id} (${clip.poi_name}) with custom prompt`);

    // Run NanoBanana with custom prompt
    const result = await reviseImage(sourceImageUrl, prompt, clip.poi_name);

    if (result.success && result.enhancedImageUrl) {
      // Update clip with new enhanced image
      const updatedClip = await updateClip(id, {
        nanobanana_url: result.enhancedImageUrl,
        video_url: result.enhancedImageUrl,
        video_thumbnail_url: result.enhancedImageUrl,
        status: 'completed',
      });

      return NextResponse.json({
        success: true,
        clip: updatedClip,
      });
    } else {
      // Revision failed, restore completed status
      await updateClip(id, { status: 'completed' });

      return NextResponse.json(
        { error: result.error || 'Revision failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error revising clip:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET to retrieve the default prompt
export async function GET() {
  return NextResponse.json({
    defaultPrompt: DEFAULT_ENHANCEMENT_PROMPT,
  });
}
