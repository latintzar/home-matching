/**
 * Integrator Function for Photo Analysis Pipeline
 * 
 * Merges Stage 1 (Whole Property) and Stage 2 (Room-by-Room) outputs
 * into the exact production JSON structure following merge rules.
 */

import { 
  IntegratedAnalysis, 
  WholePropertyAnalysis, 
  RoomByRoomAnalysis,
  Rating,
  CertaintyMode,
  PhotoLayout,
  LikelyWork
} from '@/types/integrated-analysis';

export interface IntegratorContext {
  property_title: string;
  price: number;
  size: number;
  bedrooms: number;
  bathrooms: number;
  floor_info?: string;
  year_built?: number;
  community_fee?: number;
  agent_name?: string;
  listing_ref?: string;
  photos_reviewed: number;
}

/**
 * Main integrator function
 * Applies merge rules and computes certainty percentages
 */
export function integrateAnalysis(
  stage1: WholePropertyAnalysis,
  stage2: RoomByRoomAnalysis,
  context: IntegratorContext
): IntegratedAnalysis {
  
  // Merge summary ratings (prefer Observed over Inferred)
  const summary_ratings = mergeSummaryRatings(stage1.summary_ratings, stage2);
  
  // Build must_verify_next from stage1 top_checks + high-risk room items
  const must_verify_next = buildMustVerifyNext(stage1.top_checks, stage2.rooms);
  
  // Compute how_sure_we_are from all room observations
  const how_sure_we_are = computeCertaintyBreakdown(stage2.rooms);
  
  // Merge whole property notes
  const whole_property_notes = stage1.notes;
  
  // Transform room analyses with photo layout hints
  const rooms = transformRoomAnalyses(stage2.rooms);
  
  // Merge systems observations
  const systems = stage2.systems;
  
  // Generate documents to request based on Unknown ratings
  const documents_to_request = generateDocumentsToRequest(summary_ratings, rooms);
  
  // Create strategic view from high-risk items
  const strategic_view = createStrategicView(rooms, systems);

  return {
    report_meta: {
      property_title: context.property_title,
      price: `€${context.price?.toLocaleString()}`,
      size: `${context.size} m²`,
      bedrooms_bathrooms: `${context.bedrooms} bed · ${context.bathrooms} bath`,
      floor_info: context.floor_info || null,
      year_built: context.year_built || 0,
      community_fee: context.community_fee ? `€${context.community_fee}/mo` : null,
      agent_name: context.agent_name || null,
      listing_ref: context.listing_ref || null,
      run_date_iso: new Date().toISOString().split('T')[0],
      photos_reviewed: context.photos_reviewed,
      disclaimer: 'Visual, photo-based review only; not a survey or compliance opinion.'
    },
    summary: {
      general_impression: stage1.general_impression,
      summary_ratings,
      how_sure_we_are,
      must_verify_next
    },
    whole_property_notes,
    rooms,
    systems,
    documents_to_request,
    strategic_view
  };
}

/**
 * Merge summary ratings from Stage 1 with Stage 2 insights
 * Prefer Observed over Inferred when conflicts exist
 */
function mergeSummaryRatings(
  stage1Ratings: any,
  stage2: RoomByRoomAnalysis
): any {
  const merged = { ...stage1Ratings };
  
  // If Stage 1 has Unknown but Stage 2 has more specific info, use Stage 2
  // This is a simplified merge - in practice, you'd analyze room conditions
  // to infer property-wide ratings
  
  return merged;
}

/**
 * Build must_verify_next list from Stage 1 top_checks + high-risk room items
 * Cap at 10 items total
 */
function buildMustVerifyNext(
  topChecks: Array<{ room: string; element: string; why: string; sure: CertaintyMode }>,
  rooms: Array<{ name: string; condition: Rating; risks: string[]; verify: string[] }>
): Array<{ room: string; element: string; what_to_check: string; sure: CertaintyMode }> {
  
  const items: Array<{ room: string; element: string; what_to_check: string; sure: CertaintyMode }> = [];
  
  // Add Stage 1 top checks
  topChecks.forEach(check => {
    items.push({
      room: check.room,
      element: check.element,
      what_to_check: check.why,
      sure: check.sure
    });
  });
  
  // Add high-risk room items (rooms with Poor condition or high-risk items)
  rooms.forEach(room => {
    if (room.condition === 'Poor' || room.risks.length > 0) {
      room.verify.forEach(verifyItem => {
        items.push({
          room: room.name,
          element: 'General condition',
          what_to_check: verifyItem,
          sure: 'Inferred' as CertaintyMode
        });
      });
    }
  });
  
  // Cap at 10 items
  return items.slice(0, 10);
}

