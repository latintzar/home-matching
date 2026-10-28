import { NextRequest, NextResponse } from 'next/server';
import { SocialRadar } from '@/lib/intelligence/social-radar';
import { StreetViewDetective } from '@/lib/intelligence/street-view';
import { TenderWatch } from '@/lib/intelligence/tenders';
import { GeologyCheck } from '@/lib/intelligence/geology';

// Initialize Modules - DO NOT do this at top level to avoid build-time issues
// Initialize inside the handler or lazy load

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function POST(req: NextRequest) {
  try {
    // Initialize Modules inside handler to ensure environment is ready/safe
    const socialRadar = new SocialRadar();
    const streetView = new StreetViewDetective();
    const tenderWatch = new TenderWatch();
    const geologyCheck = new GeologyCheck();

    const { address } = await req.json();

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address is required' }, { status: 400 });
    }

    console.log(`🔍 Analyzing address: ${address}`);

    // 1. Geocode Address
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const geoRes = await fetch(geocodeUrl);
    const geoData = await geoRes.json();

    if (geoData.status !== 'OK' || !geoData.results[0]) {
      return NextResponse.json({ success: false, error: 'Geocoding failed' }, { status: 400 });
    }

    const location = geoData.results[0].geometry.location;
    const lat = location.lat;
    const lng = location.lng;
    const addressComponents = geoData.results[0].address_components;
    
    const city = addressComponents.find((c: any) => c.types.includes('locality'))?.long_name || 
                 addressComponents.find((c: any) => c.types.includes('administrative_area_level_2'))?.long_name || 
                 'Unknown';
                 
    const street = addressComponents.find((c: any) => c.types.includes('route'))?.long_name || '';

    console.log(`📍 Coordinates: ${lat}, ${lng}`);
    console.log(`📍 Details: Street=${street}, City=${city}`);

    // 2. Run Intelligence Modules in Parallel
    const [socialResults, streetViewImages, tenderResults, geologyResults] = await Promise.all([
      socialRadar.analyzeLocation(lat, lng, [address, city, street], 'exact'),
      streetView.surveyNeighborhood(lat, lng, address, city, 100), // 100m radius survey
      tenderWatch.checkStreetWorks(street, city),
      geologyCheck.checkPoint(lat, lng)
    ]);

    // 3. Analyze Visuals if images found
    let visualAnalysis: any = {
        vibe_score: 0,
        maintenance_condition: 'Not analyzed',
        security_features: [],
        commercial_activity: [],
        summary: 'Street View analysis failed or no images found.'
    };

    if (streetViewImages.length > 0) {
        visualAnalysis = await streetView.analyzeVibe(streetViewImages);
    }

    // 4. Construct Response
    return NextResponse.json({
      social: socialResults,
      visual: visualAnalysis,
      streetViewImages: streetViewImages, // Pass images back to client
      tenders: tenderResults,
      geology: geologyResults,
      coordinates: { lat, lng },
      mapApiKey: GOOGLE_MAPS_API_KEY // Pass API key for client-side map rendering if needed
    });

  } catch (error) {
    console.error('Test Intelligence API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as any).message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
