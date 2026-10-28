import { callGeminiRest } from '@/lib/gemini-rest-client';
import { LifestyleProfile } from '@/types/lifestyle';

// Helper to geocode address using Google Maps Geocoding API
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
  } catch (e) {
    console.error(`Geocoding failed for "${address}":`, e);
  }
  return null;
}

export async function extractProfileFromText(text: string): Promise<LifestyleProfile> {
  const prompt = `
    Extract a structured lifestyle profile from the user's text.
    Identify anchors (key locations they visit often), vibe preferences (what they want nearby), and PROPERTY DNA (structural requirements).
    
    For locations, infer coordinates if possible, but ALWAYS provide a specific text address that can be geocoded.
    Example: "I work at Torre Espacio" -> address: "Torre Espacio, Madrid, Spain".
    
    For Property DNA, map fuzzy requests to specific fields:
    - "I hate stairs" -> has_elevator: true
    - "I need sun" -> is_exterior: true OR has_terrace: true
    - "Penthouse" -> floor_level: "top"
    - "No noise" -> floor_level: "top" (infer)
    
    USER TEXT:
    "${text}"
  `;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      anchors: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            location: {
              type: 'OBJECT',
              properties: {
                lat: { type: 'NUMBER' },
                lng: { type: 'NUMBER' },
                address: { type: 'STRING' },
              },
              required: ['address'], // Relaxed: lat/lng optional initially
            },
            type: {
              type: 'STRING',
              enum: ['work', 'gym', 'social', 'family', 'other'],
            },
            transport_mode: {
              type: 'STRING',
              enum: ['driving', 'transit', 'cycling', 'walking'],
            },
            max_duration_minutes: { type: 'NUMBER' },
            frequency_per_week: { type: 'NUMBER' },
          },
          required: ['location', 'type', 'transport_mode', 'max_duration_minutes', 'frequency_per_week'],
        },
      },
      vibe: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            amenity_type: { type: 'STRING' },
            importance: {
              type: 'STRING',
              enum: ['must_have', 'nice_to_have'],
            },
            specifics: {
              type: 'ARRAY',
              items: { type: 'STRING' },
            },
          },
          required: ['amenity_type', 'importance', 'specifics'],
        },
      },
      property_dna: {
        type: 'OBJECT',
        properties: {
          floor_level: { type: 'STRING', enum: ['ground', 'intermediate', 'top'] },
          has_elevator: { type: 'BOOLEAN' },
          is_exterior: { type: 'BOOLEAN' },
          has_terrace: { type: 'BOOLEAN' },
          has_balcony: { type: 'BOOLEAN' },
          has_pool: { type: 'BOOLEAN' },
          has_garage: { type: 'BOOLEAN' },
          has_garden: { type: 'BOOLEAN' },
          condition: { type: 'STRING', enum: ['new', 'good', 'renovate'] },
          min_bedrooms: { type: 'NUMBER' },
          min_bathrooms: { type: 'NUMBER' }
        }
      }
    },
    required: ['anchors', 'vibe'],
  };

  const result = await callGeminiRest(prompt, {
    model: 'gemini-2.5-flash',
    responseMimeType: 'application/json',
    responseSchema: responseSchema,
    temperature: 0.1,
  });

  if (!result.success || !result.text) {
    throw new Error(`AI Extraction Failed: ${result.error || 'No text returned'}`);
  }

  try {
    const profile = JSON.parse(result.text) as LifestyleProfile;

    // Post-processing: Geocode anchors if lat/lng is missing or 0,0
    if (profile.anchors) {
      for (const anchor of profile.anchors) {
        const loc = anchor.location;
        const needsGeocoding = !loc.lat || !loc.lng || (loc.lat === 0 && loc.lng === 0);
        
        if (needsGeocoding && loc.address) {
          console.log(`📍 Geocoding anchor: "${loc.address}"...`);
          const coords = await geocodeAddress(loc.address);
          if (coords) {
            console.log(`   -> Found: ${coords.lat}, ${coords.lng}`);
            anchor.location.lat = coords.lat;
            anchor.location.lng = coords.lng;
          } else {
            console.warn(`   -> Failed to geocode: "${loc.address}"`);
          }
        }
      }
    }

    return profile;
  } catch (e) {
    console.error('Extraction parsing/geocoding error:', e);
    throw new Error('Failed to parse AI response or geocode anchors');
  }
}