/**
 * Compute how_sure_we_are percentages from all room observations
 */
function computeCertaintyBreakdown(
  rooms: Array<{ observations: Array<{ mode: CertaintyMode }> }>
): { observed_pct: number; inferred_pct: number; unknown_pct: number } {
  
  let observed = 0;
  let inferred = 0;
  let unknown = 0;
  let total = 0;
  
  rooms.forEach(room => {
    room.observations.forEach(obs => {
      total++;
      switch (obs.mode) {
        case 'Observed':
          observed++;
          break;
        case 'Inferred':
          inferred++;
          break;
        case 'Unknown':
          unknown++;
          break;
        case 'Claimed':
          inferred++; // Treat claimed as inferred
          break;
      }
    });
  });
  
  if (total === 0) {
    return { observed_pct: 0, inferred_pct: 0, unknown_pct: 100 };
  }
  
  return {
    observed_pct: Math.round((observed / total) * 100),
    inferred_pct: Math.round((inferred / total) * 100),
    unknown_pct: Math.round((unknown / total) * 100)
  };
}

/**
 * Transform room analyses with photo layout hints
 */
function transformRoomAnalyses(
  rooms: Array<{ 
    name: string; 
    condition: Rating; 
    observations: Array<{ mode: CertaintyMode; element: string; visual_cue: string }>; 
    risks: string[]; 
    verify: string[]; 
    likely_work: LikelyWork 
  }>
): Array<{
  name: string;
  condition: Rating;
  photo_layout: PhotoLayout;
  observations: Array<{ mode: CertaintyMode; element: string; visual_cue: string }>;
  risks: string[];
  verify: string[];
  likely_work: LikelyWork;
}> {
  
  return rooms.map(room => ({
    ...room,
    photo_layout: determinePhotoLayout(room.name, room.observations.length)
  }));
}

/**
 * Determine photo layout based on room type and observation count
 */
function determinePhotoLayout(roomName: string, observationCount: number): PhotoLayout {
  const name = roomName.toLowerCase();
  
  // Special cases
  if (name.includes('terraza') || name.includes('terrace')) {
    return 'panorama';
  }
  
  if (name.includes('salón') || name.includes('living')) {
    return observationCount > 3 ? 'masonry' : 'grid-2';
  }
  
  // Default based on observation count
  if (observationCount <= 2) {
    return 'grid-2';
  } else if (observationCount <= 3) {
    return 'grid-3';
  } else {
    return 'masonry';
  }
}

/**
 * Generate documents to request based on Unknown ratings and room conditions
 */
function generateDocumentsToRequest(
  summaryRatings: any,
  rooms: Array<{ condition: Rating; name: string }>
): Array<{ title: string; description: string }> {
  
  const documents: Array<{ title: string; description: string }> = [];
  
  // Always request EPC
  documents.push({
    title: 'Energy Performance Certificate (EPC/CEE)',
    description: 'Required for all property transactions in Spain'
  });
  
  // Request building inspection if Unknown ratings
  const hasUnknownRatings = Object.values(summaryRatings).some((rating: any) => rating === 'Unknown');
  if (hasUnknownRatings) {
    documents.push({
      title: 'Building Inspection Report (ITE/IEE)',
      description: 'Technical building inspection for structural and systems assessment'
    });
  }
  
  // Request community documents if applicable
  documents.push({
    title: 'Community Minutes & Assessments',
    description: 'Recent community meetings and any extraordinary assessments ("derrama")'
  });
  
  // Request lift maintenance if mentioned
  if (summaryRatings.accessibility_safety === 'Claimed-verify') {
    documents.push({
      title: 'Lift Maintenance Logs',
      description: 'Recent maintenance records and service dates'
    });
  }
  
  return documents;
}

