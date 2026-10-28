'use client';

import { useState, useCallback, useRef } from 'react';
import { ChatHistorySidebar, ChatPanel, MapPanel, TestPickerPanel, TestResultPanel } from '@/components/vibe-maps';
import type { VibeArea, ChatMessage, ChatSession, ViewState, BuildingBlockTest } from '@/components/vibe-maps';
import { testLogger, type TestLog } from '@/lib/vibe-maps/testLogger';
import { generateBookingURLs, getPriceTierColor, getPriceTierDisplay } from '@/lib/vibe-maps/bookingUrls';
import * as turf from '@turf/turf';

const GEMINI_API_KEY = '';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Calculate smart radii based on proximity to avoid overlap
// Returns map of index -> radius in meters
const calculateSmartRadii = (
  areas: Array<{ lat: number; lng: number; radius?: number }>,
  minRadius = 150,
  maxRadius = 600,
  overlapFactor = 0.4 // Allow 40% overlap max
): number[] => {
  if (areas.length === 0) return [];
  if (areas.length === 1) return [maxRadius];
  
  // Calculate minimum distance from each area to any other area
  const minDistances: number[] = areas.map((area, i) => {
    let minDist = Infinity;
    for (let j = 0; j < areas.length; j++) {
      if (i === j) continue;
      const from = turf.point([area.lng, area.lat]);
      const to = turf.point([areas[j].lng, areas[j].lat]);
      const dist = turf.distance(from, to, { units: 'meters' });
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  });
  
  // Set radius based on minimum distance (half the distance * overlap factor)
  return minDistances.map((minDist, i) => {
    // If area has a specified radius, use it as a hint but still constrain
    const hintRadius = areas[i].radius || maxRadius;
    // Radius should be at most half the distance to nearest neighbor (adjusted by overlap factor)
    const proximityRadius = (minDist / 2) * (1 - overlapFactor);
    // Take the smaller of hint and proximity-based radius
    const smartRadius = Math.min(hintRadius, proximityRadius);
    // Clamp to min/max
    return Math.max(minRadius, Math.min(maxRadius, smartRadius));
  });
};

// Detect if query is about staying/accommodation (Test 2.1 detection)
const isStayQuery = (query: string): boolean => {
  const stayKeywords = [
    'stay', 'hotel', 'airbnb', 'accommodation', 'sleep', 'lodge', 'hostel',
    'where to stay', 'place to stay', 'neighborhood to stay', 'book', 'booking',
    'romantic trip', 'honeymoon', 'vacation rental', 'apartment'
  ];
  const lowerQuery = query.toLowerCase();
  return stayKeywords.some(keyword => lowerQuery.includes(keyword));
};

export default function VibeMapsPage() {
  // View state
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTestPicker, setShowTestPicker] = useState(false);
  
  // Test mode state
  const [activeTest, setActiveTest] = useState<BuildingBlockTest | null>(null);
  const [testLog, setTestLog] = useState<TestLog | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  
  // Landing page input
  const [tripInput, setTripInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  
  // Map state
  const [areas, setAreas] = useState<VibeArea[]>([]);
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0);
  const [showCard, setShowCard] = useState(false);
  const [cardPersistent, setCardPersistent] = useState(false);
  const [currentCity, setCurrentCity] = useState<string>('');
  const [currentQueryType, setCurrentQueryType] = useState<'activity' | 'stay'>('activity');
  const [travelLinePairs, setTravelLinePairs] = useState<string[]>(['stay-to-activity', 'activity-to-activity']);
  
  // Intersection data for Test 5.3
  interface IntersectionData {
    polygonA: {
      feature: GeoJSON.Feature;
      color: string;
      description: string;
      center?: { name: string; lat: number; lng: number };
    };
    polygonB: {
      feature: GeoJSON.Feature;
      color: string;
      description: string;
      center?: { name: string; lat: number; lng: number };
    };
    intersectionZones: GeoJSON.Feature[];
    intersectionArea: number;
  }
  const [intersectionData, setIntersectionData] = useState<IntersectionData | null>(null);
  
  // Matrix data for Test 6.2
  interface MatrixIsochrone {
    mode: 'walk' | 'transit' | 'drive';
    feature: GeoJSON.Feature;
    color: string;
    radiusKm: number;
  }
  interface MatrixPerson {
    name: string;
    location: { lat: number; lng: number };
    isochrones: MatrixIsochrone[];
  }
  interface MatrixCell {
    modeA: 'walk' | 'transit' | 'drive';
    modeB: 'walk' | 'transit' | 'drive';
    intersection: GeoJSON.Feature | null;
    areaSqKm: number;
    sizeLabel: string;
    blendedColor: string;
  }
  interface MatrixData {
    personA: MatrixPerson;
    personB: MatrixPerson;
    cells: MatrixCell[];
    travelTime: number;
    travelUnit: string;
  }
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [hoveredCell, setHoveredCell] = useState<MatrixCell | null>(null);
  const [viewState, setViewState] = useState<ViewState>({
    longitude: 2.1686,
    latitude: 41.3874,
    zoom: 12
  });
  
  // Generate areas from Gemini (with optional test logging)
  const generateAreas = useCallback(async (
    query: string, 
    isTestMode = false
  ): Promise<{ areas: VibeArea[], city: string, reasoning: string } | null> => {
    const prompt = `You are a local friend who LOVES helping people discover amazing places. Someone just told you about their trip:

"${query}"

Your job: Recommend the BEST neighborhoods for THIS SPECIFIC trip. Think about what they said and WHY certain areas would be perfect for them.

CRITICAL RULES:
1. Pick 3-5 neighborhoods (use your judgment - fewer is better if areas would overlap on a map)
2. NO OVERLAPPING AREAS - if two great spots are very close, just pick the better one
3. Each area should feel DISTINCT and offer something different
4. ACCURACY MATTERS - use real coordinates, verify with Google Search

FOR EACH AREA's "why" description (THIS IS IMPORTANT):
Write like a knowledgeable friend, not a guidebook. Use ONE of these approaches:

1. PERSONAL (when you can connect to what they said):
   "Since you're after nightlife, this is where the real party happens after 1am"
   "For the romantic vibe you want, these cobblestone streets are pure magic at sunset"

2. SOCIAL PROOF (when you can't be personal, say what OTHERS love it for):
   "This is where locals actually go for Sunday brunch - tourists haven't found it yet"
   "Foodies obsess over this area for the hidden tapas bars"
   "Young creatives have colonized this neighborhood for the cheap studio spaces"

3. HISTORY/EVOLUTION (add texture with how the area has changed):
   "Once the industrial docks, now reborn as the city's art gallery district"
   "This was sketchy 10 years ago, now it's THE neighborhood for craft cocktails"
   "Old-school working class area that kept its soul while adding great cafes"

LANGUAGE & CONTEXT AWARENESS:
- Users may write in ANY language or mix languages - understand the MEANING, not just the words
- Don't just echo their words back - understand the INTENT behind what they said
- "siesta" means nap/rest (at home/hotel), not "relaxing at a cafe" - be culturally accurate
- If they mention wanting "peace for dad's siesta", recommend quiet NEIGHBORHOODS, don't suggest "cafes for siestas"
- Translate cultural concepts correctly: "tapeo" = bar-hopping for tapas, "paseo" = evening stroll, etc.

NEVER write generic Lonely Planet style: "A vibrant area known for its restaurants"
ALWAYS make it feel like insider knowledge or a story.

Return ONLY valid JSON:
{
  "city": "City Name",
  "reasoning": "I picked these spots because [reference their trip]. [Why this mix works for them].",
  "centerLat": XX.XXXX,
  "centerLng": X.XXXX,
  "areas": [
    {
      "name": "Neighborhood Name",
      "lat": XX.XXXX,
      "lng": X.XXXX,
      "radius": 400,
      "color": "#HEXCODE",
      "why": "Personal/social proof/history description - max 160 chars",
      "itinerary": [
        { "purpose": "🍽️ Activity", "query": "search terms" },
        { "purpose": "🍺 Activity", "query": "search terms" },
        { "purpose": "🌙 Activity", "query": "search terms" }
      ]
    }
  ]
}

COLORS: "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"
Use Google Search to verify real places and accurate coordinates!`;

    if (isTestMode) testLogger.logStep('Prepared prompt', { promptLength: prompt.length });

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8000, topP: 0.95 },
        tools: [{ googleSearch: {} }]
      };

      // Log API call start
      let callId = '';
      if (isTestMode) {
        callId = testLogger.startAPICall('Gemini 2.5 Pro', 'generateContent', {
          method: 'POST',
          url: apiUrl,
          body: requestBody,
          prompt: prompt
        });
        testLogger.logStep('Making Gemini API call');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();

      // Log API call completion
      if (isTestMode && callId) {
        testLogger.completeAPICall(
          callId, 
          { status: response.status, statusText: response.statusText, body: data },
          response.ok
        );
      }
      
      if (!response.ok) {
        const errorMsg = data.error?.message || 'API error';
        if (isTestMode) testLogger.logStep('API error', { error: errorMsg });
        throw new Error(errorMsg);
      }
      
      let text = '';
      data.candidates?.[0]?.content?.parts?.forEach((p: { text?: string }) => {
        if (p.text) text += p.text;
      });

      if (isTestMode) testLogger.logStep('Received response', { textLength: text.length });
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        if (isTestMode) testLogger.logStep('Failed to extract JSON', { rawText: text.substring(0, 500) });
        throw new Error('No JSON found');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const grounded = !!data.candidates?.[0]?.groundingMetadata?.groundingChunks?.length;

      if (isTestMode) testLogger.logStep('Parsed JSON', { city: parsed.city, areaCount: parsed.areas?.length, grounded });
      
      const areasArray = parsed.areas || [];
      const rawAreas: VibeArea[] = areasArray.map((area: VibeArea, i: number) => ({
        name: area.name || `Area ${i + 1}`,
        lat: parseFloat(String(area.lat)) || 0,
        lng: parseFloat(String(area.lng)) || 0,
        radius: parseInt(String(area.radius)) || 400,
        color: area.color || ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][i % 5],
        why: area.why || 'A great area for your trip!',
        itinerary: area.itinerary || [],
        grounded
      }));
      
      // Calculate smart radii based on proximity to avoid overlap
      const smartRadii = calculateSmartRadii(
        rawAreas.map((a: VibeArea) => ({ lat: a.lat, lng: a.lng, radius: a.radius })),
        150, 500, 0.3
      );
      const newAreas: VibeArea[] = rawAreas.map((area: VibeArea, i: number) => ({
        ...area,
        radius: smartRadii[i]
      }));
      
      // Update map center
      if (parsed.centerLat && parsed.centerLng) {
        setViewState({
          longitude: parseFloat(String(parsed.centerLng)),
          latitude: parseFloat(String(parsed.centerLat)),
          zoom: 12
        });
      }

      if (isTestMode) testLogger.logStep('Areas generated successfully', { areaNames: newAreas.map(a => a.name) });
      
      return { 
        areas: newAreas, 
        city: parsed.city || 'Unknown',
        reasoning: parsed.reasoning || `I found ${newAreas.length} great spots for your trip!`
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Generation error:', error);
      if (isTestMode) testLogger.logStep('Generation failed', { error: errMsg });
      return null;
    }
  }, []);

  // Generate STAY areas from Gemini (Test 2.1)
  // This is distinct from generateAreas - focuses on accommodation neighborhoods
  const generateStayAreas = useCallback(async (
    query: string, 
    isTestMode = false
  ): Promise<{ areas: VibeArea[], city: string, reasoning: string } | null> => {
    const prompt = `You are a local friend helping someone find the perfect neighborhood to STAY in. They just told you:

"${query}"

Your job: Recommend 2-5 neighborhoods for ACCOMMODATION that match THEIR specific trip. Think about what kind of experience they want.

CRITICAL RULES:
1. Pick 2-5 neighborhoods (fewer is better - only add more if they're truly distinct options)
2. NO OVERLAPPING AREAS - if two hotel areas are close together, just pick the better one
3. Each area should offer a DIFFERENT vibe or price point
4. ACCURACY MATTERS - use real coordinates, verify with Google Search

FOR EACH AREA's "why" description (THIS IS IMPORTANT):
Write like a knowledgeable friend, not a guidebook. Use ONE of these approaches:

1. PERSONAL (when you can connect to what they said):
   "For the romantic vibe you're after, waking up here with river views is unbeatable"
   "Since you mentioned nightlife, you'll stumble home in 5 minutes from the best clubs"

2. SOCIAL PROOF (when you can't be personal, say what types of travelers love it):
   "Couples obsess over this area for the intimate boutique hotels"
   "Business travelers secretly love it here - great cafes for remote work"
   "Backpackers have claimed this neighborhood for the hostel scene"

3. HISTORY/EVOLUTION (add texture with how the area has changed):
   "The old merchant quarter - now the most coveted address for design hotels"
   "Was gritty 15 years ago, now has that perfect 'cool but convenient' balance"
   "Traditional neighborhood that kept its character while adding boutique stays"

LANGUAGE & CONTEXT AWARENESS:
- Users may write in ANY language or mix languages - understand the MEANING, not just the words
- Don't just echo their words back - understand the INTENT behind what they said
- "siesta" means nap/rest (at home/hotel), not "relaxing at a cafe" - if they want siesta time, recommend QUIET neighborhoods good for afternoon rest
- Cultural accuracy matters: understand what users actually want, not just the words they use
- Translate cultural concepts correctly and apply them to accommodation recommendations

NEVER write generic: "A central area with good transport links"
ALWAYS make it feel like insider knowledge.

Also write a "reasoning" (2-3 sentences) explaining your picks - like a friend would say "I'd suggest these because..."

Also extract from their message:
- "guests": number of people traveling (look for "couple"=2, "family"=4, "with parents"=3, "solo"=1, or explicit numbers)
- "budgetHint": "budget" | "mid" | "luxury" (based on words like "cheap", "upmarket", "splurge", etc.)

Return ONLY valid JSON:
{
  "city": "City Name",
  "guests": 2,
  "budgetHint": "mid",
  "reasoning": "I picked these areas because [reference their trip]. [Why this selection works for them].",
  "centerLat": XX.XXXX,
  "centerLng": X.XXXX,
  "areas": [
    {
      "name": "Neighborhood Name",
      "lat": XX.XXXX,
      "lng": X.XXXX,
      "radius": 500,
      "priceTier": 1-3,
      "why": "Personal/social proof/history description - max 160 chars",
      "nearbyHighlights": [
        { "emoji": "🛍️", "activity": "Activity", "query": "search terms" },
        { "emoji": "🍽️", "activity": "Activity", "query": "search terms" },
        { "emoji": "🚇", "activity": "Activity", "query": "search terms" }
      ]
    }
  ]
}

Use Google Search to verify real neighborhoods and accurate coordinates!`;

    if (isTestMode) testLogger.logStep('Prepared STAY prompt', { promptLength: prompt.length });

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8000, topP: 0.95 },
        tools: [{ googleSearch: {} }]
      };

      // Log API call start
      let callId = '';
      if (isTestMode) {
        callId = testLogger.startAPICall('Gemini 2.5 Pro', 'generateContent', {
          method: 'POST',
          url: apiUrl,
          body: requestBody,
          prompt: prompt
        });
        testLogger.logStep('Making Gemini API call for STAY areas');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();

      // Log API call completion
      if (isTestMode && callId) {
        testLogger.completeAPICall(
          callId, 
          { status: response.status, statusText: response.statusText, body: data },
          response.ok
        );
      }
      
      if (!response.ok) {
        const errorMsg = data.error?.message || 'API error';
        if (isTestMode) testLogger.logStep('API error', { error: errorMsg });
        throw new Error(errorMsg);
      }
      
      let text = '';
      data.candidates?.[0]?.content?.parts?.forEach((p: { text?: string }) => {
        if (p.text) text += p.text;
      });

      if (isTestMode) testLogger.logStep('Received STAY response', { textLength: text.length });
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        if (isTestMode) testLogger.logStep('Failed to extract JSON', { rawText: text.substring(0, 500) });
        throw new Error('No JSON found');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const grounded = !!data.candidates?.[0]?.groundingMetadata?.groundingChunks?.length;
      const cityName = parsed.city || 'Unknown';

      if (isTestMode) testLogger.logStep('Parsed STAY JSON', { city: cityName, areaCount: parsed.areas?.length, grounded });
      
      interface StayAreaResponse {
        name: string;
        lat: number | string;
        lng: number | string;
        radius?: number | string;
        priceTier?: number;
        why?: string;
        nearbyHighlights?: Array<{ emoji?: string; activity?: string; query?: string; purpose?: string }>;
      }
      
      const areasArray = parsed.areas || [];
      
      // Use Gemini-extracted travel details for smarter booking URLs
      const guests = parsed.guests as number | undefined;
      const budgetHint = parsed.budgetHint as 'budget' | 'mid' | 'luxury' | undefined;
      
      const newAreas: VibeArea[] = areasArray.map((area: StayAreaResponse, i: number) => {
        const priceTier = (area.priceTier as 1 | 2 | 3) || 2;
        
        // Generate booking URLs with Gemini-extracted guests and budget
        const bookingUrls = generateBookingURLs({
          areaName: area.name || `Area ${i + 1}`,
          city: cityName,
          guests: guests,
          priceTier: budgetHint === 'budget' ? 1 : budgetHint === 'luxury' ? 3 : priceTier
        });
        
        return {
          name: area.name || `Area ${i + 1}`,
          lat: parseFloat(String(area.lat)) || 0,
          lng: parseFloat(String(area.lng)) || 0,
          radius: parseInt(String(area.radius)) || 500,
          color: getPriceTierColor(priceTier),
          why: area.why || 'A great area to stay!',
          // Convert nearbyHighlights to itinerary format for consistency
          itinerary: (area.nearbyHighlights || []).map((h: { emoji?: string; activity?: string; query?: string; purpose?: string }) => ({
            purpose: h.emoji ? `${h.emoji} ${h.activity || 'Activity'}` : (h.purpose || '🏨 Nearby'),
            query: h.query || `things to do near ${area.name}`
          })),
          grounded,
          priceTier,
          areaType: 'stay' as const,
          bookingUrls
        };
      });
      
      // Update map center
      if (parsed.centerLat && parsed.centerLng) {
        setViewState({
          longitude: parseFloat(String(parsed.centerLng)),
          latitude: parseFloat(String(parsed.centerLat)),
          zoom: 12
        });
      }

      // Calculate smart radii based on proximity to avoid overlap
      const smartRadii = calculateSmartRadii(
        newAreas.map(a => ({ lat: a.lat, lng: a.lng, radius: a.radius })),
        150, 500, 0.3
      );
      const smartAreas = newAreas.map((area, i) => ({
        ...area,
        radius: smartRadii[i]
      }));

      if (isTestMode) {
        testLogger.logStep('STAY areas generated successfully', { 
          areaNames: smartAreas.map(a => a.name),
          priceTiers: smartAreas.map(a => a.priceTier),
          bookingUrlsGenerated: smartAreas.every(a => a.bookingUrls)
        });
      }
      
      return { 
        areas: smartAreas, 
        city: cityName,
        reasoning: parsed.reasoning || `I found ${smartAreas.length} great neighborhoods to stay in!`
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('STAY generation error:', error);
      if (isTestMode) testLogger.logStep('STAY generation failed', { error: errMsg });
      return null;
    }
  }, []);

  // Generate DUAL-LAYER areas from Gemini (Test 3.1)
  // Single call produces both STAY areas (blue) and ACTIVITY areas (orange)
  const generateDualLayerAreas = useCallback(async (
    query: string, 
    isTestMode = false
  ): Promise<{ areas: VibeArea[], city: string, reasoning: string, travelLinePairs?: string[] } | null> => {
    const prompt = `You are a local friend helping someone plan the PERFECT trip. They want to know both WHERE TO STAY and WHAT TO DO. They said:

"${query}"

Your job: In ONE response, recommend:
1. **2 neighborhoods to STAY** (for accommodation) - these should be well-located bases
2. **3 neighborhoods for ACTIVITIES** (things to do) - these can be anywhere interesting

CRITICAL RULES:
- Stay areas and activity areas CAN be different (often the best places to do things aren't where you'd stay)
- NO OVERLAPPING CIRCLES - each area should be distinct on a map
- Stay areas need: good hotels/Airbnbs, safe, convenient
- Activity areas need: unique experiences, memorable spots

FOR EACH AREA's "why" description (THIS IS IMPORTANT):
Write like a knowledgeable friend, not a guidebook. Use ONE of these approaches:

1. PERSONAL (when you can connect to what they said):
   "For the romantic escape you're planning, this is THE sunset spot"
   "Since you're celebrating, you'll love the champagne bars here"

2. SOCIAL PROOF (when you can't be personal, say what others love it for):
   "Honeymooners have discovered this quiet corner for a reason"
   "This is where the fashion crowd stays during the shows"
   "Artists and writers have always gravitated here"

3. HISTORY/EVOLUTION (add texture with how the area has changed):
   "The old artisan quarter - now filled with ateliers turned boutique hotels"
   "Once a fishing village, now the most romantic walk in the city"
   "Locals remember when this was off-limits - now it's the coolest strip"

LANGUAGE & CONTEXT AWARENESS:
- Users may write in ANY language or mix languages - understand the MEANING, not just the words
- Don't just echo their words back - understand the INTENT behind what they said
- "siesta" = nap at hotel (recommend quiet neighborhoods), "tapeo" = bar-hopping, "paseo" = evening stroll
- If they say "peaceful for dad's siesta" → recommend quiet STAY areas, don't suggest "cafes for siestas"
- Cultural accuracy matters: understand what users actually want, not just the words they use

NEVER write generic: "A beautiful area with nice restaurants"
ALWAYS make it feel like insider knowledge or a story.

Write a "reasoning" (2-3 sentences) explaining your overall plan - why this combo works for them.

Also extract from their message:
- "guests": number of people traveling (look for "couple"=2, "family"=4, "with parents"=3, "solo"=1, or explicit numbers)
- "budgetHint": "budget" | "mid" | "luxury" (based on words like "cheap", "upmarket", "splurge", etc.)

Return ONLY valid JSON:
{
  "city": "City Name",
  "guests": 2,
  "budgetHint": "mid",
  "reasoning": "I set you up with [stay reasoning] for your base, and [activity reasoning] for your adventures...",
  "centerLat": XX.XXXX,
  "centerLng": X.XXXX,
  "stayAreas": [
    {
      "name": "Neighborhood",
      "lat": XX.XXXX,
      "lng": X.XXXX,
      "radius": 500,
      "priceTier": 1-3,
      "why": "Personal/social proof/history description - max 160 chars",
      "nearbyHighlights": [
        { "emoji": "🍽️", "activity": "Activity", "query": "search terms" }
      ]
    }
  ],
  "activityAreas": [
    {
      "name": "Neighborhood", 
      "lat": XX.XXXX,
      "lng": X.XXXX,
      "radius": 400,
      "why": "Personal/social proof/history description - max 160 chars",
      "itinerary": [
        { "purpose": "🎨 Activity", "query": "search terms" }
      ]
    }
  ],
  "travelLinePairs": ["stay-to-activity", "activity-to-activity"]
}

TRAVEL LINE PAIRS (for calculating travel times between areas):
- "stay-to-activity": Lines from each stay to each activity (default: include this)
- "activity-to-activity": Lines between activity areas (default: include this)
- "stay-to-stay": Lines between stay areas (only if user wants to compare stays)

Include the pairs that make sense for this trip. Default is both stay-to-activity and activity-to-activity.

Use Google Search to verify real places and accurate coordinates!`;

    if (isTestMode) testLogger.logStep('Prepared DUAL-LAYER prompt', { promptLength: prompt.length });

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8000, topP: 0.95 },
        tools: [{ googleSearch: {} }]
      };

      let callId = '';
      if (isTestMode) {
        callId = testLogger.startAPICall('Gemini 2.5 Pro', 'generateContent', {
          method: 'POST',
          url: apiUrl,
          body: requestBody,
          prompt: prompt
        });
        testLogger.logStep('Making Gemini API call for DUAL-LAYER areas');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();

      if (isTestMode && callId) {
        testLogger.completeAPICall(
          callId, 
          { status: response.status, statusText: response.statusText, body: data },
          response.ok
        );
      }
      
      if (!response.ok) {
        const errorMsg = data.error?.message || 'API error';
        if (isTestMode) testLogger.logStep('API error', { error: errorMsg });
        throw new Error(errorMsg);
      }
      
      let text = '';
      data.candidates?.[0]?.content?.parts?.forEach((p: { text?: string }) => {
        if (p.text) text += p.text;
      });

      if (isTestMode) testLogger.logStep('Received DUAL-LAYER response', { textLength: text.length });
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        if (isTestMode) testLogger.logStep('Failed to extract JSON', { rawText: text.substring(0, 500) });
        throw new Error('No JSON found');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const grounded = !!data.candidates?.[0]?.groundingMetadata?.groundingChunks?.length;
      const cityName = parsed.city || 'Unknown';

      if (isTestMode) testLogger.logStep('Parsed DUAL-LAYER JSON', { 
        city: cityName, 
        stayCount: parsed.stayAreas?.length,
        activityCount: parsed.activityAreas?.length,
        grounded 
      });
      
      // Process STAY areas (blue tones)
      const stayColors = ['#3B82F6', '#60A5FA', '#93C5FD']; // Blue palette
      
      // Use Gemini-extracted travel details for smarter booking URLs
      const guests = parsed.guests as number | undefined;
      const budgetHint = parsed.budgetHint as 'budget' | 'mid' | 'luxury' | undefined;
      
      const stayAreas: VibeArea[] = (parsed.stayAreas || []).map((area: {
        name?: string;
        lat?: number | string;
        lng?: number | string;
        radius?: number | string;
        priceTier?: number;
        why?: string;
        nearbyHighlights?: { emoji?: string; activity?: string; query?: string }[];
      }, i: number) => {
        const priceTier = (area.priceTier || 2) as 1 | 2 | 3;
        const bookingUrls = generateBookingURLs({ 
          areaName: area.name || '', 
          city: cityName,
          guests: guests,
          priceTier: budgetHint === 'budget' ? 1 : budgetHint === 'luxury' ? 3 : priceTier
        });
        return {
          name: area.name || `Stay ${i + 1}`,
          lat: parseFloat(String(area.lat)) || 0,
          lng: parseFloat(String(area.lng)) || 0,
          radius: parseInt(String(area.radius)) || 500,
          color: stayColors[i % stayColors.length],
          why: area.why || 'Great place to stay!',
          itinerary: (area.nearbyHighlights || []).map((h) => ({
            purpose: h.emoji ? `${h.emoji} ${h.activity || 'Activity'}` : '🏨 Nearby',
            query: h.query || `things to do near ${area.name}`
          })),
          grounded,
          priceTier,
          areaType: 'stay' as const,
          bookingUrls,
          dualLayerIndex: i + 1,
          dualLayerType: 'stay' as const
        };
      });

      // Process ACTIVITY areas (orange tones)
      const activityColors = ['#F97316', '#FB923C', '#FDBA74']; // Orange palette
      const activityAreas: VibeArea[] = (parsed.activityAreas || []).map((area: {
        name?: string;
        lat?: number | string;
        lng?: number | string;
        radius?: number | string;
        why?: string;
        itinerary?: { purpose?: string; query?: string }[];
      }, i: number) => ({
        name: area.name || `Activity ${i + 1}`,
        lat: parseFloat(String(area.lat)) || 0,
        lng: parseFloat(String(area.lng)) || 0,
        radius: parseInt(String(area.radius)) || 400,
        color: activityColors[i % activityColors.length],
        why: area.why || 'Great place to explore!',
        itinerary: area.itinerary || [],
        grounded,
        areaType: 'activity' as const,
        dualLayerIndex: i + 1,
        dualLayerType: 'activity' as const
      }));

      // Combine: Stay areas first, then Activity areas
      const combinedAreas = [...stayAreas, ...activityAreas];
      
      // Calculate smart radii based on proximity to avoid overlap
      const smartRadii = calculateSmartRadii(
        combinedAreas.map(a => ({ lat: a.lat, lng: a.lng, radius: a.radius })),
        150,  // min radius
        500,  // max radius
        0.3   // allow 30% overlap max
      );
      
      // Apply smart radii to all areas
      const allAreas = combinedAreas.map((area, i) => ({
        ...area,
        radius: smartRadii[i]
      }));
      
      // Update map center
      if (parsed.centerLat && parsed.centerLng) {
        setViewState({
          longitude: parseFloat(String(parsed.centerLng)),
          latitude: parseFloat(String(parsed.centerLat)),
          zoom: 12
        });
      }

      if (isTestMode) {
        testLogger.logStep('DUAL-LAYER areas generated successfully', { 
          stayNames: stayAreas.map(a => a.name),
          activityNames: activityAreas.map(a => a.name),
          totalAreas: allAreas.length
        });
      }
      
      return { 
        areas: allAreas, 
        city: cityName,
        reasoning: parsed.reasoning || `I found ${stayAreas.length} places to stay and ${activityAreas.length} areas to explore!`,
        travelLinePairs: parsed.travelLinePairs || ['stay-to-activity', 'activity-to-activity']
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('DUAL-LAYER generation error:', error);
      if (isTestMode) testLogger.logStep('DUAL-LAYER generation failed', { error: errMsg });
      return null;
    }
  }, []);

  // Generate CITY CHARACTER analysis from Gemini (Test 7.1)
  // Takes just a city name and returns 8-10 areas with character descriptions
  const generateCityCharacter = useCallback(async (
    query: string, 
    isTestMode = false
  ): Promise<{ areas: VibeArea[], city: string, reasoning: string } | null> => {
    const prompt = `You are a local expert giving someone the "lay of the land" for a city. They want to understand:

CITY: "${query}"

Your job: Identify 8-10 distinct neighborhoods/areas that visitors should know about.

FOR EACH AREA's "character" description (THIS IS IMPORTANT):
Don't write like a guidebook. Write like you LIVE there. Include:

1. SOCIAL PROOF - who goes there, who lives there:
   "This is where creatives have their studios - you'll see them grabbing coffee"
   "Tourists flock here but locals avoid it like the plague"
   "The business crowd during the week, completely different vibe on weekends"

2. HISTORY/EVOLUTION - how the area has changed:
   "Was the red light district until the 90s, now it's where tech workers live"
   "Old money neighborhood that's kept its character - no chain stores allowed"
   "Gentrification happened fast here - artist studios became wine bars"

3. HONEST VIBES - be real about what it's like:
   "Bit touristy but the food market is genuinely worth the crowds"
   "Gritty but charming - you'll either love it or feel uncomfortable"
   "Perfect for Instagram but honestly a bit soulless now"

LANGUAGE & CONTEXT AWARENESS:
- City names may be in any language (München, Firenze, etc.) - understand and use local names where appropriate
- Use LOCAL terms that travelers would hear: "quartier" in Paris, "barrio" in Spain, "rione" in Rome
- Be culturally accurate about what makes each neighborhood tick
- Describe places the way locals actually talk about them

NEVER write generic: "A vibrant area known for its shops and restaurants"
ALWAYS tell a mini-story about the place.

Also include the MIX - what % of time would be spent at SPECIFIC PLACES (restaurants, landmarks, shops) vs just WANDERING the area exploring:
- Tourist hubs = 80% specific places, 20% wander
- Historic/architectural = 30% specific, 70% wander to soak it in
- Local neighborhoods = 50/50 mix

Return ONLY valid JSON:
{
  "city": "City Name",
  "reasoning": "Here's how I'd describe [city] - [overall vibe]. I've highlighted the key areas...",
  "centerLat": XX.XXXX,
  "centerLng": X.XXXX,
  "areas": [
    {
      "name": "Neighborhood Name",
      "lat": XX.XXXX,
      "lng": X.XXXX,
      "radius": 400,
      "character": "Story-like description with social proof/history/honest vibes - max 180 chars",
      "characterType": "historic" | "nightlife" | "cultural" | "foodie" | "local" | "tourist" | "nature" | "shopping",
      "specificPercent": 70,
      "areaPercent": 30
    }
  ]
}

CHARACTER TYPES and COLORS:
- "historic" = #8B5CF6 (purple) - architecture, old buildings, heritage
- "nightlife" = #EC4899 (pink) - bars, clubs, late night
- "cultural" = #F59E0B (amber) - museums, theaters, arts
- "foodie" = #EF4444 (red) - restaurants, food markets
- "local" = #10B981 (emerald) - residential, authentic neighborhoods
- "tourist" = #3B82F6 (blue) - main attractions, landmarks
- "nature" = #22C55E (green) - parks, waterfronts, gardens
- "shopping" = #A855F7 (violet) - retail districts, markets

Use Google Search to verify real places and accurate coordinates!`; 

    if (isTestMode) testLogger.logStep('Prepared CITY CHARACTER prompt', { promptLength: prompt.length });

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8000, topP: 0.95 },
        tools: [{ googleSearch: {} }]
      };

      let callId = '';
      if (isTestMode) {
        callId = testLogger.startAPICall('Gemini 2.5 Pro', 'generateContent', {
          method: 'POST',
          url: apiUrl,
          body: requestBody,
          prompt: prompt
        });
        testLogger.logStep('Making Gemini API call for CITY CHARACTER');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();

      if (isTestMode && callId) {
        testLogger.completeAPICall(
          callId, 
          { status: response.status, statusText: response.statusText, body: data },
          response.ok
        );
      }
      
      if (!response.ok) {
        const errorMsg = data.error?.message || 'API error';
        if (isTestMode) testLogger.logStep('API error', { error: errorMsg });
        throw new Error(errorMsg);
      }
      
      let text = '';
      data.candidates?.[0]?.content?.parts?.forEach((p: { text?: string }) => {
        if (p.text) text += p.text;
      });

      if (isTestMode) testLogger.logStep('Received CITY CHARACTER response', { textLength: text.length });
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        if (isTestMode) testLogger.logStep('Failed to extract JSON', { rawText: text.substring(0, 500) });
        throw new Error('No JSON found');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const grounded = !!data.candidates?.[0]?.groundingMetadata?.groundingChunks?.length;
      const cityName = parsed.city || query;

      if (isTestMode) testLogger.logStep('Parsed CITY CHARACTER JSON', { 
        city: cityName, 
        areaCount: parsed.areas?.length,
        grounded 
      });
      
      // Character type to color mapping
      const characterColors: Record<string, string> = {
        'historic': '#8B5CF6',
        'nightlife': '#EC4899',
        'cultural': '#F59E0B',
        'foodie': '#EF4444',
        'local': '#10B981',
        'tourist': '#3B82F6',
        'nature': '#22C55E',
        'shopping': '#A855F7'
      };
      
      // Process areas
      const newAreas: VibeArea[] = (parsed.areas || []).map((area: {
        name?: string;
        lat?: number | string;
        lng?: number | string;
        radius?: number | string;
        character?: string;
        characterType?: string;
        specificPercent?: number;
        areaPercent?: number;
      }, i: number) => {
        const characterType = area.characterType || 'tourist';
        const color = characterColors[characterType] || '#3B82F6';
        
        return {
          name: area.name || `Area ${i + 1}`,
          lat: parseFloat(String(area.lat)) || 0,
          lng: parseFloat(String(area.lng)) || 0,
          radius: parseInt(String(area.radius)) || 400,
          color,
          why: area.character || 'An interesting area to explore',
          grounded,
          areaType: 'activity' as const,
          // City character specific fields
          characterType,
          specificPercent: area.specificPercent || 50,
          areaPercent: area.areaPercent || 50
        };
      });
      
      // Update map center
      if (parsed.centerLat && parsed.centerLng) {
        setViewState({
          longitude: parseFloat(String(parsed.centerLng)),
          latitude: parseFloat(String(parsed.centerLat)),
          zoom: 12
        });
      }

      if (isTestMode) {
        testLogger.logStep('CITY CHARACTER areas generated successfully', { 
          areaNames: newAreas.map(a => a.name),
          characterTypes: newAreas.map(a => a.characterType),
          totalAreas: newAreas.length
        });
      }
      
      // Calculate smart radii based on proximity to avoid overlap
      const smartRadii = calculateSmartRadii(
        newAreas.map(a => ({ lat: a.lat, lng: a.lng, radius: a.radius })),
        150, 400, 0.3
      );
      const smartAreas = newAreas.map((area, i) => ({
        ...area,
        radius: smartRadii[i]
      }));
      
      return { 
        areas: smartAreas, 
        city: cityName,
        reasoning: parsed.reasoning || `Here's a guide to ${cityName}'s ${smartAreas.length} key neighborhoods!`
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('CITY CHARACTER generation error:', error);
      if (isTestMode) testLogger.logStep('CITY CHARACTER generation failed', { error: errMsg });
      return null;
    }
  }, []);

  // Handle first prompt from landing page
  const handleLandingSubmit = async () => {
    if (!tripInput.trim()) return;
    
    const isTestMode = !!activeTest;
    let runId = '';
    
    // Start test logging if in test mode
    if (isTestMode && activeTest) {
      setTestRunning(true);
      setTestLog(null);
      runId = await testLogger.startTest(activeTest.id, activeTest.name, tripInput);
      testLogger.logStep('Starting test execution', { input: tripInput });
    }
    
    setLoading(true);
    setShowChat(true);
    
    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: tripInput,
      timestamp: new Date()
    };
    setMessages([userMessage]);
    
    // Determine which generator to use:
    
    // TEST 5.3: JSON INPUT - Compute intersection of two polygons
    // This is a "tool" that takes two GeoJSON polygons and finds their intersection
    if (activeTest?.id === '5.3') {
      try {
        if (isTestMode) testLogger.logStep('Parsing JSON input for polygon intersection');
        
        const parsed = JSON.parse(tripInput);
        const polygonA = parsed.polygon_a;
        const polygonB = parsed.polygon_b;
        
        if (!polygonA?.coordinates || !polygonB?.coordinates) {
          throw new Error('Both polygon_a and polygon_b with coordinates are required');
        }
        
        // Create Turf features from input
        const featureA = turf.polygon(polygonA.coordinates);
        const featureB = turf.polygon(polygonB.coordinates);
        
        // Compute intersection using Turf's intersect
        // In Turf v7+, intersect takes a FeatureCollection with all polygons to intersect
        const fc = turf.featureCollection([featureA, featureB]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const intersection = turf.intersect(fc as any);
        
        // Calculate areas
        const areaA = turf.area(featureA) / 1_000_000; // km²
        const areaB = turf.area(featureB) / 1_000_000;
        
        let intersectionArea = 0;
        let intersectionZones: GeoJSON.Feature[] = [];
        let message = '';
        
        if (intersection) {
          intersectionArea = turf.area(intersection) / 1_000_000;
          
          // Flatten if MultiPolygon
          if (intersection.geometry.type === 'MultiPolygon') {
            const flattened = turf.flatten(intersection);
            intersectionZones = flattened.features;
          } else {
            intersectionZones = [intersection];
          }
          
          message = `✅ Found ${intersectionZones.length} fair zone${intersectionZones.length > 1 ? 's' : ''} (${intersectionArea.toFixed(2)} km²)\n\n` +
            `📍 ${polygonA.description || 'Polygon A'}: ${areaA.toFixed(2)} km²\n` +
            `📍 ${polygonB.description || 'Polygon B'}: ${areaB.toFixed(2)} km²\n\n` +
            `The blended zone${intersectionZones.length > 1 ? 's show' : ' shows'} where both can meet! Toggle "Show Areas" to see individual reach.`;
        } else {
          message = `❌ No overlap found between the two areas.\n\n` +
            `📍 ${polygonA.description || 'Polygon A'}: ${areaA.toFixed(2)} km²\n` +
            `📍 ${polygonB.description || 'Polygon B'}: ${areaB.toFixed(2)} km²\n\n` +
            `These areas don't intersect - try larger isochrones or different locations.`;
        }
        
        // Store intersection data for MapPanel
        setIntersectionData({
          polygonA: {
            feature: featureA,
            color: polygonA.color || '#3B82F6',
            description: polygonA.description || 'Area A',
            center: polygonA.center
          },
          polygonB: {
            feature: featureB,
            color: polygonB.color || '#EF4444',
            description: polygonB.description || 'Area B',
            center: polygonB.center
          },
          intersectionZones,
          intersectionArea
        });
        
        // Clear regular areas - we're showing polygons instead
        setAreas([]);
        setCurrentCity('Intersection');
        
        // Fit map to combined bounds
        const combined = turf.featureCollection([featureA, featureB]);
        const bbox = turf.bbox(combined);
        setViewState({
          longitude: (bbox[0] + bbox[2]) / 2,
          latitude: (bbox[1] + bbox[3]) / 2,
          zoom: 11
        });
        
        // Assistant message
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          rawResponse: {
            polygon_a: polygonA,
            polygon_b: polygonB,
            intersection: intersection ? {
              type: intersection.geometry.type,
              zoneCount: intersectionZones.length,
              areaSqKm: intersectionArea
            } : null
          }
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        if (isTestMode) {
          testLogger.logStep('Intersection computed', { 
            hasIntersection: !!intersection,
            zoneCount: intersectionZones.length,
            areaSqKm: intersectionArea
          });
          const log = await testLogger.endTest(true, { 
            intersection: !!intersection,
            zones: intersectionZones.length,
            areaSqKm: intersectionArea
          });
          setTestLog(log);
        }
        
        setLoading(false);
        setTestRunning(false);
        return;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Invalid JSON';
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `❌ Failed to compute intersection: ${errorMsg}\n\nPlease paste valid JSON with polygon_a and polygon_b, each with coordinates array.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        
        if (isTestMode) {
          const log = await testLogger.endTest(false, null, errorMsg);
          setTestLog(log);
        }
        
        setLoading(false);
        setTestRunning(false);
        return;
      }
    }
    
    // TEST 6.2: Interactive Matrix - Transport mode combinations
    if (activeTest?.id === '6.2') {
      try {
        if (isTestMode) testLogger.logStep('Parsing JSON for transport matrix');
        
        const parsed = JSON.parse(tripInput);
        const personAInput = parsed.personA;
        const personBInput = parsed.personB;
        const travelTime = parsed.travelTime || 15;
        const travelUnit = parsed.travelUnit || 'minutes';
        
        if (!personAInput?.location || !personBInput?.location) {
          throw new Error('Both personA and personB with locations are required');
        }
        
        // Mode colors: walk=blue, transit=yellow, drive=red
        const modeColors: Record<string, string> = {
          walk: '#3b82f6',    // Blue
          transit: '#eab308', // Yellow
          drive: '#ef4444'    // Red
        };
        
        // Helper to blend two hex colors
        const blendColors = (c1: string, c2: string): string => {
          const hex = (c: string) => parseInt(c, 16);
          const r1 = hex(c1.slice(1, 3)), g1 = hex(c1.slice(3, 5)), b1 = hex(c1.slice(5, 7));
          const r2 = hex(c2.slice(1, 3)), g2 = hex(c2.slice(3, 5)), b2 = hex(c2.slice(5, 7));
          const r = Math.round((r1 + r2) / 2);
          const g = Math.round((g1 + g2) / 2);
          const b = Math.round((b1 + b2) / 2);
          return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        };
        
        // Helper to get size label
        const getSizeLabel = (areaSqKm: number): string => {
          if (areaSqKm < 0.1) return '✗';
          if (areaSqKm < 2) return 'S';
          if (areaSqKm < 10) return 'M';
          if (areaSqKm < 50) return 'L';
          return 'XL';
        };
        
        // Create isochrones for each person - use polygon coordinates if provided, else circle
        const modes: Array<'walk' | 'transit' | 'drive'> = ['walk', 'transit', 'drive'];
        
        const createPersonIsochrones = (person: typeof personAInput): MatrixIsochrone[] => {
          return modes.map(mode => {
            const iso = person.isochrones?.[mode];
            const color = iso?.color || modeColors[mode];
            
            let feature: GeoJSON.Feature;
            let radiusKm = 0;
            
            // Use pre-defined polygon coordinates if available
            if (iso?.coordinates) {
              feature = turf.polygon(iso.coordinates);
              // Estimate radius from area
              radiusKm = Math.sqrt(turf.area(feature) / 1_000_000 / Math.PI);
            } else {
              // Fall back to circle
              radiusKm = iso?.radiusKm || (mode === 'walk' ? 1 : mode === 'transit' ? 5 : 10);
              const center = turf.point([person.location.lng, person.location.lat]);
              feature = turf.circle(center, radiusKm, { units: 'kilometers', steps: 64 });
            }
            
            return {
              mode,
              feature,
              color,
              radiusKm
            };
          });
        };
        
        const personA: MatrixPerson = {
          name: personAInput.name || 'Person A',
          location: personAInput.location,
          isochrones: createPersonIsochrones(personAInput)
        };
        
        const personB: MatrixPerson = {
          name: personBInput.name || 'Person B',
          location: personBInput.location,
          isochrones: createPersonIsochrones(personBInput)
        };
        
        // Compute all 9 intersection combinations
        const cells: MatrixCell[] = [];
        for (const modeA of modes) {
          for (const modeB of modes) {
            const isoA = personA.isochrones.find(i => i.mode === modeA)!;
            const isoB = personB.isochrones.find(i => i.mode === modeB)!;
            
            const fc = turf.featureCollection([isoA.feature, isoB.feature]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const intersection = turf.intersect(fc as any);
            
            const areaSqKm = intersection ? turf.area(intersection) / 1_000_000 : 0;
            const blendedColor = blendColors(isoA.color, isoB.color);
            
            cells.push({
              modeA,
              modeB,
              intersection,
              areaSqKm,
              sizeLabel: getSizeLabel(areaSqKm),
              blendedColor
            });
          }
        }
        
        // Store matrix data
        const matrix: MatrixData = {
          personA,
          personB,
          cells,
          travelTime,
          travelUnit
        };
        setMatrixData(matrix);
        setHoveredCell(null);
        
        // Clear other data
        setAreas([]);
        setIntersectionData(null);
        setCurrentCity('Matrix');
        
        // Fit map to both locations
        const centerLat = (personA.location.lat + personB.location.lat) / 2;
        const centerLng = (personA.location.lng + personB.location.lng) / 2;
        setViewState({
          longitude: centerLng,
          latitude: centerLat,
          zoom: 11
        });
        
        // Build summary message
        const hasOverlap = cells.filter(c => c.areaSqKm > 0.1).length;
        const bestCombo = cells.reduce((best, c) => c.areaSqKm > best.areaSqKm ? c : best, cells[0]);
        
        const message = `📊 Transport Matrix: ${personA.name} ↔ ${personB.name}\n\n` +
          `⏱️ ${travelTime} ${travelUnit} isochrones\n` +
          `✅ ${hasOverlap}/9 combinations have overlap\n` +
          `🏆 Best: ${bestCombo.modeA} + ${bestCombo.modeB} = ${bestCombo.areaSqKm.toFixed(1)} km²\n\n` +
          `Hover over the matrix cells to see intersections!`;
        
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          rawResponse: matrix
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        if (isTestMode) {
          testLogger.logStep('Matrix computed', { 
            personA: personA.name,
            personB: personB.name,
            cellsWithOverlap: hasOverlap,
            bestCombo: `${bestCombo.modeA}-${bestCombo.modeB}`
          });
          const log = await testLogger.endTest(true, matrix);
          setTestLog(log);
        }
        
        setLoading(false);
        setTestRunning(false);
        return;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Invalid JSON';
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `❌ Failed to create transport matrix: ${errorMsg}\n\nPlease paste valid JSON with personA and personB, each with location and isochrones.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        
        if (isTestMode) {
          const log = await testLogger.endTest(false, null, errorMsg);
          setTestLog(log);
        }
        
        setLoading(false);
        setTestRunning(false);
        return;
      }
    }
    
    // TEST 3.2: JSON INPUT - Parse stayAreas + activityAreas, display with travel lines
    // This is a "tool" that takes the output of 3.1 and adds travel time calculations
    if (activeTest?.id === '3.2') {
      try {
        if (isTestMode) testLogger.logStep('Parsing JSON input for travel lines');
        
        const parsed = JSON.parse(tripInput);
        const cityName = parsed.city || 'Trip';
        
        // Convert to VibeArea format with dualLayerType
        const stayColors = ['#3B82F6', '#60A5FA', '#93C5FD'];
        const activityColors = ['#F97316', '#FB923C', '#FDBA74'];
        
        const stayAreas: VibeArea[] = (parsed.stayAreas || []).map((area: { name?: string; lat?: number; lng?: number; radius?: number }, i: number) => ({
          name: area.name || `Stay ${i + 1}`,
          lat: area.lat || 0,
          lng: area.lng || 0,
          radius: area.radius || 500,
          color: stayColors[i % stayColors.length],
          dualLayerType: 'stay' as const,
          dualLayerIndex: i + 1
        }));
        
        const activityAreas: VibeArea[] = (parsed.activityAreas || []).map((area: { name?: string; lat?: number; lng?: number; radius?: number }, i: number) => ({
          name: area.name || `Activity ${i + 1}`,
          lat: area.lat || 0,
          lng: area.lng || 0,
          radius: area.radius || 400,
          color: activityColors[i % activityColors.length],
          dualLayerType: 'activity' as const,
          dualLayerIndex: i + 1
        }));
        
        // Combine areas and calculate smart radii based on proximity
        const combinedAreas = [...stayAreas, ...activityAreas];
        const smartRadii = calculateSmartRadii(
          combinedAreas.map(a => ({ lat: a.lat, lng: a.lng, radius: a.radius })),
          150, 500, 0.3
        );
        const allAreas = combinedAreas.map((area, i) => ({
          ...area,
          radius: smartRadii[i]
        }));
        
        // Get travelLinePairs from input or use default
        const linePairs = parsed.travelLinePairs || ['stay-to-activity', 'activity-to-activity'];
        
        setAreas(allAreas);
        setCurrentAreaIndex(0);
        setShowCard(false);
        setCardPersistent(false);
        setCurrentCity(cityName);
        setCurrentQueryType('activity');
        setTravelLinePairs(linePairs);
        
        // Center map
        if (allAreas.length > 0) {
          const avgLat = allAreas.reduce((sum, a) => sum + a.lat, 0) / allAreas.length;
          const avgLng = allAreas.reduce((sum, a) => sum + a.lng, 0) / allAreas.length;
          setViewState({ longitude: avgLng, latitude: avgLat, zoom: 12 });
        }
        
        // Assistant message
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `📍 Loaded ${stayAreas.length} stay areas and ${activityAreas.length} activity areas.\n\nTravel lines are now visible showing walking times between areas. Use the toggle to show/hide them.`,
          timestamp: new Date(),
          rawResponse: parsed
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        if (isTestMode) {
          testLogger.logStep('JSON parsed successfully', { 
            stayCount: stayAreas.length, 
            activityCount: activityAreas.length 
          });
          const log = await testLogger.endTest(true, { areas: allAreas, city: cityName });
          setTestLog(log);
        }
        
        setLoading(false);
        setTestRunning(false);
        return;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Invalid JSON';
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `❌ Failed to parse JSON input: ${errorMsg}\n\nPlease paste valid JSON with stayAreas and activityAreas arrays.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        
        if (isTestMode) {
          const log = await testLogger.endTest(false, null, errorMsg);
          setTestLog(log);
        }
        
        setLoading(false);
        setTestRunning(false);
        return;
      }
    }
    
    // - Test 7.1 = CITY CHARACTER (8-10 areas with character types)
    // - Test 3.1 = DUAL-LAYER (stay + activity)
    // - Test 2.1 = STAY areas only
    // - Test 1.1 = Activity areas only
    // - Otherwise, auto-detect based on query
    const useCityCharacterGenerator = activeTest?.id === '7.1';
    const useDualLayerGenerator = activeTest?.id === '3.1';
    const useStayGenerator = activeTest?.id === '2.1' || (!activeTest && !useDualLayerGenerator && !useCityCharacterGenerator && isStayQuery(tripInput));
    
    // Generate areas (with test logging if in test mode)
    let result;
    if (useCityCharacterGenerator) {
      result = await generateCityCharacter(tripInput, isTestMode);
    } else if (useDualLayerGenerator) {
      result = await generateDualLayerAreas(tripInput, isTestMode);
    } else if (useStayGenerator) {
      result = await generateStayAreas(tripInput, isTestMode);
    } else {
      result = await generateAreas(tripInput, isTestMode);
    }
    
    if (result) {
      setAreas(result.areas);
      setCurrentAreaIndex(0);
      setShowCard(false); // Don't show card initially - let intro card show first
      setCardPersistent(false);
      setCurrentCity(result.city);
      
      // Determine query type for intro card
      const isCityCharacter = result.areas.some(a => a.characterType);
      const isDualLayer = result.areas.some(a => a.dualLayerType);
      const isStayResult = result.areas[0]?.areaType === 'stay' && !isDualLayer && !isCityCharacter;
      
      if (isCityCharacter) {
        setCurrentQueryType('city' as 'activity' | 'stay');
      } else if (isDualLayer) {
        setCurrentQueryType('dual' as 'activity' | 'stay');
      } else if (isStayResult) {
        setCurrentQueryType('stay');
      } else {
        setCurrentQueryType('activity');
      }
      
      // Chat message is text-only (the agent talking) - map shows the visual stuff
      let assistantContent: string;
      if (isCityCharacter) {
        assistantContent = `${result.city}! 🏙️\n\n${result.reasoning}\n\nI've mapped out ${result.areas.length} key neighborhoods - each color represents a different vibe. Click any to learn more!`;
      } else if (isDualLayer) {
        const stayAreas = result.areas.filter(a => a.dualLayerType === 'stay');
        const activityAreas = result.areas.filter(a => a.dualLayerType === 'activity');
        assistantContent = `${result.city}! 🗺️\n\n${result.reasoning}\n\nI've marked ${stayAreas.length} places to STAY (blue) and ${activityAreas.length} areas to EXPLORE (orange) on the map.`;
      } else if (isStayResult) {
        const areaNames = result.areas.map(a => a.name).join(', ');
        assistantContent = `${result.city}! 🏨\n\n${result.reasoning}\n\nI've marked ${areaNames} on the map. Each has booking links and nearby highlights.`;
      } else {
        const areaNames = result.areas.map(a => a.name).join(', ');
        assistantContent = `${result.city}! 🎉\n\n${result.reasoning}\n\nI've highlighted ${areaNames} on the map - click any to explore!`;
      }
      
      // Add assistant message (text only - no areas, those are on the map)
      // Include rawResponse for "Copy Raw Response" button
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        rawResponse: {
          city: result.city,
          reasoning: result.reasoning,
          areas: result.areas,
          // Include travelLinePairs if this is a dual-layer result (3.1)
          ...((result as { travelLinePairs?: string[] }).travelLinePairs ? { travelLinePairs: (result as { travelLinePairs?: string[] }).travelLinePairs } : {}),
          // For 3.2 compatibility, also include stayAreas and activityAreas separately
          ...(result.areas.some((a: VibeArea) => a.dualLayerType) && {
            stayAreas: result.areas.filter((a: VibeArea) => a.dualLayerType === 'stay').map((a: VibeArea) => ({
              name: a.name, lat: a.lat, lng: a.lng, radius: a.radius
            })),
            activityAreas: result.areas.filter((a: VibeArea) => a.dualLayerType === 'activity').map((a: VibeArea) => ({
              name: a.name, lat: a.lat, lng: a.lng, radius: a.radius
            }))
          })
        }
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Create session
      const session: ChatSession = {
        id: generateId(),
        title: `${result.city} trip`,
        city: result.city,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setChatSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      
      // End test successfully
      if (isTestMode) {
        const log = await testLogger.endTest(true, { city: result.city, areas: result.areas });
        setTestLog(log);
        setTestRunning(false);
      }
    } else {
      // Error message
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I had trouble finding areas for that trip. Could you try rephrasing your request?',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // End test with failure
      if (isTestMode) {
        const log = await testLogger.endTest(false, null, 'Failed to generate areas');
        setTestLog(log);
        setTestRunning(false);
      }
    }
    
    setLoading(false);
    setTripInput('');
  };

  // Handle message from chat panel
  const handleChatMessage = async (message: string) => {
    if (!message.trim()) return;
    
    setLoading(true);
    
    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Check if this is a stay query
    const useStayGenerator = isStayQuery(message);
    const result = useStayGenerator 
      ? await generateStayAreas(message, false)
      : await generateAreas(message, false);
    
    if (result) {
      setAreas(result.areas);
      setCurrentAreaIndex(0);
      setShowCard(false); // Let intro card show first
      setCardPersistent(false);
      setCurrentCity(result.city);
      setCurrentQueryType(result.areas[0]?.areaType === 'stay' ? 'stay' : 'activity');
      
      const areaNames = result.areas.map(a => a.name).join(', ');
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `${result.city}! 🎉\n\n${result.reasoning}\n\nI've updated the map with ${areaNames}.`,
        timestamp: new Date(),
        rawResponse: {
          city: result.city,
          reasoning: result.reasoning,
          areas: result.areas,
          ...((result as { travelLinePairs?: string[] }).travelLinePairs ? { travelLinePairs: (result as { travelLinePairs?: string[] }).travelLinePairs } : {}),
          ...(result.areas.some((a: VibeArea) => a.dualLayerType) && {
            stayAreas: result.areas.filter((a: VibeArea) => a.dualLayerType === 'stay').map((a: VibeArea) => ({
              name: a.name, lat: a.lat, lng: a.lng, radius: a.radius
            })),
            activityAreas: result.areas.filter((a: VibeArea) => a.dualLayerType === 'activity').map((a: VibeArea) => ({
              name: a.name, lat: a.lat, lng: a.lng, radius: a.radius
            }))
          })
        }
      };
      setMessages(prev => [...prev, assistantMessage]);
    } else {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I had trouble with that request. Could you try again?',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
    
    setLoading(false);
  };

  // Handle area click from chat
  const handleAreaClickFromChat = (area: VibeArea) => {
    const index = areas.findIndex(a => a.name === area.name);
    if (index >= 0) {
      setCurrentAreaIndex(index);
      setShowCard(true);
      setCardPersistent(true);
    }
  };

  // Handle new chat
  const handleNewChat = () => {
    setMessages([]);
    setAreas([]);
    setShowCard(false);
    setCardPersistent(false);
    setActiveSessionId(undefined);
  };

  // Handle session select
  const handleSessionSelect = (sessionId: string) => {
    // In a real app, this would load the session from storage/API
    setActiveSessionId(sessionId);
  };

  // Handle test selection from test picker
  const handleTestSelect = useCallback((test: BuildingBlockTest) => {
    setTripInput(test.input);
    setActiveTest(test);
    setTestLog(null); // Clear any previous test result
    // Focus the input field
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Handle test verdict (pass/fail)
  const handleTestVerdict = async (verdict: 'passed' | 'failed') => {
    if (!testLog) return;
    // Update the log file with verdict
    try {
      const updatedLog = { ...testLog, verdict };
      await fetch('/api/test-logs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLog)
      });
      setTestLog(updatedLog);
    } catch (err) {
      console.error('Failed to save verdict:', err);
    }
  };

  // Handle test rerun
  const handleTestRerun = () => {
    if (activeTest) {
      setTripInput(activeTest.input);
      setTestLog(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Dismiss test result
  const handleDismissTestResult = () => {
    setTestLog(null);
    setActiveTest(null);
  };

  // Landing page
  if (!showChat) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex">
        {/* Test Picker Sidebar (collapsible) */}
        {showTestPicker && (
          <div className="w-[320px] flex-shrink-0 h-screen overflow-hidden">
            <TestPickerPanel
              onTestSelect={handleTestSelect}
              onClose={() => setShowTestPicker(false)}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-10 relative">
          {/* Test Picker Toggle (top-left) */}
          <button
            onClick={() => setShowTestPicker(!showTestPicker)}
            className={`absolute top-6 left-6 flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              showTestPicker
                ? 'bg-[#FF6B6B]/20 text-[#FF6B6B] border border-[#FF6B6B]/30'
                : 'bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-gray-700 hover:text-gray-300'
            }`}
            aria-label={showTestPicker ? 'Hide test picker' : 'Show test picker'}
          >
            <span className="text-sm">🧪</span>
            <span className="text-sm font-medium">Tests</span>
          </button>

          {/* Leo Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center">
              <span className="text-2xl font-bold text-white">L</span>
            </div>
            <span className="text-3xl font-semibold text-white tracking-tight">Leo</span>
          </div>
          
          <h1 className="text-4xl font-bold mb-3 text-white">
            Vibe Maps
          </h1>
          <p className="text-gray-500 text-lg mb-12 text-center max-w-md">
            Tell me about your trip and I&apos;ll find the perfect neighborhoods anywhere in the world
          </p>
          
          <div className="w-full max-w-xl">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={tripInput}
                onChange={(e) => setTripInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLandingSubmit()}
                placeholder="e.g., 'romantic weekend in Paris' or 'foodie trip to Tokyo'"
                className="w-full px-6 py-5 pr-14 text-lg bg-[#1A1A1A] border-2 border-gray-800 rounded-2xl text-white placeholder-gray-600 focus:border-[#FF6B6B] focus:outline-none focus:ring-4 focus:ring-[#FF6B6B]/20 transition-all"
                autoFocus
              />
              <button
                onClick={handleLandingSubmit}
                disabled={loading || !tripInput.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] rounded-xl flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-white text-lg">→</span>
                )}
              </button>
            </div>
            
            <p className="text-center text-gray-600 text-sm mt-4">
              Press <kbd className="px-2 py-0.5 bg-gray-800 rounded text-gray-400">Enter</kbd> to search
            </p>
            
            {/* Example queries */}
            <div className="flex gap-2 mt-8 flex-wrap justify-center">
              {[
                "Nightlife in Berlin",
                "Family trip to Barcelona",
                "Coffee shops in Melbourne",
                "Historic sites in Rome"
              ].map(example => (
                <button
                  key={example}
                  onClick={() => setTripInput(example)}
                  className="px-4 py-2 bg-[#1A1A1A] border border-gray-800 rounded-full text-gray-500 hover:border-[#FF6B6B]/50 hover:text-gray-300 transition-all text-sm"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
          
          {/* Footer */}
          <p className="absolute bottom-6 text-gray-700 text-sm">
            Powered by AI • Works anywhere in the world
          </p>

          {/* Active Test Badge */}
          {activeTest && (
            <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-2 bg-[#FF6B6B]/20 border border-[#FF6B6B]/30 rounded-lg">
              <span className="text-[#FF6B6B] text-sm font-medium">🧪 Test {activeTest.id}</span>
              <button
                onClick={() => { setActiveTest(null); setTripInput(''); }}
                className="text-[#FF6B6B]/60 hover:text-[#FF6B6B] transition-colors"
                aria-label="Cancel test"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Test Result Panel */}
        <TestResultPanel
          log={testLog}
          isRunning={testRunning}
          onPass={() => handleTestVerdict('passed')}
          onFail={() => handleTestVerdict('failed')}
          onRerun={handleTestRerun}
          onDismiss={handleDismissTestResult}
        />
      </div>
    );
  }

  // Chat + Map view (Lovable-style)
  return (
    <div className="h-screen flex bg-[#0D0D0D]">
      {/* ChatGPT-style History Sidebar (far left) */}
      <ChatHistorySidebar
        sessions={chatSessions}
        activeSessionId={activeSessionId}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
      />
      
      {/* Test Picker Panel (collapsible, after sidebar) */}
      <div 
        className={`h-screen overflow-hidden border-r border-gray-800 transition-all duration-300 ease-in-out ${
          showTestPicker ? 'w-[300px] opacity-100' : 'w-0 opacity-0 border-r-0'
        }`}
      >
        {showTestPicker && (
          <TestPickerPanel
            onTestSelect={handleTestSelect}
            onClose={() => setShowTestPicker(false)}
          />
        )}
      </div>
      
      {/* Chat Panel (left) */}
      <div className="w-[380px] flex-shrink-0 border-r border-gray-800 flex flex-col">
        {/* Test Picker Toggle */}
        <div className="p-2 border-b border-gray-800 flex justify-end">
          <button
            onClick={() => setShowTestPicker(!showTestPicker)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
              showTestPicker
                ? 'bg-[#FF6B6B]/20 text-[#FF6B6B] border border-[#FF6B6B]/30'
                : 'bg-[#1A1A1A] text-gray-500 border border-gray-800 hover:border-gray-700 hover:text-gray-400'
            }`}
            aria-label={showTestPicker ? 'Hide test picker' : 'Show test picker'}
          >
            <span>🧪</span>
            <span className="font-medium">{showTestPicker ? 'Hide Tests' : 'Tests'}</span>
          </button>
        </div>
        
        {/* Chat content */}
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            loading={loading}
            onSendMessage={handleChatMessage}
            onAreaClick={handleAreaClickFromChat}
          />
        </div>
      </div>
      
      {/* Map Panel (right, fills remaining space) */}
      <div className="flex-1 relative min-w-0">
        <MapPanel
          areas={areas}
          currentAreaIndex={currentAreaIndex}
          viewState={viewState}
          onViewStateChange={setViewState}
          onAreaSelect={setCurrentAreaIndex}
          showCard={showCard}
          cardPersistent={cardPersistent}
          onMapClick={() => {
            setShowCard(false);
            setCardPersistent(false);
          }}
          onCardShow={() => {
            setShowCard(true);
            setCardPersistent(true);
          }}
          city={currentCity}
          queryType={currentQueryType}
          showTravelLinesMode={activeTest?.id === '3.2'}
          travelLinePairs={travelLinePairs}
          intersectionData={intersectionData}
          matrixData={matrixData}
          hoveredCell={hoveredCell}
          onCellHover={setHoveredCell}
        />
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center mb-4 animate-pulse">
            <span className="text-2xl font-bold text-white">L</span>
          </div>
          <p className="text-gray-400 text-sm">Finding the perfect spots for your trip...</p>
        </div>
      )}
      </div>

      {/* Test Result Panel */}
      <TestResultPanel
        log={testLog}
        isRunning={testRunning}
        onPass={() => handleTestVerdict('passed')}
        onFail={() => handleTestVerdict('failed')}
        onRerun={handleTestRerun}
        onDismiss={handleDismissTestResult}
      />
    </div>
  );
}
