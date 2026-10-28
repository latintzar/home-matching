import { LifestyleOrchestrator, SmartAnchor } from '../src/lib/lifestyle/orchestrator';
import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';

async function runOrchestratorScenarios() {
    const orchestrator = new LifestyleOrchestrator();

    // --- 1. Define Base "Perfect" Profile (The Active Introvert) ---
    // Hard: Beach (15), Tennis (10), Pool (10).
    // Soft: Coworking (15) + Italian Sandwich (0.8km).
    // Vibe: No Party (500m).
    
    const baseAnchors: SmartAnchor[] = [
        {
            id: 'beach', type: 'fixed', name: 'Barceloneta Beach',
            location: { lat: 41.3804, lng: 2.1923 },
            commute: { mode: 'moped', maxDuration: 15 }, color: '#06B6D4'
        },
        {
            id: 'tennis', type: 'fixed', name: 'Tennis (Hills)',
            location: { lat: 41.4283, lng: 2.1465 },
            commute: { mode: 'moped', maxDuration: 10 }, color: '#10B981'
        },
        {
            id: 'pool', type: 'fixed', name: 'Montjuïc Pool',
            location: { lat: 41.3695, lng: 2.1625 },
            commute: { mode: 'moped', maxDuration: 10 }, color: '#3B82F6'
        },
        {
            id: 'work', type: 'search', name: 'Coworking',
            query: 'coworking',
            searchArea: { center: { lat: 41.4010, lng: 2.1560 }, radiusKm: 2 },
            filters: [{ type: 'rating', value: 4.2, operator: '>' }],
            dependencies: [
                { searchQuery: 'italian sandwich', relation: 'close_to', distanceKm: 0.8, mode: 'walking', maxDuration: 10 }
            ],
            commute: { mode: 'moped', maxDuration: 15 }, color: '#8B5CF6'
        }
    ];

    console.log('🚀 Running BASE Scenario (Perfect Sweet Spot)...');
    const baseResult = await orchestrator.resolveProfile(baseAnchors);
    
    // Apply Negative Constraint manually here for now (Party Buffer)
    // In a real app, this would be part of the orchestrator's standard logic
    const partySpots = await orchestrator.search('nightclub', { lat: 41.4010, lng: 2.1560 }, 2);
    const partyPolys = partySpots.map((p: any) => turf.circle([p.lng, p.lat], 0.5, { steps: 10, units: 'kilometers' })); // 500m buffer
    
    let perfectSpot = baseResult.sweetSpot;
    if (perfectSpot) {
        for (const poly of partyPolys) {
            try { perfectSpot = turf.difference(turf.featureCollection([perfectSpot, poly])); } catch(e) {}
        }
    }

    // --- 2. Generate 5 "Opportunity" Scenarios ---
    const scenarios = [];

    // Scenario 1: The Foodie Pivot (Swap Italian -> Menu del Dia)
    console.log('\n💡 Running Scenario 1: The Foodie Pivot...');
    const s1Anchors = JSON.parse(JSON.stringify(baseAnchors));
    s1Anchors.find((a: any) => a.id === 'work').dependencies[0].searchQuery = 'menu del dia';
    const s1Result = await orchestrator.resolveProfile(s1Anchors);
    let s1Spot = s1Result.sweetSpot;
    if (s1Spot) partyPolys.forEach((p: any) => { try { s1Spot = turf.difference(turf.featureCollection([s1Spot, p])); } catch(e){} });
    scenarios.push({
        name: "The Foodie Pivot",
        justification: "Swapping Italian sandwiches for Menu del Día unlocks authentic neighborhoods with great lunch spots.",
        geometry: s1Spot,
        color: '#F97316' // Orange
    });

    // Scenario 2: The Weekend Warrior (Relax Sports to 20m)
    console.log('\n💡 Running Scenario 2: The Weekend Warrior...');
    const s2Anchors = JSON.parse(JSON.stringify(baseAnchors));
    s2Anchors.find((a: any) => a.id === 'tennis').commute.maxDuration = 20;
    s2Anchors.find((a: any) => a.id === 'pool').commute.maxDuration = 20;
    const s2Result = await orchestrator.resolveProfile(s2Anchors);
    let s2Spot = s2Result.sweetSpot;
    if (s2Spot) partyPolys.forEach((p: any) => { try { s2Spot = turf.difference(turf.featureCollection([s2Spot, p])); } catch(e){} });
    scenarios.push({
        name: "The Weekend Warrior",
        justification: "Relaxing sports commute to 20m (since you only go on weekends) drastically expands your range.",
        geometry: s2Spot,
        color: '#10B981' // Green
    });

    // Scenario 3: The Beach Bum (Relax Work to 25m)
    console.log('\n💡 Running Scenario 3: The Beach Bum...');
    const s3Anchors = JSON.parse(JSON.stringify(baseAnchors));
    s3Anchors.find((a: any) => a.id === 'work').commute.maxDuration = 25;
    const s3Result = await orchestrator.resolveProfile(s3Anchors);
    let s3Spot = s3Result.sweetSpot;
    if (s3Spot) partyPolys.forEach((p: any) => { try { s3Spot = turf.difference(turf.featureCollection([s3Spot, p])); } catch(e){} });
    scenarios.push({
        name: "The Beach Bum",
        justification: "Accepting a 25m commute to coworking allows you to live in prime beachside zones.",
        geometry: s3Spot,
        color: '#06B6D4' // Cyan
    });

    // Scenario 4: The Night Owl (Relax Party Buffer to 200m)
    console.log('\n💡 Running Scenario 4: The Night Owl...');
    // Reuse base result, just change subtraction
    const tightPartyPolys = partySpots.map((p: any) => turf.circle([p.lng, p.lat], 0.2, { steps: 10, units: 'kilometers' })); // 200m
    let s4Spot = baseResult.sweetSpot;
    if (s4Spot) tightPartyPolys.forEach((p: any) => { try { s4Spot = turf.difference(turf.featureCollection([s4Spot, p])); } catch(e){} });
    scenarios.push({
        name: "The Night Owl",
        justification: "Reducing the quiet buffer to 200m lets you live right on the edge of the action in Gracia.",
        geometry: s4Spot,
        color: '#EC4899' // Pink
    });

    // Scenario 5: The Nomad (No Food Dependency)
    console.log('\n💡 Running Scenario 5: The Nomad...');
    const s5Anchors = JSON.parse(JSON.stringify(baseAnchors));
    s5Anchors.find((a: any) => a.id === 'work').dependencies = []; // Remove food dependency
    const s5Result = await orchestrator.resolveProfile(s5Anchors);
    let s5Spot = s5Result.sweetSpot;
    if (s5Spot) partyPolys.forEach((p: any) => { try { s5Spot = turf.difference(turf.featureCollection([s5Spot, p])); } catch(e){} });
    scenarios.push({
        name: "The Nomad",
        justification: "Removing the sandwich requirement entirely gives you the maximum possible area.",
        geometry: s5Spot,
        color: '#6366F1' // Indigo
    });

    // --- 3. Output ---
    const mapData = {
        anchors: baseResult.layers
            .filter(l => l.type === 'isochrone')
            .map(l => ({ ...l.data, properties: { type: l.name, mode: 'moped' } })),
        
        // The Gold Standard
        perfectSweetSpot: perfectSpot, 
        
        // The 5 Variations
        opportunities: scenarios,

        // Vibe Markers (Base + S1 + Party)
        vibeMarkers: [
            ...baseResult.layers.filter(l => l.type === 'point').flatMap(l => l.data.features.map((f: any) => ({ ...f, properties: { ...f.properties, layer: 'valid_coworking_gold' } }))),
            ...s1Result.layers.filter(l => l.type === 'point' && l.id.includes('work')).flatMap(l => l.data.features.map((f: any) => ({ ...f, properties: { ...f.properties, layer: 'valid_coworking_silver' } }))),
            ...partySpots.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { title: s.name, layer: 'gentrification_high' } }))
        ],
        
        vibePolygons: []
    };

    const outputData = [{
        id: 'scenario-test',
        input_text: "Active Introvert Profile + 5 Strategic Relaxations",
        profile: { anchors: [], vibe: [] },
        stats: { cost: "0.00", anchorsCount: 4 },
        mapData: mapData
    }];

    const outputPath = path.resolve(process.cwd(), 'src/data/lifestyle-test-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\n✅ Scenarios Generated! Saved to ${outputPath}`);
}

runOrchestratorScenarios();

