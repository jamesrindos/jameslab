'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import {
  MapPin,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Play,
  Download,
  ArrowRight,
  X,
  RefreshCw,
  Send,
  Plus,
  Home
} from 'lucide-react';
import type { Project, Clip } from '@/types';
import { cn } from '@/lib/utils';

interface SelectedLocation {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
}

type PipelineStage = 'poi_generation' | 'street_view' | 'enhancement' | 'complete';

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

  // Add to project state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLocationInput, setAddLocationInput] = useState('');
  const [selectedAddLocation, setSelectedAddLocation] = useState<SelectedLocation | null>(null);
  const [isAddingClips, setIsAddingClips] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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

  const handleAddClips = async () => {
    if (!selectedAddLocation) {
      setAddError('Please select a location');
      return;
    }

    setIsAddingClips(true);
    setAddError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/add-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_name: selectedAddLocation.name,
          location_lat: selectedAddLocation.lat,
          location_lng: selectedAddLocation.lng,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add clips');
      }

      // Reset and close modal
      setShowAddModal(false);
      setAddLocationInput('');
      setSelectedAddLocation(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsAddingClips(false);
    }
  };

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
  const progressPercent = clips.length > 0 ? Math.round((completedClips / clips.length) * 100) : 0;

  // Determine current pipeline stage based on clip statuses
  const getCurrentStage = (): PipelineStage => {
    if (clips.length === 0) return 'poi_generation';

    const allDone = clips.every(c => c.status === 'completed' || c.status === 'failed');
    if (allDone) return 'complete';

    const hasEnhanced = clips.some(c => c.status === 'enhancing' || c.nanobanana_url);
    if (hasEnhanced) return 'enhancement';

    const hasStreetView = clips.some(c => c.status === 'fetching_streetview' || c.street_view_url);
    if (hasStreetView) return 'street_view';

    return 'poi_generation';
  };

  const currentStage = getCurrentStage();

  const stages = [
    { id: 'poi_generation', label: 'Discovering POIs', icon: MapPin },
    { id: 'street_view', label: 'Capturing Street View', icon: ImageIcon },
    { id: 'enhancement', label: 'Enhancing Images', icon: Sparkles },
  ];

  const getStageStatus = (stageId: string): 'pending' | 'active' | 'complete' => {
    const stageOrder = ['poi_generation', 'street_view', 'enhancement'];
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
          <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" />
            Projects
          </Link>
          <span>/</span>
          <span>{project.name || project.location_name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{project.name || project.location_name}</h1>
            <p className="text-muted-foreground">{project.direction}</p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="gap-2"
            disabled={project.status === 'processing'}
          >
            <Plus className="w-4 h-4" />
            Add to Project
          </Button>
        </div>
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

      {/* Add to Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => !isAddingClips && setShowAddModal(false)}
          />
          <div className="relative bg-card rounded-lg max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Add to Project</h2>
                <button
                  onClick={() => !isAddingClips && setShowAddModal(false)}
                  className="p-2 rounded-full hover:bg-muted"
                  disabled={isAddingClips}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-muted-foreground text-sm mb-4">
                Search for a new location to add cinematic clips to this project.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <LocationAutocomplete
                    value={addLocationInput}
                    onChange={setAddLocationInput}
                    onSelect={(location) => {
                      setSelectedAddLocation(location);
                      setAddError(null);
                    }}
                    placeholder="Search for a city or landmark..."
                  />
                  {selectedAddLocation && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {selectedAddLocation.formatted_address}
                    </p>
                  )}
                </div>

                {addError && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-md">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {addError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleAddClips}
                    disabled={!selectedAddLocation || isAddingClips}
                    className="flex-1 gap-2"
                  >
                    {isAddingClips ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding Clips...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Clips
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddModal(false)}
                    disabled={isAddingClips}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClipCard({ clip, onClick }: { clip: Clip; onClick: () => void }) {
  const previewUrl = clip.video_thumbnail_url || clip.nanobanana_url || clip.place_photo_url || clip.street_view_url;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-border overflow-hidden bg-card hover:border-primary transition-colors"
    >
      <div className="aspect-video relative bg-muted">
        {previewUrl ? (
          <>
            <Image
              src={previewUrl!}
              alt={clip.poi_name}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
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

function ClipDetailModal({ clip: initialClip, onClose }: { clip: Clip; onClose: () => void }) {
  const [clip, setClip] = useState(initialClip);
  const [viewMode, setViewMode] = useState<'original' | 'enhanced'>('enhanced');
  const [isRevising, setIsRevising] = useState(false);
  const [showReviseInput, setShowReviseInput] = useState(false);
  const [revisePrompt, setRevisePrompt] = useState('');
  const [reviseError, setReviseError] = useState<string | null>(null);

  // Original can be either Place Photo or Street View
  const originalUrl = clip.place_photo_url || clip.street_view_url;
  const hasOriginal = !!originalUrl;
  const hasEnhanced = !!clip.nanobanana_url;

  // Default to the best available view
  const currentView = viewMode === 'enhanced' && !hasEnhanced ? 'original' : viewMode;

  const handleRevise = async () => {
    if (!revisePrompt.trim()) {
      setReviseError('Please enter a prompt');
      return;
    }

    setIsRevising(true);
    setReviseError(null);

    try {
      const response = await fetch(`/api/clips/${clip.id}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: revisePrompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Revision failed');
      }

      // Update local clip state with new enhanced image
      setClip(data.clip);
      setShowReviseInput(false);
      setRevisePrompt('');
      setViewMode('enhanced');
    } catch (error) {
      setReviseError(error instanceof Error ? error.message : 'Revision failed');
    } finally {
      setIsRevising(false);
    }
  };

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
        </div>

        {/* Content */}
        <div className="aspect-video bg-black relative">
          {isRevising && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Revising image...</p>
              </div>
            </div>
          )}
          {currentView === 'enhanced' && clip.nanobanana_url ? (
            <Image
              src={clip.nanobanana_url!}
              alt={`${clip.poi_name} - Enhanced`}
              fill
              unoptimized
              sizes="100vw"
              className="object-contain"
            />
          ) : originalUrl ? (
            <Image
              src={originalUrl!}
              alt={`${clip.poi_name} - Original`}
              fill
              unoptimized
              sizes="100vw"
              className="object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No preview available
            </div>
          )}
        </div>

        {/* Revise Input */}
        {showReviseInput && (
          <div className="p-4 border-t border-border bg-muted/30">
            <label className="block text-sm font-medium mb-2">Custom Enhancement Prompt</label>
            <div className="flex gap-2">
              <textarea
                value={revisePrompt}
                onChange={(e) => setRevisePrompt(e.target.value)}
                placeholder="Describe how you want to enhance this image..."
                className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                rows={3}
                disabled={isRevising}
              />
            </div>
            {reviseError && (
              <p className="text-destructive text-sm mt-2">{reviseError}</p>
            )}
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleRevise}
                disabled={isRevising || !revisePrompt.trim()}
                className="gap-2"
              >
                {isRevising ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Apply Revision
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReviseInput(false);
                  setRevisePrompt('');
                  setReviseError(null);
                }}
                disabled={isRevising}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Before/After comparison */}
        {!showReviseInput && hasOriginal && hasEnhanced && (
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
                <p className="text-xs text-muted-foreground italic">&ldquo;{clip.relevance_reason}&rdquo;</p>
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

          {/* Action Buttons */}
          {clip.status === 'completed' && (
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/gallery">
                <Button className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View in Gallery
                </Button>
              </a>
              {hasOriginal && !showReviseInput && (
                <Button
                  variant="outline"
                  onClick={() => setShowReviseInput(true)}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Revise Enhancement
                </Button>
              )}
              {(clip.nanobanana_url || clip.place_photo_url || clip.street_view_url) && (
                <a href={clip.nanobanana_url || clip.place_photo_url || clip.street_view_url} download>
                  <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                </a>
              )}
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
