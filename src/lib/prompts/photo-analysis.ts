/**
 * Production Prompts for Photo Analysis Pipeline
 * 
 * These prompts follow the specification exactly:
 * - Simple and literal
 * - Tag all statements with confidence levels
 * - No measurements unless printed
 * - No compliance opinions
 * - Agent-safe language
 */

import { WholePropertyAnalysis, RoomByRoomAnalysis, IntegratedAnalysis } from '@/types/integrated-analysis';

/**
 * Stage 1: Whole Property Analysis Prompt
 * Uses all photos, returns WholePropertyAnalysis shape
 */
export const WHOLE_PROPERTY_PROMPT = (context: {
  property_title: string;
  price: number;
  size: number;
  bedrooms: number;
  bathrooms: number;
  floor_info?: string;
  year_built?: number;
  community_fee?: number;
  agent_notes?: string;
  photo_urls: string[];
}) => `
Responde estrictamente en formato JSON válido.
Todos los textos descriptivos en español; etiquetas ('Observed', 'Inferred', etc.) en inglés.

Analyze this Spanish property comprehensively using all photos.

PROPERTY FACTS:
- Title: ${context.property_title}
- Price: €${context.price?.toLocaleString()}
- Size: ${context.size} m²
- Bedrooms: ${context.bedrooms}, Bathrooms: ${context.bathrooms}
${context.floor_info ? `- Floor: ${context.floor_info}` : ''}
${context.year_built ? `- Year built: ${context.year_built}` : ''}
${context.community_fee ? `- Community fee: €${context.community_fee}/month` : ''}
${context.agent_notes ? `\nBUYER AGENT NOTES:\n"${context.agent_notes}"\n(Consider these insights in your analysis, but verify against photos)` : ''}

IMPORTANT: The photos show the property with furniture and decorations. For your analysis, focus on the architecture, permanent fixtures, and structural elements. Ignore furniture, decorations, and personal items - these will be removed and are not relevant to renovation planning.

PHOTOS: ${context.photo_urls.length} photos provided as images

Provide analysis in Spanish following this exact JSON structure:
{
  "general_impression": "120-180 words describing overall visual assessment",
  "summary_ratings": {
    "envelope": "Good|Fair|Poor|Unknown",
    "moisture": "Good|Fair|Poor|Unknown",
    "windows_doors": "Good|Fair|Poor|Unknown",
    "kitchen_baths": "Good|Fair|Poor|Unknown",
    "electrical": "Good|Fair|Poor|Unknown",
    "plumbing": "Good|Fair|Poor|Unknown",
    "heating_cooling": "Good|Fair|Poor|Unknown",
    "finishes": "Good|Fair|Poor|Unknown",
    "accessibility_safety": "Good|Fair|Poor|Unknown|Claimed-verify",
    "energy_comfort": "Good|Fair|Poor|Unknown"
  },
  "top_checks": [
    {
      "room": "Kitchen",
      "element": "worktop edge at sink",
      "why": "laminate swelling visible",
      "sure": "Observed"
    }
  ],
  "notes": [
    {
      "category": "exposure",
      "text": "Top floor, bay-facing; expect wind/salt on frames",
      "sure": "Inferred"
    }
  ]
}

CRITICAL RULES:
- Tag EVERY statement: Observed (visible in photos), Inferred (reasonable from visuals), Unknown (can't see), Claimed (listing states)
- Use "Unknown" liberally for hidden systems
- When listing claims something (elevator, adapted), use "Claimed-verify"
- No measurements unless printed on plans
- No compliance opinions (permits, codes)
- Conservative ratings when uncertain
- Physical nouns only (tile, frame, seal, not "quality" or "condition")
- If a category cannot be evaluated due to lack of relevant photos, mark "Unknown" and note the reason in 'notes' field
- Include 2-4 items in 'top_checks', prioritizing the most critical elements
- If insufficient evidence for rating an aspect, use 'Unknown' rather than guessing
- Return ONLY valid JSON without additional text or comments
`;

/**
 * Stage 2: Room Analysis Prompt (per room cluster)
 * Uses room-specific photos, returns room analysis
 */
