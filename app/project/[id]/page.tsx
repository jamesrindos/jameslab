'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  MapPin,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
  Video,
  Sparkles
} from 'lucide-react';
import type { Project, Clip, POI } from '@/types';
import { cn } from '@/lib/utils';

type PipelineStage = 'poi_generation' | 'street_view' | 'enhancement' | 'video_generation' | 'complete';

interface ProjectData {
  project: Project;
  clips: Clip[];
  pois?: POI[];
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [data, setData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch project');
        }

        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchProject();
      // Poll for updates every 5 seconds
      const interval = setInterval(fetchProject, 5000);
      return () => clearInterval(interval);
    }
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Error Loading Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error || 'Project not found'}</p>
            <a href="/new">
              <Button>Create New Project</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { project, clips } = data;

  // Determine current pipeline stage based on clip statuses
  const getCurrentStage = (): PipelineStage => {
    if (clips.length === 0) return 'poi_generation';

    const allCompleted = clips.every(c => c.status === 'completed');
    if (allCompleted) return 'complete';

    const hasVideo = clips.some(c => c.status === 'generating_video' || c.video_url);
    if (hasVideo) return 'video_generation';

    const hasEnhanced = clips.some(c => c.status === 'enhancing' || c.nanobanana_url);
    if (hasEnhanced) return 'enhancement';

    const hasStreetView = clips.some(c => c.status === 'fetching_streetview' || c.street_view_url);
    if (hasStreetView) return 'street_view';

    return 'poi_generation';
  };

  const currentStage = getCurrentStage();

  const stages = [
    { id: 'poi_generation', label: 'Identifying POIs', icon: MapPin },
    { id: 'street_view', label: 'Fetching Street View', icon: ImageIcon },
    { id: 'enhancement', label: 'Enhancing Images', icon: Sparkles },
    { id: 'video_generation', label: 'Generating Video', icon: Video },
  ];

  const getStageStatus = (stageId: string): 'pending' | 'active' | 'complete' => {
    const stageOrder = ['poi_generation', 'street_view', 'enhancement', 'video_generation'];
    const currentIndex = stageOrder.indexOf(currentStage);
    const stageIndex = stageOrder.indexOf(stageId);

    if (currentStage === 'complete') return 'complete';
    if (stageIndex < currentIndex) return 'complete';
    if (stageIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <MapPin className="w-4 h-4" />
          {project.location_name}
        </div>
        <h1 className="text-3xl font-bold mb-2">Project Progress</h1>
        <p className="text-muted-foreground">{project.direction}</p>
      </div>

      {/* Pipeline Progress */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Pipeline Status</CardTitle>
          <CardDescription>
            {currentStage === 'complete'
              ? 'All clips have been generated successfully!'
              : 'Your b-roll is being generated...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stages.map((stage, index) => {
              const status = getStageStatus(stage.id);
              const Icon = stage.icon;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                    status === 'active' && "bg-primary/5 border-primary",
                    status === 'complete' && "bg-muted/50 border-border",
                    status === 'pending' && "border-border opacity-50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    status === 'active' && "bg-primary text-primary-foreground",
                    status === 'complete' && "bg-green-500/20 text-green-500",
                    status === 'pending' && "bg-muted text-muted-foreground"
                  )}>
                    {status === 'active' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : status === 'complete' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{stage.label}</div>
                    {status === 'active' && (
                      <div className="text-sm text-muted-foreground">
                        Processing...
                      </div>
                    )}
                  </div>
                  <Icon className={cn(
                    "w-5 h-5",
                    status === 'active' && "text-primary",
                    status === 'complete' && "text-green-500",
                    status === 'pending' && "text-muted-foreground"
                  )} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* POI List */}
      <Card>
        <CardHeader>
          <CardTitle>Points of Interest ({clips.length})</CardTitle>
          <CardDescription>
            Locations identified for cinematic b-roll
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Spinner size="md" className="mx-auto mb-4" />
              <p>Identifying points of interest...</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium">{clip.poi_name}</h3>
                    <ClipStatusBadge status={clip.status} />
                  </div>
                  {clip.poi_description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {clip.poi_description}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {clip.poi_lat.toFixed(4)}, {clip.poi_lng.toFixed(4)}
                  </div>

                  {/* Show preview images if available */}
                  {clip.street_view_url && (
                    <div className="mt-3 rounded overflow-hidden">
                      <img
                        src={clip.street_view_url}
                        alt={clip.poi_name}
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {currentStage === 'complete' && (
        <div className="mt-8 flex justify-center gap-4">
          <a href="/gallery">
            <Button size="lg" className="gap-2">
              View in Gallery
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
          <a href="/new">
            <Button variant="outline" size="lg">
              Create New Project
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}

function ClipStatusBadge({ status }: { status: Clip['status'] }) {
  const config = {
    pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
    fetching_streetview: { label: 'Fetching', className: 'bg-blue-500/20 text-blue-400' },
    enhancing: { label: 'Enhancing', className: 'bg-purple-500/20 text-purple-400' },
    generating_video: { label: 'Generating', className: 'bg-primary/20 text-primary' },
    completed: { label: 'Complete', className: 'bg-green-500/20 text-green-400' },
    failed: { label: 'Failed', className: 'bg-destructive/20 text-destructive' },
  };

  const { label, className } = config[status] || config.pending;

  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-xs font-medium",
      className
    )}>
      {label}
    </span>
  );
}
