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
  Sparkles,
  Play,
  Download,
  ArrowRight,
  X
} from 'lucide-react';
import type { Project, Clip } from '@/types';
import { cn } from '@/lib/utils';

type PipelineStage = 'poi_generation' | 'street_view' | 'enhancement' | 'video_generation' | 'complete';

interface ProjectData {
  project: Project;
  clips: Clip[];
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [data, setData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);

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
      // Poll for updates every 3 seconds
      const interval = setInterval(fetchProject, 3000);
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

  // Calculate progress stats
  const completedClips = clips.filter(c => c.status === 'completed').length;
  const failedClips = clips.filter(c => c.status === 'failed').length;
  const processingClips = clips.filter(c => !['completed', 'failed', 'pending'].includes(c.status)).length;
  const progressPercent = clips.length > 0 ? Math.round((completedClips / clips.length) * 100) : 0;

  // Determine current pipeline stage based on clip statuses
  const getCurrentStage = (): PipelineStage => {
    if (clips.length === 0) return 'poi_generation';

    const allDone = clips.every(c => c.status === 'completed' || c.status === 'failed');
    if (allDone) return 'complete';

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
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <MapPin className="w-4 h-4" />
          {project.location_name}
        </div>
        <h1 className="text-3xl font-bold mb-2">Project Progress</h1>
        <p className="text-muted-foreground">{project.direction}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left column - Pipeline Progress */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Status</CardTitle>
              <CardDescription>
                {currentStage === 'complete'
                  ? `${completedClips} clips generated successfully`
                  : 'Processing your b-roll...'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{completedClips} completed</span>
                  {failedClips > 0 && <span className="text-destructive">{failedClips} failed</span>}
                </div>
              </div>

              {/* Stage indicators */}
              <div className="space-y-3">
                {stages.map((stage) => {
                  const status = getStageStatus(stage.id);
                  const Icon = stage.icon;

                  return (
                    <div
                      key={stage.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        status === 'active' && "bg-primary/5 border-primary",
                        status === 'complete' && "bg-muted/50 border-border",
                        status === 'pending' && "border-border opacity-50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        status === 'active' && "bg-primary text-primary-foreground",
                        status === 'complete' && "bg-green-500/20 text-green-500",
                        status === 'pending' && "bg-muted text-muted-foreground"
                      )}>
                        {status === 'active' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : status === 'complete' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{stage.label}</div>
                      </div>
                      <Icon className={cn(
                        "w-4 h-4 flex-shrink-0",
                        status === 'active' && "text-primary",
                        status === 'complete' && "text-green-500",
                        status === 'pending' && "text-muted-foreground"
                      )} />
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              {currentStage === 'complete' && (
                <div className="space-y-2 pt-4 border-t">
                  <a href="/gallery" className="block">
                    <Button className="w-full gap-2">
                      View in Gallery
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                  <a href="/new" className="block">
                    <Button variant="outline" className="w-full">
                      Create New Project
                    </Button>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Clip Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Points of Interest ({clips.length})</CardTitle>
              <CardDescription>
                Click a clip to view details and before/after comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clips.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Spinner size="md" className="mx-auto mb-4" />
                  <p>Identifying points of interest...</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {clips.map((clip) => (
                    <ClipCard
                      key={clip.id}
                      clip={clip}
                      onClick={() => setSelectedClip(clip)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Clip Detail Modal */}
      {selectedClip && (
        <ClipDetailModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
        />
      )}
    </div>
  );
}

function ClipCard({ clip, onClick }: { clip: Clip; onClick: () => void }) {
  const previewUrl = clip.video_thumbnail_url || clip.nanobanana_url || clip.street_view_url;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-border overflow-hidden bg-card hover:border-primary transition-colors"
    >
      <div className="aspect-video relative bg-muted">
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt={clip.poi_name}
              className="w-full h-full object-cover"
            />
            {clip.video_url && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-12 h-12 text-white" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {clip.status === 'pending' ? (
              <MapPin className="w-8 h-8 text-muted-foreground" />
            ) : (
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            )}
          </div>
        )}
        <ClipStatusBadge status={clip.status} className="absolute top-2 right-2" />
      </div>
      <div className="p-3">
        <h3 className="font-medium truncate">{clip.poi_name}</h3>
        {clip.poi_description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {clip.poi_description}
          </p>
        )}
      </div>
    </div>
  );
}

function ClipDetailModal({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  const [viewMode, setViewMode] = useState<'original' | 'enhanced' | 'video'>('video');

  const hasOriginal = !!clip.street_view_url;
  const hasEnhanced = !!clip.nanobanana_url;
  const hasVideo = !!clip.video_url;

  // Default to the best available view
  const defaultView = hasVideo ? 'video' : hasEnhanced ? 'enhanced' : 'original';
  const currentView = viewMode === 'video' && !hasVideo
    ? (hasEnhanced ? 'enhanced' : 'original')
    : viewMode === 'enhanced' && !hasEnhanced
    ? 'original'
    : viewMode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-background/80 hover:bg-background z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* View Toggle */}
        <div className="flex border-b border-border">
          {hasOriginal && (
            <button
              onClick={() => setViewMode('original')}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                currentView === 'original'
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ImageIcon className="w-4 h-4 inline mr-2" />
              Original
            </button>
          )}
          {hasEnhanced && (
            <button
              onClick={() => setViewMode('enhanced')}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                currentView === 'enhanced'
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              Enhanced
            </button>
          )}
          {hasVideo && (
            <button
              onClick={() => setViewMode('video')}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                currentView === 'video'
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Video className="w-4 h-4 inline mr-2" />
              Video
            </button>
          )}
        </div>

        {/* Content */}
        <div className="aspect-video bg-black">
          {currentView === 'video' && clip.video_url ? (
            <video
              src={clip.video_url}
              controls
              autoPlay
              loop
              className="w-full h-full"
            />
          ) : currentView === 'enhanced' && clip.nanobanana_url ? (
            <img
              src={clip.nanobanana_url}
              alt={`${clip.poi_name} - Enhanced`}
              className="w-full h-full object-contain"
            />
          ) : clip.street_view_url ? (
            <img
              src={clip.street_view_url}
              alt={`${clip.poi_name} - Original`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No preview available
            </div>
          )}
        </div>

        {/* Before/After comparison */}
        {hasOriginal && hasEnhanced && currentView !== 'video' && (
          <div className="p-4 border-t border-border bg-muted/30">
            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="text-muted-foreground">Compare:</span>
              <button
                onClick={() => setViewMode('original')}
                className={cn(
                  "px-3 py-1 rounded-full",
                  currentView === 'original' ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                Original
              </button>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={() => setViewMode('enhanced')}
                className={cn(
                  "px-3 py-1 rounded-full",
                  currentView === 'enhanced' ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                Enhanced
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold mb-1">{clip.poi_name}</h2>
              {clip.poi_description && (
                <p className="text-muted-foreground text-sm mb-2">{clip.poi_description}</p>
              )}
              {clip.relevance_reason && (
                <p className="text-xs text-muted-foreground italic">"{clip.relevance_reason}"</p>
              )}
            </div>
            <ClipStatusBadge status={clip.status} />
          </div>

          {clip.error_message && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              {clip.error_message}
            </div>
          )}

          {clip.video_url && (
            <div className="mt-4">
              <a href={clip.video_url} download className="inline-flex">
                <Button className="gap-2">
                  <Download className="w-4 h-4" />
                  Download Video
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClipStatusBadge({ status, className }: { status: Clip['status']; className?: string }) {
  const config = {
    pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
    fetching_streetview: { label: 'Fetching', className: 'bg-blue-500/20 text-blue-400' },
    enhancing: { label: 'Enhancing', className: 'bg-purple-500/20 text-purple-400' },
    generating_video: { label: 'Generating', className: 'bg-primary/20 text-primary' },
    completed: { label: 'Complete', className: 'bg-green-500/20 text-green-400' },
    failed: { label: 'Failed', className: 'bg-destructive/20 text-destructive' },
  };

  const { label, className: statusClass } = config[status] || config.pending;

  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-xs font-medium",
      statusClass,
      className
    )}>
      {label}
    </span>
  );
}
