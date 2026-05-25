'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProjectStore } from './useProjectStore';
import { supabase, getProject, getClipsByProject, subscribeToProject, subscribeToClips } from '@/lib/db';

export function useProject(projectId: string | undefined) {
  const {
    currentProject,
    clips,
    setCurrentProject,
    setClips,
    updateClip,
    setLoading,
    setError
  } = useProjectStore();

  // Fetch project data
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return getProject(projectId);
    },
    enabled: !!projectId,
  });

  // Fetch clips data
  const clipsQuery = useQuery({
    queryKey: ['clips', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return getClipsByProject(projectId);
    },
    enabled: !!projectId,
  });

  // Update store when data changes
  useEffect(() => {
    if (projectQuery.data) {
      setCurrentProject(projectQuery.data);
    }
  }, [projectQuery.data, setCurrentProject]);

  useEffect(() => {
    if (clipsQuery.data) {
      setClips(clipsQuery.data);
    }
  }, [clipsQuery.data, setClips]);

  useEffect(() => {
    setLoading(projectQuery.isLoading || clipsQuery.isLoading);
  }, [projectQuery.isLoading, clipsQuery.isLoading, setLoading]);

  useEffect(() => {
    const error = projectQuery.error || clipsQuery.error;
    setError(error ? (error instanceof Error ? error.message : String(error)) : null);
  }, [projectQuery.error, clipsQuery.error, setError]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!projectId) return;

    const projectSubscription = subscribeToProject(projectId, (updatedProject) => {
      setCurrentProject(updatedProject);
    });

    const clipsSubscription = subscribeToClips(
      projectId,
      (newClip) => {
        setClips([...clips, newClip]);
      },
      (updatedClip) => {
        updateClip(updatedClip.id, updatedClip);
      }
    );

    return () => {
      supabase.removeChannel(projectSubscription);
      supabase.removeChannel(clipsSubscription);
    };
  }, [projectId, clips, setCurrentProject, setClips, updateClip]);

  return {
    project: currentProject,
    clips,
    isLoading: projectQuery.isLoading || clipsQuery.isLoading,
    error: projectQuery.error || clipsQuery.error,
    refetch: () => {
      projectQuery.refetch();
      clipsQuery.refetch();
    },
  };
}
