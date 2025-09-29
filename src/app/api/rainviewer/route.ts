import { NextResponse } from 'next/server';

// This route acts as a proxy to the RainViewer API to avoid CORS issues.
export async function GET() {
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
      next: {
        revalidate: 300, // Revalidate every 5 minutes
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from RainViewer API: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[API/RAINVIEWER] Error fetching weather data:', error);
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Error fetching weather data from external API', error: errorMessage },
      { status: 500 }
    );
  }
}
