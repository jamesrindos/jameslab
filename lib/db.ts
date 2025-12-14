import { createClient } from '@supabase/supabase-js';
import type { Project, Clip, POI } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Project operations
export async function createProject(data: {
  location_name: string;
  location_lat: number;
  location_lng: number;
  direction: string;
}): Promise<Project> {
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      location_name: data.location_name,
      location_lat: data.location_lat,
      location_lng: data.location_lng,
      direction: data.direction,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return project;
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get project: ${error.message}`);
  }
  return data;
}

export async function updateProjectStatus(
  id: string,
  status: Project['status']
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', id);

  if (error) throw new Error(`Failed to update project status: ${error.message}`);
}

export async function getAllProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get projects: ${error.message}`);
  return data || [];
}

// Clip operations
export async function createClipsFromPOIs(
  projectId: string,
  pois: POI[]
): Promise<Clip[]> {
  const clipsToInsert = pois.map((poi) => ({
    project_id: projectId,
    poi_name: poi.name,
    poi_lat: poi.lat,
    poi_lng: poi.lng,
    poi_description: poi.description,
    relevance_reason: poi.relevanceReason,
    status: 'pending' as const,
  }));

  const { data, error } = await supabase
    .from('clips')
    .insert(clipsToInsert)
    .select();

  if (error) throw new Error(`Failed to create clips: ${error.message}`);
  return data || [];
}

export async function getClipsByProject(projectId: string): Promise<Clip[]> {
  const { data, error } = await supabase
    .from('clips')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get clips: ${error.message}`);
  return data || [];
}

export async function updateClip(
  id: string,
  updates: Partial<Clip>
): Promise<Clip> {
  const { data, error } = await supabase
    .from('clips')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update clip: ${error.message}`);
  return data;
}

export async function getClip(id: string): Promise<Clip | null> {
  const { data, error } = await supabase
    .from('clips')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get clip: ${error.message}`);
  }
  return data;
}

export async function getAllClipsWithProjects(): Promise<(Clip & { project: Project })[]> {
  const { data, error } = await supabase
    .from('clips')
    .select(`
      *,
      project:projects(*)
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get clips: ${error.message}`);
  return data || [];
}

// Realtime subscriptions
export function subscribeToProject(
  projectId: string,
  onUpdate: (project: Project) => void
) {
  return supabase
    .channel(`project:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`,
      },
      (payload) => {
        onUpdate(payload.new as Project);
      }
    )
    .subscribe();
}

export function subscribeToClips(
  projectId: string,
  onInsert: (clip: Clip) => void,
  onUpdate: (clip: Clip) => void
) {
  return supabase
    .channel(`clips:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'clips',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        onInsert(payload.new as Clip);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'clips',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        onUpdate(payload.new as Clip);
      }
    )
    .subscribe();
}