export const ROOM_ANALYSIS_PROMPT = (context: {
  room_name: string;
  photo_urls: string[];
}) => `
Responde estrictamente en formato JSON válido.
Redacta observaciones en español; conserva las etiquetas ('Observed', 'Inferred', etc.) en inglés.

Analyze this specific room using only its photos.

ROOM: ${context.room_name}
PHOTOS: ${context.photo_urls.length} photos of this room

Provide analysis in Spanish following this exact JSON structure:
{
  "name": "${context.room_name}",
  "condition": "Good|Fair|Poor|Unknown",
  "observations": [
    {
      "mode": "Observed|Inferred|Unknown",
      "element": "Sliding door frame",
      "visual_cue": "aluminum frame visible"
    }
  ],
  "risks": ["short labels"],
  "verify": ["2-4 viewing checks"],
  "likely_work": "Cosmetic|Repair|Replace|Specialist"
}

CRITICAL RULES:
- 3-5 observations maximum
- Concise, physical nouns (tile, frame, seal)
- Tag each observation: Observed/Inferred/Unknown
- Focus on visible elements only
- No measurements unless printed
- No compliance opinions
- Risks must refer to visible practical consequences ('possible moisture', 'rust', 'seal deterioration')
- Verification checks should be simple visual tests ('open window', 'test drain') - not construction tasks
- If insufficient elements observed, return at least one observation with 'mode': 'Unknown'
- Return ONLY valid JSON without additional text or comments
`;

/**
 * Stage 3: Integrator Prompt
 * Merges Stage 1 + Stage 2 outputs into final IntegratedAnalysis
 */
export const INTEGRATOR_PROMPT = (context: {
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
  whole_property_analysis: WholePropertyAnalysis;
  room_analyses: Array<{
    name: string;
    condition: string;
    observations: Array<{
      mode: string;
      element: string;
      visual_cue: string;
    }>;
    risks: string[];
    verify: string[];
    likely_work: string;
  }>;
  systems: Array<{
    domain: string;
    observation: string;
    confidence: string;
  }>;
}) => `
Merge the whole-property and room-by-room analyses into a final integrated report.

PROPERTY FACTS:
- Title: ${context.property_title}
- Price: €${context.price?.toLocaleString()}
- Size: ${context.size} m²
- Bedrooms: ${context.bedrooms}, Bathrooms: ${context.bathrooms}
${context.floor_info ? `- Floor: ${context.floor_info}` : ''}
${context.year_built ? `- Year built: ${context.year_built}` : ''}
${context.community_fee ? `- Community fee: €${context.community_fee}/month` : ''}
${context.agent_name ? `- Agent: ${context.agent_name}` : ''}
${context.listing_ref ? `- Ref: ${context.listing_ref}` : ''}
- Photos reviewed: ${context.photos_reviewed}

WHOLE PROPERTY ANALYSIS:
${JSON.stringify(context.whole_property_analysis, null, 2)}

ROOM ANALYSES:
${JSON.stringify(context.room_analyses, null, 2)}

SYSTEMS:
${JSON.stringify(context.systems, null, 2)}

Generate the final integrated analysis following this exact JSON structure:
{
  "report_meta": {
    "property_title": "${context.property_title}",
    "price": "€${context.price?.toLocaleString()}",
    "size": "${context.size} m²",
    "bedrooms_bathrooms": "${context.bedrooms} bed · ${context.bathrooms} bath",
    "floor_info": ${context.floor_info ? `"${context.floor_info}"` : 'null'},
    "year_built": ${context.year_built || 0},
    "community_fee": ${context.community_fee ? `"€${context.community_fee}/mo"` : 'null'},
    "agent_name": ${context.agent_name ? `"${context.agent_name}"` : 'null'},
    "listing_ref": ${context.listing_ref ? `"${context.listing_ref}"` : 'null'},
    "run_date_iso": "${new Date().toISOString().split('T')[0]}",
    "photos_reviewed": ${context.photos_reviewed},
    "disclaimer": "Visual, photo-based review only; not a survey or compliance opinion."
  },
  "summary": {
    "general_impression": "string",
    "summary_ratings": {
      "envelope": "Good|Fair|Poor|Unknown",
      "moisture": "Good|Fair|Poor|Unknown",
      "windows_doors": "Good|Fair|Poor|Unknown",
      "kitchen_baths": "Good|Fair|Poor|Unknown",
      "electrical": "Good|Fair|Poor|Unknown",
      "plumbing": "Good|Fair|Poor|Unknown",
      "heating_cooling": "Good|Fair|Poor|Unknown",
      "finishes": "Good|Fair|Poor|Unknown",
      "accessibility_safety": "Good|Fair|Poor|Unknown|Claimed-verify",
      "energy_comfort": "Good|Fair|Poor|Unknown"
    },
    "how_sure_we_are": {
      "observed_pct": 0,
      "inferred_pct": 0,
      "unknown_pct": 0
    },
    "must_verify_next": [
      {
        "room": "string",
        "element": "string",
        "what_to_check": "string",
        "sure": "Observed|Inferred|Claimed"
      }
    ]
  },
  "whole_property_notes": [
    {
      "category": "string",
      "text": "string",
      "sure": "Observed|Inferred|Unknown|Claimed"
    }
  ],
  "rooms": [
    {
      "name": "string",
      "condition": "Good|Fair|Poor|Unknown",
      "photo_layout": "grid-3|grid-2|panorama|masonry",
      "observations": [
        {
          "mode": "Observed|Inferred|Unknown",
          "element": "string",
          "visual_cue": "string"
        }
      ],
      "risks": ["string"],
      "verify": ["string"],
      "likely_work": "Cosmetic|Repair|Replace|Specialist"
    }
  ],
  "systems": [
    {
      "domain": "electrical|plumbing|heating_cooling|accessibility_safety",
      "observation": "string",
      "confidence": "Observed|Inferred|Unknown|Claimed"
    }
  ],
  "documents_to_request": [
    {
      "title": "string",
      "description": "string"
    }
  ],
  "strategic_view": [
    {
      "category": "string",
      "assessment": "string",
      "action": "string"
    }
  ]
}

CRITICAL MERGE RULES:
- Preserve Unknowns from both stages
- Prefer Observed over Inferred when conflicts exist
- Cap must_verify_next at 10 items
- Compute how_sure_we_are percentages from all room observations
- Add photo_layout hints based on photo count (1-2: grid-2, 3+: grid-3, many: masonry)
- Generate documents_to_request based on Unknown ratings
- Create strategic_view from high-risk items
- Return ONLY valid JSON
`;