/**
 * Create strategic view from high-risk items and system observations
 */
function createStrategicView(
  rooms: Array<{ condition: Rating; name: string; risks: string[]; likely_work: LikelyWork }>,
  systems: Array<{ domain: string; observation: string; confidence: CertaintyMode }>
): Array<{ category: string; assessment: string; action: string }> {
  
  const strategic: Array<{ category: string; assessment: string; action: string }> = [];
  
  // High-risk rooms
  const poorConditionRooms = rooms.filter(room => room.condition === 'Poor');
  if (poorConditionRooms.length > 0) {
    strategic.push({
      category: 'Room Conditions',
      assessment: `${poorConditionRooms.length} room(s) in poor condition`,
      action: 'Prioritize renovation planning and budget allocation'
    });
  }
  
  // Unknown systems
  const unknownSystems = systems.filter(sys => sys.confidence === 'Unknown');
  if (unknownSystems.length > 0) {
    strategic.push({
      category: 'Systems Assessment',
      assessment: `${unknownSystems.length} system(s) require inspection`,
      action: 'Arrange professional inspection before purchase'
    });
  }
  
  // High-risk work requirements
  const specialistWork = rooms.filter(room => room.likely_work === 'Specialist');
  if (specialistWork.length > 0) {
    strategic.push({
      category: 'Renovation Complexity',
      assessment: 'Specialist work required in multiple areas',
      action: 'Factor specialist costs and timeline into renovation budget'
    });
  }
  
  return strategic;
}

/**
 * Unit test fixtures
 */
export const TEST_FIXTURES = {
  wellPhotographed: {
    stage1: {
      general_impression: "Well-photographed property with clear views of all major areas",
      summary_ratings: {
        envelope: "Good",
        moisture: "Good", 
        windows_doors: "Good",
        kitchen_baths: "Good",
        electrical: "Fair",
        plumbing: "Fair",
        heating_cooling: "Unknown",
        finishes: "Good",
        accessibility_safety: "Good",
        energy_comfort: "Fair"
      },
      top_checks: [
        {
          room: "Kitchen",
          element: "electrical outlets",
          why: "check for GFCI protection",
          sure: "Inferred" as CertaintyMode
        }
      ],
      notes: [
        {
          category: "exposure",
          text: "South-facing, good natural light",
          sure: "Observed" as CertaintyMode
        }
      ]
    } as WholePropertyAnalysis,
    stage2: {
      rooms: [
        {
          name: "Kitchen",
          condition: "Good" as Rating,
          observations: [
            { mode: "Observed" as CertaintyMode, element: "countertops", visual_cue: "granite surface clean" },
            { mode: "Observed" as CertaintyMode, element: "cabinets", visual_cue: "doors aligned properly" }
          ],
          risks: [],
          verify: ["check electrical outlets"],
          likely_work: "Cosmetic" as LikelyWork
        }
      ],
      systems: [
        {
          domain: "electrical" as const,
          observation: "outlets visible, no obvious issues",
          confidence: "Observed" as CertaintyMode
        }
      ]
    } as RoomByRoomAnalysis
  },
  
  sparsePhotos: {
    stage1: {
      general_impression: "Limited photos available, mostly exterior views",
      summary_ratings: {
        envelope: "Fair",
        moisture: "Unknown",
        windows_doors: "Unknown", 
        kitchen_baths: "Unknown",
        electrical: "Unknown",
        plumbing: "Unknown",
        heating_cooling: "Unknown",
        finishes: "Unknown",
        accessibility_safety: "Unknown",
        energy_comfort: "Unknown"
      },
      top_checks: [
        {
          room: "Interior",
          element: "general condition",
          why: "insufficient photos for assessment",
          sure: "Unknown" as CertaintyMode
        }
      ],
      notes: [
        {
          category: "context",
          text: "Very limited photo coverage",
          sure: "Observed" as CertaintyMode
        }
      ]
    } as WholePropertyAnalysis,
    stage2: {
      rooms: [],
      systems: []
    } as RoomByRoomAnalysis
  }
};
