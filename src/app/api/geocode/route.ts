/**
 * Geocoding API Endpoint
 * 
 * Wraps Nominatim for forward/reverse geocoding.
 * Uses self-hosted instance if available, falls back to public API.
 * 
 * Endpoints:
 *   GET /api/geocode?q=Chamberí,Madrid         → Forward geocoding
 *   GET /api/geocode?lat=40.4168&lng=-3.7038   → Reverse geocoding
 *   GET /api/geocode/status                     → Service status
 */

import { NextRequest, NextResponse } from 'next/server';
import { geocode, reverseGeocode, getStatus } from '@/lib/geocoding/nominatim';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Check if this is a status request
    if (searchParams.get('status') === 'true') {
      const status = await getStatus();
      return NextResponse.json({ success: true, ...status });
    }
    
    const query = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const countryCode = searchParams.get('country') || 'es'; // Default to Spain
    
    // Forward geocoding
    if (query) {
      console.log(`[Geocode API] Forward: "${query}"`);
      
      const results = await geocode(query, {
        countryCode,
        limit,
      });
      
      return NextResponse.json({
        success: true,
        query,
        results,
        count: results.length,
      });
    }
    
    // Reverse geocoding
    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return NextResponse.json(
          { success: false, error: 'Invalid lat/lng values' },
          { status: 400 }
        );
      }
      
      console.log(`[Geocode API] Reverse: ${latitude}, ${longitude}`);
      
      const result = await reverseGeocode(latitude, longitude);
      
      return NextResponse.json({
        success: true,
        lat: latitude,
        lng: longitude,
        result,
      });
    }
    
    // No valid parameters
    return NextResponse.json(
      { 
        success: false, 
        error: 'Missing parameters. Use ?q=address or ?lat=X&lng=Y',
        examples: [
          '/api/geocode?q=Chamberí,Madrid',
          '/api/geocode?lat=40.4168&lng=-3.7038',
          '/api/geocode?status=true',
        ],
      },
      { status: 400 }
    );
    
  } catch (error: any) {
    console.error('[Geocode API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Geocoding failed' },
      { status: 500 }
    );
  }
}

