// Core types for HyperLocal B-Roll Generator

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export type ProjectStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ClipStatus = 'pending' | 'fetching_streetview' | 'enhancing' | 'generating_video' | 'completed' | 'failed';

export interface Project {
  id: string;
  user_id?: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  direction: string;
  status: ProjectStatus;
  created_at: string;
}

export interface Clip {
  id: string;
  project_id: string;
  poi_name: string;
  poi_lat: number;
  poi_lng: number;
  poi_description?: string;
  relevance_reason?: string;
  street_view_url?: string;
  nanobanana_url?: string;
  video_url?: string;
  video_thumbnail_url?: string;
  status: ClipStatus;
  error_message?: string;
  created_at: string;
}

// Gemini POI response structure
export interface POI {
  name: string;
  description: string;
  lat: number;
  lng: number;
  relevanceReason: string;
}

export interface GeminiPOIResponse {
  pois: POI[];
}

// Google Places types
export interface PlaceResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

// Street View types
export interface StreetViewParams {
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  fov: number;
}

// API Request/Response types
export interface CreateProjectRequest {
  location_name: string;
  location_lat: number;
  location_lng: number;
  direction: string;
}

export interface CreateProjectResponse {
  project: Project;
  pois: POI[];
}

// Zustand store types
export interface ProjectStore {
  currentProject: Project | null;
  clips: Clip[];
  isLoading: boolean;
  error: string | null;
  setCurrentProject: (project: Project | null) => void;
  setClips: (clips: Clip[]) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export interface GalleryFilters {
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  keywords?: string[];
}

export interface GalleryStore {
  clips: Clip[];
  projects: Project[];
  filters: GalleryFilters;
  selectedClipId: string | null;
  viewMode: 'grid' | 'map';
  setClips: (clips: Clip[]) => void;
  setProjects: (projects: Project[]) => void;
  setFilters: (filters: GalleryFilters) => void;
  setSelectedClipId: (id: string | null) => void;
  setViewMode: (mode: 'grid' | 'map') => void;
}

// Map types
export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  clipId?: string;
  projectId?: string;
}
