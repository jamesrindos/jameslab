import { NextRequest, NextResponse } from 'next/server';
import { createProject, createClipsFromPOIs, updateProjectStatus } from '@/lib/db';
import { generatePOIs, generateFallbackPOIs } from '@/lib/api/gemini';
import type { CreateProjectRequest } from '@/types';

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
      pois = await generatePOIs(body.location_name, body.direction);
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
