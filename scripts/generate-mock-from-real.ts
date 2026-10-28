
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars
// Recipient configuration is supplied by tools/runtime-env.py.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateMockFromReal(listingId: string) {
  console.log(`🚀 Generating mock data from real listing: ${listingId}`);
  const listingIdNum = parseInt(listingId, 10);

  // 1. Fetch Listing & Social Intelligence
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingIdNum)
    .single();

  if (listingError || !listing) {
    console.error(`❌ Listing ${listingId} not found`);
    process.exit(1);
  }

  // 2. Fetch Buyer Report
  const { data: buyerReportRes, error: reportError } = await supabase
    .from('text_analysis_results')
    .select('results')
    .eq('listing_id', listingId)
    .eq('phase', 'buyer_report')
    .maybeSingle();

  if (reportError || !buyerReportRes) {
    console.error(`❌ Buyer Report not found for ${listingId}. Run the orchestrator first.`);
    // Don't exit, we might want to partially fill
  }
  const buyerReport = buyerReportRes?.results || {};

  // 3. Fetch Cadastral Data (Raw)
  const { data: cadastralRes } = await supabase
    .from('text_analysis_results')
    .select('results')
    .eq('listing_id', listingId)
    .eq('phase', 'cadastral_data')
    .maybeSingle();
  
  const cadastralRaw = cadastralRes?.results || {};

  // 4. Fetch Verification Checklist
  const { data: verifyRes } = await supabase
    .from('verify_recommendations')
    .select('recommendations')
    .eq('listing_id', listingId)
    .maybeSingle();
  
  const checklist = verifyRes?.recommendations || buyerReport.verification_checklist || {};

  // 5. Stitch it all together
  const socialIntel = listing.social_intelligence || {};
  
  const mockData = {
    listing_id: listingId,
    generated_at: new Date().toISOString(),
    property_info: {
      title: listing.title || "Property Title",
      location: `${listing.address || ''}, ${listing.city || ''}`,
      price_eur: listing.price_eur || 0,
      last_updated: new Date().toISOString().split('T')[0],
      size_m2: listing.size_m2 || 0,
      bedrooms: listing.bedrooms || 0,
      bathrooms: listing.bathrooms || 0,
      main_image_url: listing.photos?.[0] || "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1600",
      agent_phone: "34600000000" // Fallback
    },
    house_as_a_whole: buyerReport.house_as_a_whole || {
      narrative_synthesis: "Analysis pending...",
      cross_room_themes: [],
      room_one_liners: []
    },
    forensic_risk_audit: buyerReport.forensic_risk_audit || {},
    execution_reality_check: buyerReport.execution_reality_check || {},
    financial_intelligence: buyerReport.financial_intelligence || {},
    verification_checklist: checklist,
    source_data: {
      cadastral_data: cadastralRaw.data ? {
        found: true,
        level3: cadastralRaw.data.level3,
        level4: cadastralRaw.data.level4,
        warnings: cadastralRaw.analysis?.discrepancies || [],
        map_url: cadastralRaw.data.cartography?.url || "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=800"
      } : null,
      social_radar: {
        risk_level: socialIntel.social?.riskLevel || "Unknown",
        summary: socialIntel.social?.summary || "No social data",
        center: { lat: listing.latitude || 0, lng: listing.longitude || 0 },
        airbnb_listings: socialIntel.social?.airbnb?.listingsDetail?.map((l: any) => ({
          id: l.id,
          lat: l.lat,
          lng: l.lon,
          price: l.price,
          rating: l.rating,
          name: l.name
        })) || [],
        reviews: socialIntel.social?.airbnb?.redFlags?.map((f: any) => ({
          text: f.text,
          source: "Airbnb Analysis",
          date: f.date
        })) || []
      },
      street_view: {
        images: (socialIntel.street_view_images || socialIntel.visual?.analyzed_images || []).map((img: any) => ({
          url: typeof img === 'string' ? img : img.url,
          caption: typeof img === 'string' ? "Street View" : (img.caption || "Street View"),
          pins: typeof img === 'string' ? [] : (img.pins || [])
        })),
        annotations: socialIntel.visual?.summary_points || []
      },
      visual_detective: socialIntel.visual ? {
        vibe_score: socialIntel.visual.vibe_score,
        maintenance_condition: socialIntel.visual.maintenance_condition,
        security_features: socialIntel.visual.security_features,
        summary: socialIntel.visual.summary
      } : null,
      geology: socialIntel.geology || null,
      tenders: socialIntel.tenders || null
    }
  };

  // Write to file
  const fileContent = `
export const mockBuyerReport = ${JSON.stringify(mockData, null, 2)};
`;

  const targetPath = path.join(process.cwd(), 'src/lib/mock-buyer-report.ts');
  fs.writeFileSync(targetPath, fileContent);
  console.log(`✅ Successfully wrote real data to ${targetPath}`);
}

const listingId = process.argv[2] || '109445875';
generateMockFromReal(listingId).catch(console.error);

