# leo-vibe-extension/injected-script.js

[Source](../../../../leo-vibe-extension/injected-script.js)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `switchToMapView` | function | [L122](../../../../leo-vibe-extension/injected-script.js#L122) |  |
| `switchToAirbnbMapView` | function | [L139](../../../../leo-vibe-extension/injected-script.js#L139) |  |
| `switchToBookingMapView` | function | [L192](../../../../leo-vibe-extension/injected-script.js#L192) |  |
| `initGoogleMapsWebsiteOverlay` | function | [L233](../../../../leo-vibe-extension/injected-script.js#L233) |  |
| `parseUrlCoordinates` | function | [L235](../../../../leo-vibe-extension/injected-script.js#L235) |  |
| `latLngToPixel` | function | [L249](../../../../leo-vibe-extension/injected-script.js#L249) | lat, lng, mapCenter, zoom, containerWidth, containerHeight |
| `latLngToWorld` | function | [L254](../../../../leo-vibe-extension/injected-script.js#L254) | lat, lng |
| `metersToPixels` | function | [L273](../../../../leo-vibe-extension/injected-script.js#L273) | meters, lat, zoom |
| `findMapContainer` | function | [L279](../../../../leo-vibe-extension/injected-script.js#L279) |  |
| `createVibeCircles` | function | [L313](../../../../leo-vibe-extension/injected-script.js#L313) |  |
| `showInfoCard` | function | [L406](../../../../leo-vibe-extension/injected-script.js#L406) | area, index, persistent |
| `hideInfoCard` | function | [L497](../../../../leo-vibe-extension/injected-script.js#L497) | force |
| `navigateArea` | function | [L507](../../../../leo-vibe-extension/injected-script.js#L507) | direction |
| `handleUrlChange` | function | [L517](../../../../leo-vibe-extension/injected-script.js#L517) |  |
| `initVibeOverlay` | function | [L549](../../../../leo-vibe-extension/injected-script.js#L549) |  |
| `isValidMapInstance` | function | [L559](../../../../leo-vibe-extension/injected-script.js#L559) | obj |
| `isRealGoogleMap` | function | [L600](../../../../leo-vibe-extension/injected-script.js#L600) | obj |
| `findBookingMap` | function | [L617](../../../../leo-vibe-extension/injected-script.js#L617) |  |
| `deepSearch` | function | [L683](../../../../leo-vibe-extension/injected-script.js#L683) | obj, depth, path |
| `setupBookingMapWatcher` | function | [L812](../../../../leo-vibe-extension/injected-script.js#L812) |  |
| `hookGoogleMaps` | function | [L851](../../../../leo-vibe-extension/injected-script.js#L851) |  |
| `findAndInject` | function | [L961](../../../../leo-vibe-extension/injected-script.js#L961) |  |
| `findMapInstance` | function | [L1003](../../../../leo-vibe-extension/injected-script.js#L1003) |  |
| `checkObject` | function | [L1286](../../../../leo-vibe-extension/injected-script.js#L1286) | obj, name |
| `scanForMap` | function | [L1322](../../../../leo-vibe-extension/injected-script.js#L1322) | obj, path, depth |
| `createOverlay` | function | [L1380](../../../../leo-vibe-extension/injected-script.js#L1380) | map |
| `zoomToFitAllCircles` | function | [L1514](../../../../leo-vibe-extension/injected-script.js#L1514) | targetMap |
| `tryFindRealMapAndRetry` | function | [L1536](../../../../leo-vibe-extension/injected-script.js#L1536) |  |
| `applyCirclesToMap` | function | [L1582](../../../../leo-vibe-extension/injected-script.js#L1582) | realMap |
| `detectSite` | function | [L1599](../../../../leo-vibe-extension/injected-script.js#L1599) |  |
| `triggerSearchRefresh` | function | [L1610](../../../../leo-vibe-extension/injected-script.js#L1610) | map, area |
| `triggerAirbnbSearch` | function | [L1648](../../../../leo-vibe-extension/injected-script.js#L1648) | ne, sw, zoom |
| `triggerBookingSearch` | function | [L1680](../../../../leo-vibe-extension/injected-script.js#L1680) | center, zoom, map |
| `cleanupCardListeners` | function | [L1734](../../../../leo-vibe-extension/injected-script.js#L1734) |  |
| `navigateToArea` | function | [L1746](../../../../leo-vibe-extension/injected-script.js#L1746) | direction |
| `showVibeInfoCard` | function | [L1782](../../../../leo-vibe-extension/injected-script.js#L1782) | name, area, activeMap, persistent |
| `buildMapsSearchUrl` | function | [L1801](../../../../leo-vibe-extension/injected-script.js#L1801) | query, lat, lng, zoom |
| `buildTikTokSearchUrl` | function | [L1807](../../../../leo-vibe-extension/injected-script.js#L1807) | query, areaName |
| `hideVibeInfoCard` | function | [L2135](../../../../leo-vibe-extension/injected-script.js#L2135) | force |
| `setupMutationObserver` | function | [L2354](../../../../leo-vibe-extension/injected-script.js#L2354) |  |
| `startObserving` | function | [L2381](../../../../leo-vibe-extension/injected-script.js#L2381) |  |
| `setupPeriodicMapCheck` | function | [L2397](../../../../leo-vibe-extension/injected-script.js#L2397) |  |
| `setupMapClickFinder` | function | [L2473](../../../../leo-vibe-extension/injected-script.js#L2473) |  |
| `setupMapScrollFinder` | function | [L2496](../../../../leo-vibe-extension/injected-script.js#L2496) |  |
| `triggerMapRefresh` | function | [L2524](../../../../leo-vibe-extension/injected-script.js#L2524) |  |
| `init` | function | [L2560](../../../../leo-vibe-extension/injected-script.js#L2560) |  |
| `tryHook` | function | [L2565](../../../../leo-vibe-extension/injected-script.js#L2565) |  |
| `initWhenReady` | function | [L2586](../../../../leo-vibe-extension/injected-script.js#L2586) |  |

Imports: 
