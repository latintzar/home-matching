---
status: implementing
last_updated: 2024-12-12
implemented_in: /src/app/vibe-maps/page.tsx
---

# Chat UI Architecture

> The Lovable-style chat sidebar, state management, and component structure.

## Overview

A split-panel interface with a conversational chat sidebar on the left and an interactive map on the right. The chat guides users through their planning journey while the map displays results in real-time.

## Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Leo Vibe Maps                                           [Account] [≡]     │
├─────────────────┬───────────────────────────────────────────────────────────┤
│                 │                                                           │
│  CHAT SIDEBAR   │                      MAP                                  │
│  (400px)        │                    (flex-1)                               │
│                 │                                                           │
│  ┌───────────┐  │                                                           │
│  │ Messages  │  │                                                           │
│  │           │  │                                                           │
│  │           │  │                                                           │
│  │           │  │                                                           │
│  └───────────┘  │                                                           │
│                 │                                                           │
│  ┌───────────┐  │                                                           │
│  │  Input    │  │                                                           │
│  └───────────┘  │                                                           │
│                 │                                                           │
└─────────────────┴───────────────────────────────────────────────────────────┘
```

## Component Structure

```
VibeMapsPage
├── ChatHistorySidebar (collapsible, see CHAT-HISTORY.md)
├── ChatPanel
│   ├── ChatHeader
│   │   ├── ScenarioBadge
│   │   └── StatusIndicator
│   ├── MessageList
│   │   ├── UserMessage
│   │   ├── AssistantMessage
│   │   │   ├── TextContent
│   │   │   ├── AreaCard
│   │   │   ├── PlaceCard
│   │   │   └── RouteCard
│   │   └── LoadingMessage
│   ├── SuggestionChips
│   └── ChatInput
│       ├── TextArea
│       └── SendButton
├── MapPanel
│   ├── MapContainer (Mapbox GL)
│   │   ├── VibeCircles
│   │   ├── PlaceMarkers
│   │   ├── RouteLines
│   │   └── IsochronePolygons
│   ├── MapControls
│   │   ├── LayerToggle
│   │   └── ZoomControls
│   └── InfoCardOverlay
└── ModeSelectionModal (for Areas to Explore)
```

## State Management

```typescript
// Core state
interface VibeMapsState {
  // Chat
  messages: Message[];
  isLoading: boolean;
  currentScenario: ScenarioType | null;
  
  // Results
  areas: VibeArea[];
  places: Place[];
  route: MultiStopRoute | null;
  isochrones: GeoJSON.Polygon[];
  
  // Map
  mapCenter: [number, number];
  mapZoom: number;
  selectedItem: VibeArea | Place | null;
  visibleLayers: ('areas' | 'places' | 'routes' | 'isochrones')[];
  
  // Session
  chatId: string | null;
  userId: string | null;
}

// Actions
type Action =
  | { type: 'SEND_MESSAGE'; payload: string }
  | { type: 'RECEIVE_MESSAGE'; payload: Message }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_AREAS'; payload: VibeArea[] }
  | { type: 'SET_PLACES'; payload: Place[] }
  | { type: 'SET_ROUTE'; payload: MultiStopRoute }
  | { type: 'SELECT_ITEM'; payload: VibeArea | Place | null }
  | { type: 'SET_MAP_VIEW'; payload: { center: [number, number]; zoom: number } }
  | { type: 'TOGGLE_LAYER'; payload: string };
```

### Context Provider

```typescript
const VibeMapsContext = createContext<{
  state: VibeMapsState;
  dispatch: React.Dispatch<Action>;
  actions: {
    sendMessage: (text: string) => Promise<void>;
    selectArea: (area: VibeArea) => void;
    selectPlace: (place: Place) => void;
    clearSelection: () => void;
  };
} | null>(null);

const VibeMapsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(vibeMapsReducer, initialState);
  
  const actions = useMemo(() => ({
    sendMessage: async (text: string) => {
      dispatch({ type: 'SEND_MESSAGE', payload: text });
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Stream response from agent
      await streamAgentResponse(text, (event) => {
        switch (event.type) {
          case 'classification':
            // Update scenario badge
            break;
          case 'areas':
            dispatch({ type: 'SET_AREAS', payload: event.data });
            break;
          case 'places':
            dispatch({ type: 'SET_PLACES', payload: event.data });
            break;
          case 'message':
            dispatch({ type: 'RECEIVE_MESSAGE', payload: event.data });
            break;
        }
      });
      
      dispatch({ type: 'SET_LOADING', payload: false });
    },
    
    selectArea: (area: VibeArea) => {
      dispatch({ type: 'SELECT_ITEM', payload: area });
      dispatch({ type: 'SET_MAP_VIEW', payload: { center: area.center, zoom: 15 } });
    },
    
    selectPlace: (place: Place) => {
      dispatch({ type: 'SELECT_ITEM', payload: place });
      dispatch({ type: 'SET_MAP_VIEW', payload: { center: place.coordinates, zoom: 17 } });
    },
    
    clearSelection: () => {
      dispatch({ type: 'SELECT_ITEM', payload: null });
    }
  }), []);
  
  return (
    <VibeMapsContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </VibeMapsContext.Provider>
  );
};
```

## Message Types

```typescript
interface BaseMessage {
  id: string;
  timestamp: Date;
}

interface UserMessage extends BaseMessage {
  role: 'user';
  content: string;
}

interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  content: string;
  
  // Attached results
  areas?: VibeArea[];
  places?: Place[];
  route?: MultiStopRoute;
  
  // UI hints
  suggestions?: string[];
  clarificationNeeded?: {
    question: string;
    options: string[];
  };
}

