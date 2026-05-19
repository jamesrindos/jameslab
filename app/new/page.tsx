'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Sparkles, AlertCircle } from 'lucide-react';

interface SelectedLocation {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [direction, setDirection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);

    if (
      selectedLocation &&
      value.trim() !== selectedLocation.formatted_address &&
      value.trim() !== selectedLocation.name
    ) {
      setSelectedLocation(null);
    }

    if (error) {
      setError(null);
    }
  };

  const handleLocationSelect = (location: SelectedLocation) => {
    setSelectedLocation(location);
    // Auto-fill project name with location if not already set
    if (!projectName.trim()) {
      setProjectName(location.name);
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedLocation) {
      setError('Please select a location from the suggestions');
      return;
    }

    // Creative direction is now optional - use default if empty
    const finalDirection = direction.trim() || 'Modern cinematic establishing shots with natural lighting';
    // Use location name as project name if not provided
    const finalName = projectName.trim() || selectedLocation.name;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: finalName,
          location_name: selectedLocation.name,
          location_lat: selectedLocation.lat,
          location_lng: selectedLocation.lng,
          direction: finalDirection,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      router.push(`/project/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Project</h1>
        <p className="text-muted-foreground">
          Generate cinematic b-roll footage from any location
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Project Details
          </CardTitle>
          <CardDescription>
            Tell us where you want to shoot and your creative vision
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Project"
              />
              <p className="text-xs text-muted-foreground">
                Give your project a name, or leave blank to use the location name
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <LocationAutocomplete
                value={locationInput}
                onChange={handleLocationInputChange}
                onSelect={handleLocationSelect}
                placeholder="Search for a city or town..."
              />
              {selectedLocation ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {selectedLocation.formatted_address}
                </p>
              ) : locationInput.trim() ? (
                <p className="text-xs text-amber-600 mt-1">
                  Pick a suggestion to confirm the exact location.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Creative Direction <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder="Leave blank for modern cinematic style, or describe your vision... e.g., 'golden hour lighting, coastal vibes, moody atmosphere'"
                className="min-h-[100px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Optional: specify style, mood, time of day. Defaults to modern cinematic look.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || !selectedLocation}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Generating POIs...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate B-Roll
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 p-4 rounded-lg border border-border bg-card/50">
        <h3 className="font-medium text-sm mb-2">What happens next?</h3>
        <ol className="text-sm text-muted-foreground space-y-1">
          <li>1. AI identifies 4 key cinematic points of interest</li>
          <li>2. Optimal street-level imagery is captured for each</li>
          <li>3. Scenes are enhanced with professional staging</li>
          <li>4. High-quality stock footage ready images are generated</li>
        </ol>
      </div>
    </div>
  );
}
