import { LifestyleOrchestrator, SmartAnchor } from '../src/lib/lifestyle/orchestrator';
import fs from 'fs';
import path from 'path';

async function runOrchestratorTest() {
    const orchestrator = new LifestyleOrchestrator();

    // Define the "Active Introvert" Profile using the Smart Schema
    const profileAnchors: SmartAnchor[] = [
        // 1. Hard Anchor: Beach
        {
            id: 'beach',
            type: 'fixed',
            name: 'Barceloneta Beach',
            location: { lat: 41.3804, lng: 2.1923 },
            commute: { mode: 'moped', maxDuration: 15 },
            color: '#06B6D4' // Cyan
        },
        // 2. Hard Anchor: Tennis
        {
            id: 'tennis',
            type: 'fixed',
            name: 'Tennis (Hills)',
            location: { lat: 41.4283, lng: 2.1465 },
            commute: { mode: 'moped', maxDuration: 15 }, // Tightened to 15m for better triangulation
            color: '#10B981' // Green
        },
        // 3. Variable Anchor: Coworking (Smart Search)
        {
            id: 'work_gold',
            type: 'search',
            name: 'Coworking (Gold)',
            query: 'coworking',
            searchArea: { 
                center: { lat: 41.4010, lng: 2.1560 }, // Gracia Center
                radiusKm: 2 
            },
            filters: [
                { type: 'rating', value: 4.2, operator: '>' }
            ],
            // THE SMART DEPENDENCY: Must be near Italian Sandwich
            dependencies: [
                {
                    searchQuery: 'italian sandwich',
                    relation: 'close_to',
                    distanceKm: 0.8, // 10 min walk
                    mode: 'walking',
                    maxDuration: 10
                }
            ],
            commute: { mode: 'moped', maxDuration: 15 },
            color: '#8B5CF6' // Purple
        }
    ];

    // Execute
    const result = await orchestrator.resolveProfile(profileAnchors);

    // Format for Frontend
    // We need to adapt the orchestrator output to the format expected by LifestyleMapLibre
    // Or update LifestyleMapLibre to accept this new format.
    // For now, let's adapt it to the existing JSON structure to avoid frontend breakage.
    
    const mapData = {
        // Extract anchors from layers
        anchors: result.layers
            .filter(l => l.type === 'isochrone')
            .map(l => ({
                ...l.data,
                properties: { type: l.name, mode: 'moped' } // simplified properties
            })),
        
        sweetSpot: result.sweetSpot,
        perfectSweetSpot: result.sweetSpot, // Gold renderer
        
        // Markers
        vibeMarkers: result.layers
            .filter(l => l.type === 'point')
            .flatMap(l => l.data.features.map((f: any) => ({
                ...f,
                properties: { ...f.properties, layer: l.name }
            }))),
            
        vibePolygons: []
    };

    const outputData = [{
        id: 'orchestrator-test',
        input_text: "AUTOMATED ORCHESTRATOR: Beach(15m) + Tennis(15m) + Coworking(15m, rated>4.2) near Italian Sandwich.",
        profile: {
            anchors: profileAnchors.map(a => ({ type: a.name, location: a.location || { lat: 0, lng: 0 } })),
            vibe: []
        },
        stats: {
            cost: result.stats.cost.toFixed(4),
            anchorsCount: profileAnchors.length
        },
        mapData: mapData
    }];

    const outputPath = path.resolve(process.cwd(), 'src/data/lifestyle-test-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Orchestrator Test Complete!`);
    console.log(`   - Cost: $${result.stats.cost.toFixed(4)}`);
    console.log(`   - Calls: ${result.stats.apiCalls}`);
}

runOrchestratorTest();

