import { LifestyleOrchestrator, SmartAnchor } from '../src/lib/lifestyle/orchestrator';
import { generateSmartLifestyleProfile } from '../src/lib/lifestyle/ai-profiler';
import { globalCostTracker } from '../src/lib/lifestyle/cost-calculator';
import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';

async function runSmartScenarios() {
    const orchestrator = new LifestyleOrchestrator();

    // 1. Input (The User Voice)
    const USER_INPUT = "I am an active introvert. I need to be near Barceloneta beach (15m max) because health is non-negotiable. I swim at Montjuïc pool and play tennis in the hills (Vall d'Hebron), both 10m max moped. For work, I need a coworking space that is safe and has good coffee, but it MUST be within a 10 min walk of a good Italian sandwich shop. I hate party streets, I want a village vibe, but I want to be within 15 mins walk of good bars.";

    // 2. AI Profiling & Strategy (Combined Gemini 3 Pro)
    const aiResult = await generateSmartLifestyleProfile(USER_INPUT);
    const { profile, scenarios: aiScenarios } = aiResult;
    
    console.log('\n🧬 AI Profile Generated:', JSON.stringify(profile, null, 2));
    console.log(`\n💡 AI Generated ${aiScenarios.length} Scenarios.`);

    // 4. Orchestrator Execution
    // First, build the BASE profile from the explicit hard constraints
    // In a full app, the AI would also output the structured SmartAnchor array. 
    // For this hybrid test, we map the knowns + AI's "Hidden Gems".
    
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
            searchArea: { center: { lat: 41.4010, lng: 2.1560 }, radiusKm: 2 }, // Gracia center default
            filters: [{ type: 'rating', value: 4.2, operator: '>' }],
            vibeCheck: "Safe, community feel, good lighting, not a corporate office",
            dependencies: [
                { searchQuery: 'italian sandwich', relation: 'close_to', distanceKm: 0.8, mode: 'walking', maxDuration: 10 }
            ],
            commute: { mode: 'moped', maxDuration: 15 }, color: '#8B5CF6'
        }
    ];

    // Inject "Hidden Gems" from AI as Vibe Layers (not hard constraints, just visual markers)
    // We'll search for them but not filter by them yet
    if (profile.hidden_gems && profile.hidden_gems.length > 0) {
        console.log(`\n💎 Searching for Hidden Gems: ${profile.hidden_gems.join(', ')}...`);
        // We will add these results to the map output later
    }

    console.log('\n🚀 Running BASE Scenario...');
    const baseResult = await orchestrator.resolveProfile(baseAnchors);
    
    // Apply Negative "Party" Constraint (Hardcoded for consistency with previous logic, 
    // could be AI-driven too)
    const partySpots = await orchestrator.search('nightclub', { lat: 41.4010, lng: 2.1560 }, 2);
    const partyPolys = partySpots.map((p: any) => turf.circle([p.lng, p.lat], 0.5, { steps: 10, units: 'kilometers' }));
    
    let perfectSpot = baseResult.sweetSpot;
    if (perfectSpot) {
        for (const poly of partyPolys) {
            try { perfectSpot = turf.difference(turf.featureCollection([perfectSpot, poly])); } catch(e) {}
        }
    }

    // 5. Execute AI Scenarios
    const calculatedScenarios = [];
    
    for (const scenario of aiScenarios) {
        console.log(`\n🔄 Testing AI Scenario: "${scenario.name}"...`);
        
        // Clone Base Anchors
        const testAnchors = JSON.parse(JSON.stringify(baseAnchors));
        
        // Apply Changes intelligently
        // This is a simplified mapper. In prod, this needs a robust schema mapper.
        scenario.changes.forEach(change => {
            // Try to find matching anchor by broad ID match (e.g. 'pool' matches 'pool')
            const target = testAnchors.find((a: any) => a.id.includes(change.anchor_id) || change.anchor_id.includes(a.id));
            
            if (target) {
                if (change.parameter === 'distance' || change.parameter === 'duration') {
                    if (target.commute) target.commute.maxDuration = Number(change.value);
                    console.log(`   -> Relaxed ${target.name} to ${change.value} mins`);
                }
            }
            
            // Handle Dependency Swaps (e.g. "Italian" -> "Menu del dia")
            if (change.parameter === 'dependency' && target?.dependencies) {
                 target.dependencies[0].searchQuery = change.value;
                 console.log(`   -> Swapped Dependency to "${change.value}"`);
            }
        });

        const result = await orchestrator.resolveProfile(testAnchors);
        let spot = result.sweetSpot;
        // Apply negative constraints to scenarios too
        if (spot) partyPolys.forEach((p: any) => { try { spot = turf.difference(turf.featureCollection([spot, p])); } catch(e){} });
        
        if (spot) {
            calculatedScenarios.push({
                name: scenario.name,
                justification: scenario.justification,
                geometry: spot,
                color: '#F59E0B' // Default Orange for AI scenarios
            });
        }
    }

    // 6. Output
    const mapData = {
        anchors: baseResult.layers
            .filter(l => l.type === 'isochrone')
            .map(l => ({ ...l.data, properties: { type: l.name, mode: 'moped' } })),
        
        perfectSweetSpot: perfectSpot,
        opportunities: calculatedScenarios,
        
        vibeMarkers: [
            ...baseResult.layers.filter(l => l.type === 'point').flatMap(l => l.data.features.map((f: any) => ({ ...f, properties: { ...f.properties, layer: 'base' } }))),
            ...partySpots.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { title: s.name, layer: 'gentrification_high' } }))
        ],
        vibePolygons: []
    };

    const outputData = [{
        id: 'smart-scenario-test',
        input_text: USER_INPUT,
        profile: profile, // Save the full AI profile
        stats: { cost: "0.00", anchorsCount: baseAnchors.length },
        mapData: mapData
    }];

    const outputPath = path.resolve(process.cwd(), 'src/data/lifestyle-test-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Smart Scenarios Complete! Saved to ${outputPath}`);
    
    // Log Cost Breakdown
    console.log('\n💰 FINAL COST BREAKDOWN:');
    console.log(JSON.stringify(globalCostTracker.getBreakdown(), null, 2));
}

runSmartScenarios();

