import { create } from 'zustand';
import type { Project, Clip, ProjectStore } from '@/types';

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  clips: [],
  isLoading: false,
  error: null,

  setCurrentProject: (project: Project | null) => set({ currentProject: project }),

  setClips: (clips: Clip[]) => set({ clips }),

  addClip: (clip: Clip) =>
    set((state) => ({
      clips: state.clips.some((existingClip) => existingClip.id === clip.id)
        ? state.clips
        : [...state.clips, clip],
    })),

  updateClip: (clipId: string, updates: Partial<Clip>) =>
    set((state) => ({
      clips: state.clips.map((clip) =>
        clip.id === clipId ? { ...clip, ...updates } : clip
      ),
    })),

  setLoading: (isLoading: boolean) => set({ isLoading }),

  setError: (error: string | null) => set({ error }),

  reset: () =>
    set({
      currentProject: null,
      clips: [],
      isLoading: false,
      error: null,
    }),
}));
