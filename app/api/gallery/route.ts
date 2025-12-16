import { NextResponse } from 'next/server';
import { getAllClipsWithProjects, getAllProjects } from '@/lib/db';
import type { Clip, Project } from '@/types';

export async function GET() {
  try {
    // Fetch clips and projects separately for better error isolation
    let clips: (Clip & { project: Project })[] = [];
    let projects: Project[] = [];

    try {
      clips = await getAllClipsWithProjects();
    } catch (clipError) {
      console.error('Error fetching clips:', clipError);
      // Continue with empty clips rather than failing entirely
    }

    try {
      projects = await getAllProjects();
    } catch (projectError) {
      console.error('Error fetching projects:', projectError);
      // Continue with empty projects rather than failing entirely
    }

    return NextResponse.json({
      clips,
      projects,
    });
  } catch (error) {
    console.error('Error in gallery route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
