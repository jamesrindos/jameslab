'use client';

import Image from 'next/image';
import { useEffect, useState, useMemo, useRef } from 'react';
import type mapboxgl from 'mapbox-gl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Grid3X3,
  Map,
  Search,
  Download,
  Play,
  X,
  MapPin,
  Calendar,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Clip, Project } from '@/types';

type ViewMode = 'grid' | 'map';

interface ClipWithProject extends Clip {
  project?: Project;
}

export default function GalleryPage() {
  const [clips, setClips] = useState<ClipWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClip, setSelectedClip] = useState<ClipWithProject | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/gallery');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch gallery data');
        }

        setClips(data.clips || []);
        setProjects(data.projects || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredClips = useMemo(() => {
    let result = clips;

    if (selectedProjectId) {
      result = result.filter(clip => clip.project_id === selectedProjectId);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        clip =>
          clip.poi_name.toLowerCase().includes(query) ||
          clip.poi_description?.toLowerCase().includes(query) ||
          clip.project?.location_name.toLowerCase().includes(query) ||
          clip.project?.direction.toLowerCase().includes(query)
      );
    }

    return result;
  }, [clips, searchQuery, selectedProjectId]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">{error}</p>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b border-border sticky top-16 bg-background z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Gallery</h1>
              <p className="text-sm text-muted-foreground">
                {filteredClips.length} clip{filteredClips.length !== 1 ? 's' : ''} available
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search clips..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Project Filter */}
              {projects.length > 0 && (
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value || null)}
                  className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">All Projects</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.location_name}
                    </option>
                  ))}
                </select>
              )}

              {/* View Toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 transition-colors",
                    viewMode === 'grid'
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  )}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={cn(
                    "p-2 transition-colors",
                    viewMode === 'map'
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  )}
                >
                  <Map className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {filteredClips.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No clips found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedProjectId
                ? 'Try adjusting your filters'
                : 'Create a project to generate b-roll clips'}
            </p>
            <a href="/new">
              <Button>Create New Project</Button>
            </a>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView
            clips={filteredClips}
            onSelectClip={setSelectedClip}
          />
        ) : (
          <MapView
            clips={filteredClips}
            onSelectClip={setSelectedClip}
          />
        )}
      </div>

      {/* Clip Modal */}
      {selectedClip && (
        <ClipModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
        />
      )}
    </div>
  );
}

function GridView({
  clips,
  onSelectClip
}: {
  clips: ClipWithProject[];
  onSelectClip: (clip: ClipWithProject) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clips.map((clip) => {
        const previewUrl = clip.video_thumbnail_url || clip.nanobanana_url || clip.street_view_url;

        return (
        <div
          key={clip.id}
          onClick={() => onSelectClip(clip)}
          className="group cursor-pointer rounded-lg border border-border overflow-hidden bg-card hover:border-primary transition-colors"
        >
          <div className="aspect-video relative bg-muted">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={clip.poi_name}
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapPin className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className="p-3">
            <h3 className="font-medium truncate">{clip.poi_name}</h3>
            {clip.project && (
              <p className="text-sm text-muted-foreground truncate">
                {clip.project.location_name}
              </p>
            )}
          </div>
        </div>
        )})}
    </div>
  );
}

function MapView({
  clips,
  onSelectClip
}: {
  clips: ClipWithProject[];
  onSelectClip: (clip: ClipWithProject) => void;
}) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    // Inject Mapbox CSS via link tag
    const linkId = 'mapbox-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css';
      document.head.appendChild(link);
    }

    // Dynamic import for Mapbox
    const loadMap = async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

        // Clean up existing map
        if (mapRef.current) {
          markersRef.current.forEach(m => m.remove());
          mapRef.current.remove();
        }

        const map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/mapbox/dark-v11',
          center: clips.length > 0 ? [clips[0].poi_lng, clips[0].poi_lat] : [0, 20],
          zoom: clips.length > 0 ? 10 : 2,
        });

        mapRef.current = map;
        markersRef.current = [];

        map.addControl(new mapboxgl.NavigationControl());

        map.on('load', () => {
          // Add markers for each clip after map loads
          clips.forEach(clip => {
            // Create custom marker element
            const el = document.createElement('div');
            el.style.cssText = `
              width: 32px;
              height: 32px;
              background: #22c55e;
              border-radius: 50%;
              border: 3px solid white;
              cursor: pointer;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              transition: transform 0.15s ease;
            `;

            el.addEventListener('mouseenter', () => {
              el.style.transform = 'scale(1.2)';
            });
            el.addEventListener('mouseleave', () => {
              el.style.transform = 'scale(1)';
            });

            // Build popup content with thumbnail and details
            const thumbnailUrl = clip.video_thumbnail_url || clip.nanobanana_url || clip.street_view_url;
            const popupContent = `
              <div style="min-width: 220px; font-family: system-ui, sans-serif;">
                ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${clip.poi_name}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px 4px 0 0;" />` : ''}
                <div style="padding: 12px;">
                  <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #fff;">${clip.poi_name}</h3>
                  ${clip.poi_description ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #aaa; line-height: 1.4;">${clip.poi_description.slice(0, 100)}${clip.poi_description.length > 100 ? '...' : ''}</p>` : ''}
                  ${clip.project ? `<p style="margin: 0 0 8px 0; font-size: 11px; color: #888;"><strong>Location:</strong> ${clip.project.location_name}</p>` : ''}
                  <button id="view-clip-${clip.id}" style="width: 100%; padding: 8px; background: #22c55e; color: #000; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">View Details</button>
                </div>
              </div>
            `;

            const popup = new mapboxgl.Popup({
              offset: [0, -16],
              closeButton: true,
              maxWidth: '260px',
            }).setHTML(popupContent);

            // Add click handler for the view button after popup opens
            popup.on('open', () => {
              const btn = document.getElementById(`view-clip-${clip.id}`);
              if (btn) {
                btn.addEventListener('click', () => {
                  onSelectClip(clip);
                  popup.remove();
                });
              }
            });

            // Create marker with proper anchor
            const marker = new mapboxgl.Marker({
              element: el,
              anchor: 'center',
            })
              .setLngLat([clip.poi_lng, clip.poi_lat])
              .setPopup(popup)
              .addTo(map);

            markersRef.current.push(marker);
          });

          setMapLoaded(true);
        });

      } catch (error) {
        console.error('Error loading map:', error);
      }
    };

    loadMap();

    return () => {
      markersRef.current.forEach(m => m.remove());
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [clips, onSelectClip]);

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card relative">
      <div id="map" className="w-full h-[600px]" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-card">
          <Spinner size="lg" />
        </div>
      )}
    </div>
  );
}

function ClipModal({
  clip,
  onClose
}: {
  clip: ClipWithProject;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-background/80 hover:bg-background z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="aspect-video bg-black">
          {clip.video_url ? (
            <video
              src={clip.video_url}
              controls
              autoPlay
              className="w-full h-full"
            />
          ) : clip.nanobanana_url || clip.street_view_url ? (
            <Image
              src={(clip.nanobanana_url || clip.street_view_url)!}
              alt={clip.poi_name}
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

        <div className="p-6">
          <h2 className="text-2xl font-bold mb-2">{clip.poi_name}</h2>
          {clip.poi_description && (
            <p className="text-muted-foreground mb-4">{clip.poi_description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
            {clip.project && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {clip.project.location_name}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(clip.created_at).toLocaleDateString()}
            </div>
          </div>

          {clip.video_url && (
            <a
              href={clip.video_url}
              download
              className="inline-flex"
            >
              <Button className="gap-2">
                <Download className="w-4 h-4" />
                Download Video
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