type Message = UserMessage | AssistantMessage;
```

## Chat Flow Example

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Chat                                                                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  [User] romantic spots in Barcelona                                         │
│                                                                             │
│  [Assistant]                                                    🏷️ Areas    │
│  I found 5 romantic neighborhoods in Barcelona! Click on any               │
│  area on the map to learn more.                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. El Born - Medieval streets, candlelit wine bars                  │   │
│  │ 2. Gràcia - Bohemian squares, intimate restaurants                  │   │
│  │ 3. Gothic Quarter - Historic charm, hidden courtyards               │   │
│  │ 4. Barceloneta - Beach sunsets, seafood dinners                     │   │
│  │ 5. Poble Sec - Local vibes, rooftop bars                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  💡 Suggestions:                                                            │
│  [Find a specific restaurant] [Where to stay nearby] [Plan the evening]    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [Type a message...]                                            [Send →]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Area Card Component

```tsx
const AreaCard: React.FC<{ area: VibeArea; isStayArea?: boolean }> = ({ area, isStayArea }) => {
  const { actions } = useVibeMaps();
  
  return (
    <div 
      className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
      onClick={() => actions.selectArea(area)}
    >
      <div className="flex justify-between items-start">
        <h3 className="font-semibold">{area.name}</h3>
        {isStayArea && area.priceTier && (
          <span className="text-sm text-gray-500">
            {'💰'.repeat({ budget: 1, mid: 2, luxury: 3 }[area.priceTier])}
          </span>
        )}
      </div>
      
      <p className="text-sm text-gray-600 mt-1">{area.description}</p>
      
      {area.whyReason && (
        <p className="text-sm text-blue-600 mt-2">
          💡 {area.whyReason}
        </p>
      )}
      
      {/* Stay areas: Booking links */}
      {isStayArea && area.bookingLinks && (
        <div className="flex gap-2 mt-3">
          <a 
            href={area.bookingLinks.airbnb}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 text-sm bg-[#FF5A5F] text-white rounded"
          >
            🏠 Airbnb
          </a>
          <a 
            href={area.bookingLinks.bookingCom}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 text-sm bg-[#003580] text-white rounded"
          >
            🏨 Booking.com
          </a>
        </div>
      )}
      
      {/* Search suggestions */}
      {area.searchSuggestions && (
        <div className="mt-3 space-y-1">
          {area.searchSuggestions.map((suggestion, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{suggestion.text}</span>
              <div className="flex gap-1">
                <a href={suggestion.gmapsUrl} target="_blank" className="text-blue-500">
                  GMaps
                </a>
                <a href={suggestion.tiktokUrl} target="_blank" className="text-pink-500">
                  TikTok
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## Place Card Component

```tsx
const PlaceCard: React.FC<{ place: Place; recommendation?: Recommendation }> = ({ 
  place, 
  recommendation 
}) => {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{place.name}</h3>
          <p className="text-sm text-gray-500">{place.address}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center">
            <span className="text-yellow-500">⭐</span>
            <span className="ml-1">{place.rating}</span>
            <span className="text-gray-400 text-sm ml-1">({place.reviewCount})</span>
          </div>
          <span className="text-sm text-gray-500">{place.priceLevel}</span>
        </div>
      </div>
      
      {place.hours && (
        <p className="text-sm text-gray-600 mt-2">🕐 {place.hours}</p>
      )}
      
      {recommendation && (
        <>
          <div className="mt-3 p-3 bg-blue-50 rounded">
            <p className="text-sm text-blue-800">{recommendation.whyThisPlace}</p>
          </div>
          
          {recommendation.reviewHighlights?.length > 0 && (
            <div className="mt-3 space-y-2">
              {recommendation.reviewHighlights.map((review, i) => (
                <blockquote key={i} className="text-sm italic text-gray-600 border-l-2 pl-2">
                  "{review.quote}"
                </blockquote>
              ))}
            </div>
          )}
          
          {recommendation.tips?.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium">💡 Tips:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside">
                {recommendation.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      
      <a 
        href={place.gmapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full py-2 text-center bg-blue-500 text-white rounded"
      >
        📍 Open in Google Maps
      </a>
    </div>
  );
};
```

## Map Integration

```tsx
const MapPanel: React.FC = () => {
  const { state, actions } = useVibeMaps();
  const mapRef = useRef<MapRef>(null);
  
  // Fly to location when selection changes
  useEffect(() => {
    if (state.selectedItem && mapRef.current) {
      const center = 'center' in state.selectedItem 
        ? state.selectedItem.center 
        : state.selectedItem.coordinates;
      
      mapRef.current.flyTo({
        center,
        zoom: 15,
        duration: 1000
      });
    }
  }, [state.selectedItem]);
  
  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        longitude: state.mapCenter[0],
        latitude: state.mapCenter[1],
        zoom: state.mapZoom
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      {/* Vibe circles */}
      {state.visibleLayers.includes('areas') && state.areas.map(area => (
        <Source
          key={area.name}
          type="geojson"
          data={turf.circle(area.center, area.radius / 1000)}
        >
          <Layer
            type="fill"
            paint={{
              'fill-color': area.type === 'stay' ? '#3B82F6' : '#F97316',
              'fill-opacity': state.selectedItem?.name === area.name ? 0.4 : 0.2
            }}
            onClick={() => actions.selectArea(area)}
          />
          <Layer
            type="line"
            paint={{
              'line-color': area.type === 'stay' ? '#2563EB' : '#EA580C',
              'line-width': 2
            }}
          />
        </Source>
      ))}
      
      {/* Place markers */}
      {state.visibleLayers.includes('places') && state.places.map(place => (
        <Marker
          key={place.name}
          longitude={place.coordinates[0]}
          latitude={place.coordinates[1]}
          onClick={() => actions.selectPlace(place)}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center
            ${state.selectedItem?.name === place.name ? 'bg-blue-500' : 'bg-white border-2'}`}>
            📍
          </div>
        </Marker>
      ))}
      
      {/* Route lines */}
      {state.visibleLayers.includes('routes') && state.route && (
        <Source
          type="geojson"
          data={{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: state.route.legs.flatMap(leg => 
                polyline.decode(leg.polyline).map(([lat, lng]) => [lng, lat])
              )
            }
          }}
        >
          <Layer
            type="line"
            paint={{
              'line-color': '#6366F1',
              'line-width': 4
            }}
          />
        </Source>
      )}
      
      {/* Isochrone polygons */}
      {state.visibleLayers.includes('isochrones') && state.isochrones.map((iso, i) => (
        <Source key={i} type="geojson" data={iso}>
          <Layer
            type="fill"
            paint={{
              'fill-color': i === 0 ? '#3B82F6' : '#EF4444',
              'fill-opacity': 0.1
            }}
          />
        </Source>
      ))}
    </Map>
  );
};
```

## Responsive Design

```tsx
// Mobile: Stack chat above map
// Desktop: Side-by-side

const VibeMapsPage: React.FC = () => {
  return (
    <div className="h-screen flex flex-col md:flex-row">
      {/* Chat History Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <ChatHistorySidebar />
      </div>
      
      {/* Chat Panel */}
      <div className="h-1/2 md:h-full md:w-[400px] flex-shrink-0 border-r">
        <ChatPanel />
      </div>
      
      {/* Map Panel */}
      <div className="h-1/2 md:h-full flex-1">
        <MapPanel />
      </div>
    </div>
  );
};
```

---

[← Agent Pattern](AGENT-PATTERN.md) | [Back to Index](../AGENTIC_MAPS.md) | [Chat History →](CHAT-HISTORY.md)
