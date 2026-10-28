/**
 * Architecture Improvement Prompts
 * 
 * Prompts for the refined diagnostic to prescriptive pipeline.
 * These prompts follow the architecture specification exactly.
 */

import { WholePropertyAnalysis, RoomAnalysis, RoomBullets, RoomLayoutAllocentric, WholeHomeSummary } from '@/types/renovation-intelligence';

/**
 * E3: Whole-Property Analysis Prompt
 * Model: Gemini 2.5 Pro, max-thinking, low temp
 * Output: WholePropertyAnalysis
 * 
 * Uses allocentric layouts to understand spatial relationships and room connections
 */
export const WHOLE_PROPERTY_ANALYSIS_PROMPT = (context: {
  listing_id: string;
  property_title: string;
  price: number;
  size: number;
  bedrooms: number;
  bathrooms: number;
  floor?: string;
  year_built?: number;
  photo_urls: string[];
}) => `
SYSTEM:
You are a building inspector reviewing ALL photos of one property.
Report ONLY what can be seen. If uncertain, say so.
Analyze under these lenses:
- Structural & Envelope
- Finishes & Surfaces
- Lighting & Ventilation
- Fittings & Fixtures
- Energy & Insulation
- Accessibility & Safety
- Spatial Coherence & Flow
- Potential & Limitations

PROPERTY INFORMATION:
- Listing ID: ${context.listing_id}
- Title: ${context.property_title}
- Price: €${context.price?.toLocaleString()}
- Size: ${context.size} m²
- Bedrooms: ${context.bedrooms}, Bathrooms: ${context.bathrooms}
${context.floor ? `- Floor: ${context.floor}` : ''}
${context.year_built ? `- Year built: ${context.year_built}` : ''}


PHOTOS: ${context.photo_urls.length} photos provided as images

OUTPUT: WholePropertyAnalysis JSON (fields must match exactly):
{
  "listing_id": "${context.listing_id}",
  "lenses": {
    "structural_envelope": "string - analysis under structural & envelope lens",
    "finishes_surfaces": "string - analysis under finishes & surfaces lens",
    "lighting_ventilation": "string - analysis under lighting & ventilation lens",
    "fittings_fixtures": "string - analysis under fittings & fixtures lens",
    "energy_insulation": "string - analysis under energy & insulation lens",
    "accessibility_safety": "string - analysis under accessibility & safety lens",
    "spatial_coherence_flow": "string - analysis under spatial coherence & flow lens",
    "potential_limitations": "string - analysis under potential & limitations lens"
  },
  "overall_condition_summary": "string - comprehensive summary (3-5 sentences)",
  "confidence_notes": "string - declare certainty limits, what's certain vs uncertain",
  "photo_coverage_summary": "string - what's missing or unclear, gaps in evidence"
}

STYLE: 
- Be factual and detailed, but focus on what's visible and important
- Be concise for routine observations, detailed for notable features or issues
- No speculation beyond what photos and layouts support
- Include confidence_notes and photo_coverage_summary

Return ONLY valid JSON without additional text or comments.
`;

/**
 * Room-by-Room Analysis Prompt (per cluster)
 * Model: Gemini 2.5 Pro, max-thinking, low temp
 * Rule: Do not feed whole-property analysis text into room analysis (avoid bias)
 * Output: RoomAnalysis + RoomLayoutAllocentric
 * 
 * Phase 1 Enhancement: Now generates allocentric layout (structured + expressive narrative)
 * Uses OMSRIA-processed images (single image per room showing isolated space)
 */
export const ROOM_BY_ROOM_ANALYSIS_PROMPT = (context: {
  listing_id: string;
  room_id: string;
  room_name: string;
  photo_urls: string[]; // ALL photos from the cluster (all angles)
  photo_visibility_info?: Array<{ photo_url: string; visible_rooms: string[] }>; // Which other rooms are visible in each photo
  // Minimal listing metadata - NO whole-property analysis text
  property_title?: string;
  size?: number;
}) => `
SYSTEM:
You are reviewing photos of ONE room for renovation planning. Use ONLY visible evidence.
Do NOT use any whole-property analysis text as input to avoid bias.

CRITICAL: You have access to ALL photos of this room from different angles. Some photos may show other rooms/spaces visible through openings (doors, arches, windows). Use visibility mappings to understand which other rooms are visible in each photo - this helps you understand spatial relationships and adjacencies for accurate allocentric layout description.

You must generate TWO outputs:
1. RoomAnalysis (existing format) - detailed findings by lens
2. RoomLayoutAllocentric (NEW) - allocentric layout with structured fields + expressive narrative

CRITICAL: For renovation planning, prioritize MAXIMUM DETAIL on:
- **Structural elements** (walls, columns, load-bearing, openings with dimensions)
- **Fixed finishes** (flooring material/condition, wall treatments, ceiling details)
- **Built-in fixtures** (cabinetry, plumbing fixtures, electrical outlets, wired lighting)
- **Openings** (doors, windows, archways - materials, dimensions, condition)
- **Surfaces** (material types, condition, wear patterns, installation quality)

IMPORTANT: The photos show rooms with furniture and decorations. For renovation planning, ignore all furniture, decorations, and personal items - focus only on the architecture, permanent fixtures, and structural elements. Furniture will be removed and is not relevant to renovation work items.

De-emphasize: Movable furniture, decorative items, temporary objects (these will likely be removed).

Analyze under these lenses:
- Structural & Envelope (MAXIMUM detail: walls, columns, openings, structural condition)
- Finishes & Surfaces (MAXIMUM detail: floor/wall/ceiling materials, condition, installation)
- Lighting & Ventilation (DETAILED: fixed lighting fixtures, windows, ventilation systems)
- Fittings & Fixtures (DETAILED: built-in cabinetry, plumbing, electrical - NOT movable furniture)
- Moisture & Hygiene (DETAILED: signs of water damage, mold, surface condition)
- Energy & Insulation (DETAILED: window types, insulation visible, energy systems)
- Accessibility & Safety (DETAILED: stairs, railings, grab bars, safety features)
- Potential & Limitations (MAXIMUM detail: structural constraints, renovation opportunities)

ROOM INFORMATION:
- Listing ID: ${context.listing_id}
- Room ID: ${context.room_id}
- Room Name: ${context.room_name}
- Property: ${context.property_title || 'N/A'}
- Size: ${context.size ? `${context.size} m²` : 'N/A'}


PHOTOS: ${context.photo_urls.length} photos of this room provided as images

${context.photo_visibility_info && context.photo_visibility_info.length > 0 ? `
VISIBILITY MAPPINGS (which other rooms are visible in each photo):
${context.photo_visibility_info.map((info, idx) => {
  const photoIndex = context.photo_urls.indexOf(info.photo_url) + 1;
  if (info.visible_rooms.length > 0) {
    return `- Photo ${photoIndex}: Shows ${info.visible_rooms.join(', ')}`;
  }
  return null;
}).filter(Boolean).join('\n')}