/**
 * Few-shot Example (Cádiz Property)
 * Used as reference for tone and structure
 */
export const FLAGSHIP_EXAMPLE = {
  property_title: "Ático · La Paz – Segunda Aguada – Loreto, Cádiz",
  price: 315000,
  size: 78,
  bedrooms: 2,
  bathrooms: 1,
  floor_info: "Floor 11 (exterior, with lift)",
  year_built: 1974,
  community_fee: 75,
  agent_name: "Tecnocasa Cádiz",
  listing_ref: "108584532",
  photos_reviewed: 17,
  
  example_output: {
    general_impression: "Bright top-floor flat. Finishes appear maintained. Enclosed terrace adds light/views but raises waterproofing/condensation questions. Services (electrical, plumbing, ventilation) not fully visible.",
    summary_ratings: {
      envelope: "Fair",
      moisture: "Unknown", 
      windows_doors: "Fair",
      kitchen_baths: "Good",
      electrical: "Unknown",
      plumbing: "Unknown",
      heating_cooling: "Unknown",
      finishes: "Good",
      accessibility_safety: "Claimed-verify",
      energy_comfort: "Fair"
    },
    how_sure_we_are: {
      observed_pct: 60,
      inferred_pct: 25,
      unknown_pct: 15
    },
    must_verify_next: [
      {
        room: "Terrace (enclosed)",
        element: "floor & upstands",
        what_to_check: "confirm waterproofing; verify enclosure permit",
        sure: "Inferred"
      },
      {
        room: "Living room",
        element: "sliding doors", 
        what_to_check: "check glazing type and seals; note drafts/condensation",
        sure: "Inferred"
      }
    ]
  }
};
