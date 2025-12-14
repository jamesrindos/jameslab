import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get('input');

  if (!input) {
    return NextResponse.json(
      { error: 'Input parameter is required' },
      { status: 400 }
    );
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('types', '(cities)');
    url.searchParams.set('key', GOOGLE_PLACES_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return NextResponse.json({
        predictions: data.predictions || [],
      });
    }

    console.error('Google Places API error:', data.status, data.error_message);
    return NextResponse.json(
      { error: data.error_message || 'Failed to fetch predictions' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error fetching place predictions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
