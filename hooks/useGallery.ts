'use client';

import { create } from 'zustand';
import type { Clip, Project, GalleryStore, GalleryFilters } from '@/types';

export const useGalleryStore = create<GalleryStore>((set) => ({
  clips: [],
  projects: [],
  filters: {},
  selectedClipId: null,
  viewMode: 'grid',

  setClips: (clips: Clip[]) => set({ clips }),
  setProjects: (projects: Project[]) => set({ projects }),
  setFilters: (filters: GalleryFilters) => set({ filters }),
  setSelectedClipId: (id: string | null) => set({ selectedClipId: id }),
  setViewMode: (mode: 'grid' | 'map') => set({ viewMode: mode }),
}));
