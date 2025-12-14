import { NextResponse } from 'next/server';
import { getAllClipsWithProjects, getAllProjects } from '@/lib/db';

export async function GET() {
  try {
    const [clips, projects] = await Promise.all([
      getAllClipsWithProjects(),
      getAllProjects(),
    ]);

    return NextResponse.json({
      clips,
      projects,
    });
  } catch (error) {
    console.error('Error fetching gallery data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
