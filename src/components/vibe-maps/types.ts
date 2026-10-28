// Vibe Maps shared types

export interface ItineraryItem {
  purpose: string;
  query: string;
}

export interface VibeArea {
  name: string;
  lat: number;
  lng: number;
  radius: number;
  color: string;
  why?: string;
  vibes?: string[];
  itinerary?: ItineraryItem[];
  grounded?: boolean;
  // Stay-specific fields (for Test 2.1)
  priceTier?: 1 | 2 | 3;  // 1 = budget, 2 = mid-range, 3 = luxury
  areaType?: 'activity' | 'stay';  // For distinguishing area types
  bookingUrls?: {
    airbnb: string;
    booking: string;
  };
  // Dual-layer fields (for Test 3.1)
  dualLayerIndex?: number;  // 1, 2, 3... within its type
  dualLayerType?: 'stay' | 'activity';  // For dual-layer mode
  // City character fields (for Test 7.1)
  characterType?: 'historic' | 'nightlife' | 'cultural' | 'foodie' | 'local' | 'tourist' | 'nature' | 'shopping';
  specificPercent?: number;  // % of time at specific places (restaurants, landmarks)
  areaPercent?: number;      // % of time just exploring/wandering
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  areas?: VibeArea[];
  rawResponse?: unknown;  // Raw JSON response for "Copy Raw Response" button
}

export interface ChatSession {
  id: string;
  title: string;
  city?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

// Create circle GeoJSON helper
export const createCircleGeoJSON = (lng: number, lat: number, radiusMeters: number): GeoJSON.Feature => {
  const points = 64;
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = km * Math.cos(angle);
    const dy = km * Math.sin(angle);
    
    const deltaLng = dx / (111.32 * Math.cos(lat * Math.PI / 180));
    const deltaLat = dy / 110.574;
    
    coords.push([lng + deltaLng, lat + deltaLat]);
  }
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    },
    properties: {}
  };
};