Use this information to understand spatial relationships and adjacencies. When analyzing structural elements, openings, and potential_limitations, consider how this room connects to visible adjacent rooms.
` : ''}

OUTPUT: JSON object with TWO parts (fields must match exactly):

{
  "room_analysis": {
  "room_id": "${context.room_id}",
  "room_name": "${context.room_name}",
  "findings_by_lens": {
    "structural_envelope": "string (optional)",
    "finishes_surfaces": "string (required)",
    "lighting_ventilation": "string (required)",
    "fittings_fixtures": "string (optional)",
    "moisture_hygiene": "string (required)",
    "energy_insulation": "string (optional)",
    "accessibility_safety": "string (optional)",
    "potential_limitations": "string (required)"
  },
  "notable_issues": ["string array - explicit, photo-anchored issues"],
  "overall_room_condition": "poor|fair|good",
  "confidence": "low|medium|high"
  },
  "layout_allocentric": {
    "room_id": "${context.room_id}",
    "room_name": "${context.room_name}",
    "layout_structured": {
      "approx_dimensions": {
        "length_m": number (optional),
        "width_m": number (optional),
        "height_m": number (optional)
      },
      "envelope": {
        "walls": ["string array - e.g. 'north wall with window', 'south wall with door to terrace'"],
        "openings": ["string array - doors, windows, arches with descriptions and approximate positions"]
      },
      "key_surfaces": ["string array - floor type, main wall finishes, ceiling type"],
      "obvious_adjacencies": ["string array - e.g. 'opens to dining via arch', 'connects to terrace'"]
    },
    "layout_narrative": "string - 1-2 paragraphs of expressive, semantic description. Use spatial metaphors ('L-shaped', 'central spine', 'branching off'), material textures ('textured white plaster', 'polished marble'), relational language ('in front of', 'behind', 'to the left'), movement through space ('flows into', 'opens onto'), and professional allocentric (floorplan-view) perspective. This narrative is CRITICAL for LLM semantic understanding - be rich and descriptive."
  }
}

CRITICAL FOR LAYOUT_NARRATIVE:
- Use spatial metaphors: "L-shaped", "long and narrow", "central spine", "branching off"
- Describe materials and textures: "textured white plaster", "polished marble with gray veining", "matte painted ceiling"
- Use relational language: "in front of", "behind", "to the left", "adjacent to"
- Describe movement: "flows into", "opens onto", "connects via"
- Professional allocentric perspective: think floorplan-view, not camera-view
- Be expressive and semantic - LLMs need rich language to avoid misunderstandings

Include notable_issues[], overall_room_condition, confidence in room_analysis.

DETAIL LEVEL GUIDANCE:
- **Structural/Envelope**: MAXIMUM detail - every wall, opening, column, structural element matters for renovation
- **Finishes/Surfaces**: MAXIMUM detail - exact materials, condition, installation quality (these will be replaced/upgraded)
- **Fixtures**: DETAILED for built-ins (cabinetry, plumbing, electrical) - minimal for movable furniture
- **Openings**: MAXIMUM detail - dimensions, materials, condition (critical for renovation planning)
- **Movable Objects**: Brief mention only - these will be removed

Return ONLY valid JSON without additional text or comments.
`;

/**
 * Room Bullets Prompt
 * Purpose: Rewrite each RoomAnalysis into 4–7 buyer-friendly bullets for the Integrated Analysis UI.
 * Tone: supportive realism (credible, enabling, non-salesy)
 */
export const ROOM_BULLETS_PROMPT = (context: {
  room_analyses: RoomAnalysis[];
}) => `
SYSTEM:
Rewrite each RoomAnalysis into 4–7 concise, buyer-facing bullets.
Tone: supportive realism (credible, enabling, non-salesy).
Each bullet ≤ 140 chars where possible.

INPUT ROOM ANALYSES:
${JSON.stringify(context.room_analyses, null, 2)}

OUTPUT: RoomBullets[] JSON (array):
[
  {
    "room_id": "string",
    "room_name": "string",
    "bullets": ["string - 4-7 concise bullets, each ≤140 chars where possible"]
  }
]

Each room should have 4-7 bullets that are:
- Buyer-friendly and concise
- Factual and supportive
- Highlight both positives and areas needing attention
- Use supportive realism tone

Return ONLY valid JSON array without additional text or comments.
`;

