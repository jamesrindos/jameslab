'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  const [locationInput, setLocationInput] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [direction, setDirection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocationSelect = (location: SelectedLocation) => {
    setSelectedLocation(location);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedLocation) {
      setError('Please select a location from the suggestions');
      return;
    }

    if (!direction.trim()) {
      setError('Please provide a creative direction');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location_name: selectedLocation.name,
          location_lat: selectedLocation.lat,
          location_lng: selectedLocation.lng,
          direction: direction.trim(),
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
              <Label htmlFor="location">Location</Label>
              <LocationAutocomplete
                value={locationInput}
                onChange={setLocationInput}
                onSelect={handleLocationSelect}
                placeholder="Search for a city or town..."
              />
              {selectedLocation && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {selectedLocation.formatted_address}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Creative Direction</Label>
              <Textarea
                id="direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder="Describe your vision... e.g., 'cinematic drone shots, golden hour lighting, coastal vibes, moody atmosphere'"
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Be specific about style, mood, time of day, and visual elements you want
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
          <li>1. AI identifies 8-12 cinematic points of interest</li>
          <li>2. Street-level imagery is captured for each location</li>
          <li>3. Images are enhanced with cinematic styling</li>
          <li>4. Video clips are generated with subtle motion</li>
        </ol>
      </div>
    </div>
  );
}
