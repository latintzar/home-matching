import { NextRequest, NextResponse } from 'next/server';

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || '2152837cef1b4a159356a9665a701bdd';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat or lng' }, { status: 400 });
  }

  try {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${GEOAPIFY_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Geoapify API error: ${response.status}`);
    }
    
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const bestResult = data.results[0];

      return NextResponse.json({
        address: bestResult.formatted,
        city: bestResult.city || bestResult.state || '',
        region: bestResult.state || bestResult.country || '',
        place_id: bestResult.place_id
      });
    }

    return NextResponse.json({ error: 'No results found' }, { status: 404 });

  } catch (error: any) {
    console.error('Reverse geocode error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

