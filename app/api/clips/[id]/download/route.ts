import { NextRequest, NextResponse } from 'next/server';
import { getClip } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'video';

    if (!id) {
      return NextResponse.json(
        { error: 'Clip ID is required' },
        { status: 400 }
      );
    }

    const clip = await getClip(id);

    if (!clip) {
      return NextResponse.json(
        { error: 'Clip not found' },
        { status: 404 }
      );
    }

    let downloadUrl: string | undefined;
    let filename: string;
    const safeName = clip.poi_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    switch (type) {
      case 'video':
        downloadUrl = clip.video_url || undefined;
        filename = `${safeName}_video.mp4`;
        break;
      case 'enhanced':
        downloadUrl = clip.nanobanana_url || undefined;
        filename = `${safeName}_enhanced.jpg`;
        break;
      case 'original':
        downloadUrl = clip.street_view_url || undefined;
        filename = `${safeName}_original.jpg`;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be video, enhanced, or original' },
          { status: 400 }
        );
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: `No ${type} available for this clip` },
        { status: 404 }
      );
    }

    // For external URLs, redirect to the download URL
    // In production, you might want to proxy through your server for better control
    return NextResponse.json({
      url: downloadUrl,
      filename,
      clip_id: clip.id,
      poi_name: clip.poi_name
    });
  } catch (error) {
    console.error('Error preparing download:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
