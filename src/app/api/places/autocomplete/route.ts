import { NextRequest, NextResponse } from 'next/server';

/**
 * Places Autocomplete - Geoapify-backed implementation
 *
 * PURPOSE:
 * - Take ANY location hint (neighbourhood, city, partial address) from portals.
 * - Return the best-available normalized suggestion with:
 *   - description: pretty label for UI
 *   - lat/lng: coordinates (centre if only area is known)
 *   - city/state/country: normalized components for DB
 *
 * This is the core of the \"best available data\" strategy for ListingEditor:
 * - If we only know \"Portals Nous, Calvià\" → we get centre coordinates.
 * - If we know coordinates only → reverse-geocode via /api/places/reverse-geocode.
 */

const GEOAPIFY_API_KEY =
  process.env.GEOAPIFY_API_KEY || '2152837cef1b4a159356a9665a701bdd';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get('input');
  const locationBiasParam = searchParams.get('locationBias'); // optional lat,lng

  if (!input) {
    return NextResponse.json({ predictions: [] });
  }

  try {
    const params = new URLSearchParams();
    params.set('text', input);
    params.set('apiKey', GEOAPIFY_API_KEY);
    params.set('limit', '8');
    params.set('lang', 'es');

    // Focus primarily on Spain, but allow neighbouring context
    params.set('filter', 'countrycode:es,pt,fr');

    if (locationBiasParam) {
      const [latStr, lngStr] = locationBiasParam.split(',');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        // Geoapify expects proximity=lon,lat
        params.set('bias', `proximity:${lng},${lat}`);
      }
    }

    const url = `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
        const errorText = await response.text();
      console.error('Geoapify Autocomplete Error:', errorText);
      throw new Error(`Geoapify autocomplete error: ${response.status}`);
    }

    const data = await response.json();
    const features = Array.isArray(data.features) ? data.features : [];

    const predictions = features
      .map((feature: any) => {
        const props = feature?.properties;
        if (!props) return null;

        const description =
          props.formatted ||
          [props.name, props.street, props.city, props.country]
            .filter(Boolean)
            .join(', ');

        const city =
          props.city ||
          props.town ||
          props.village ||
          props.suburb ||
          props.neighbourhood ||
          '';

        const state = props.state || props.county || '';
        const country = props.country || props.country_code || '';

        return {
          description,
          place_id: props.place_id || `${props.osm_type || ''}-${props.osm_id || ''}`,
          lat: props.lat,
          lng: props.lon,
          city,
          state,
          country,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ predictions });
  } catch (error: any) {
    console.error('Autocomplete proxy error (Geoapify):', error);
    return NextResponse.json({ predictions: [], error: error.message });
  }
}

