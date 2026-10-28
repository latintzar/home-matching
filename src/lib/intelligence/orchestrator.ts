import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// Do not import classes at top-level if they have native dependencies initialized in constructors
// Or ensure the constructors are safe (which we did in the previous step for SocialRadar)
import { SocialRadar } from '@/lib/intelligence/social-radar';
import { TenderWatch } from '@/lib/intelligence/tenders';
import { GeologyCheck } from '@/lib/intelligence/geology';
import { PIPELINE_VERSIONS } from '@/lib/pipeline-versions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function generateAndSaveIntelligence(listingId: number, address: string, lat: number, lng: number, city: string) {
    console.log(`🕵️‍♂️ Running Intelligence Suite for Listing ${listingId}`);
    
    const socialRadar = new SocialRadar();
    const tenderWatch = new TenderWatch();
    const geologyCheck = new GeologyCheck();

    // Extract street name from address (simple heuristic)
    const street = address.split(',')[0]; 

    // Run all modules in parallel (StreetView removed - can be re-added later)
    const [socialResults, tenderResults, geologyResults] = await Promise.all([
        socialRadar.analyzeLocation(lat, lng, [address, city, street], 'exact'),
        tenderWatch.checkStreetWorks(street, city),
        geologyCheck.checkPoint(lat, lng)
    ]);

    const intelligenceData = {
        social: socialResults,
        tenders: tenderResults,
        geology: geologyResults,
        generated_at: new Date().toISOString(),
        _version: PIPELINE_VERSIONS.INTELLIGENCE
    };

    // Save to Supabase
    const { error } = await supabase
        .from('listings')
        .update({ social_intelligence: intelligenceData })
        .eq('id', listingId);

    if (error) {
        console.error('❌ Failed to save intelligence data:', error);
        throw error;
    }

    console.log(`✅ Intelligence Suite completed and saved for listing ${listingId}`);
    return intelligenceData;
}
