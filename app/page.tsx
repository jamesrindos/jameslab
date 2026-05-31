'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Plus, MapPin, Sparkles, FolderOpen, Clock } from "lucide-react";
import type { Project, Clip } from "@/types";

interface ProjectWithClips extends Project {
  clips: Clip[];
}

export default function Home() {
  const [projects, setProjects] = useState<ProjectWithClips[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects?include=clips');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch projects');
        }

        setProjects(data.projects || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Projects</h1>
              <p className="text-muted-foreground">
                {projects.length === 0
                  ? 'Create your first project to get started'
                  : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <a href="/new">
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Create New Project
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {error && (
          <Card className="mb-8 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <FolderOpen className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-3">No Projects Yet</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        Create your first project to generate cinematic b-roll footage from any location worldwide.
      </p>
      <a href="/new">
        <Button size="lg" className="gap-2">
          <Plus className="w-5 h-5" />
          Create Your First Project
        </Button>
      </a>

      {/* How it works */}
      <div className="mt-16 max-w-3xl mx-auto">
        <h3 className="text-lg font-medium mb-8">How It Works</h3>
        <div className="grid md:grid-cols-3 gap-8 text-left">
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <h4 className="font-medium mb-2">1. Choose Location</h4>
            <p className="text-sm text-muted-foreground">
              Search for any city, town, or landmark worldwide
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h4 className="font-medium mb-2">2. AI Enhancement</h4>
            <p className="text-sm text-muted-foreground">
              Our AI discovers POIs and enhances imagery
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <h4 className="font-medium mb-2">3. Organize & Export</h4>
            <p className="text-sm text-muted-foreground">
              View your clips and download ready-to-use footage
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectWithClips }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Get clips with images
  const clipsWithImages = project.clips.filter(
    clip => clip.nanobanana_url || clip.place_photo_url || clip.video_thumbnail_url || clip.street_view_url
  );

  // Rotate through images every 3 seconds
  useEffect(() => {
    if (clipsWithImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % clipsWithImages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [clipsWithImages.length]);

  const currentClip = clipsWithImages[currentImageIndex];
  const currentImage = currentClip?.video_thumbnail_url || currentClip?.nanobanana_url || currentClip?.place_photo_url || currentClip?.street_view_url;

  const completedCount = project.clips.filter(c => c.status === 'completed').length;
  const processingCount = project.clips.filter(c => !['completed', 'failed', 'pending'].includes(c.status)).length;

  return (
    <a href={`/project/${project.id}`} className="group block">
      <Card className="overflow-hidden border-border hover:border-primary transition-colors">
        {/* Thumbnail */}
        <div className="aspect-video relative bg-muted overflow-hidden">
          {currentImage ? (
            <>
              <Image
                src={currentImage!}
                alt={project.location_name}
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-opacity duration-500"
              />
              {/* Image counter */}
              {clipsWithImages.length > 1 && (
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-black/60 text-white text-xs">
                  {currentImageIndex + 1} / {clipsWithImages.length}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {processingCount > 0 ? (
                <Spinner size="md" />
              ) : (
                <MapPin className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
          )}

          {/* Status overlay */}
          {project.status === 'processing' && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="text-center">
                <Spinner size="sm" className="mx-auto mb-2" />
                <span className="text-white text-xs">Processing...</span>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <CardContent className="p-4">
          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
            {project.name || project.location_name}
          </h3>
          <p className="text-sm text-muted-foreground truncate mt-1">
            {project.location_name}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(project.created_at).toLocaleDateString()}
            </span>
            <span>
              {completedCount} clip{completedCount !== 1 ? 's' : ''}
            </span>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
