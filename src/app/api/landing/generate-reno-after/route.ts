import { NextRequest, NextResponse } from 'next/server';
import { callGeminiRest, GeminiImageInput } from '@/lib/gemini-rest-client';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for image generation

/**
 * Renovation After Image Generator
 * 
 * Generates "after" renovation images by feeding the "before" image to Gemini
 * This ensures the exact same camera angle and room structure
 * 
 * POST /api/landing/generate-reno-after
 * Body: { 
 *   beforeImageId: string,  // e.g., 'reno-before-living'
 *   tier: 'estandar' | 'optimo' | 'plus'
 * }
 */

interface TierPrompt {
  tier: 'estandar' | 'optimo' | 'plus';
  roomType: 'living' | 'kitchen' | 'bathroom';
  filename: string;
  prompt: string;
}

const TIER_PROMPTS: TierPrompt[] = [
  // ESTÁNDAR TIER - Living Room
  {
    tier: 'estandar',
    roomType: 'living',
    filename: 'reno-after-living-estandar.png',
    prompt: `Edit this photo according to the renovation instructions below.

INPUT IMAGE:
- Room: Living Room
- This is the BEFORE photo you are editing - a dated 1980s Spanish apartment living room

RENOVATION INSTRUCTIONS - "Estándar" tier (€8k-€12k budget):
Apply these cosmetic updates while keeping the same furniture:

1. WALLS: Fresh bright white paint (covering the yellowed walls)
2. CEILING: Remove popcorn texture, fresh white paint, new simple LED ceiling light
3. FLOOR: SAME parquet flooring but professionally refinished and polished
4. WINDOWS: SAME frames but cleaned, new simple white curtains
5. ELECTRICAL: New modern white outlets and switches
6. FURNITURE: Keep SAME items but refreshed - sofa with clean slipcover, polished coffee table
7. ACCESSORIES: Remove clutter, add one simple plant

CRITICAL - CAMERA-LOCKED EDIT CONSTRAINTS:
- The output MUST match the INPUT IMAGE's camera angle, perspective, viewpoint, zoom level, and framing EXACTLY
- Camera invariants: position, angle, focal length, framing unchanged; vanishing points preserved
- Geometry invariants: room envelope edges and plane intersections stay pixel-stationary
- Preserve the exact room geometry, structural elements, spatial relationships, and proportions
- Keep the same lighting direction as the INPUT IMAGE
- Operation whitelist: material/texture substitution, color/finish changes, surface cleaning
- Operation blacklist: moving furniture, changing room layout, adding new 3D mass

Output a photorealistic edited image that looks like a real photograph taken from the EXACT same camera position as the INPUT IMAGE.`
  },
  
  // ÓPTIMO TIER - Kitchen
  {
    tier: 'optimo',
    roomType: 'kitchen',
    filename: 'reno-after-kitchen-optimo.png',
    prompt: `Edit this photo according to the renovation instructions below.

INPUT IMAGE:
- Room: Kitchen
- This is the BEFORE photo you are editing - a dated 1980s Spanish apartment kitchen

RENOVATION INSTRUCTIONS - "Óptimo" tier (€17k-€23k budget):
Apply these significant upgrades while maintaining the same layout:

1. CABINETS: Replace with NEW modern flat-panel cabinets in light gray or white, SAME layout positions
2. COUNTERTOPS: NEW white quartz or solid surface countertops
3. BACKSPLASH: NEW large format white subway tiles
4. APPLIANCES: NEW modern stainless steel appliances (fridge, stove, hood) in SAME positions
5. SINK: NEW modern stainless steel sink with chrome faucet in SAME position
6. FLOOR: NEW large format ceramic tiles in light gray
7. LIGHTING: NEW recessed LED spotlights
8. WINDOW: SAME position, new modern white frame

CRITICAL - CAMERA-LOCKED EDIT CONSTRAINTS:
- The output MUST match the INPUT IMAGE's camera angle, perspective, viewpoint, zoom level, and framing EXACTLY
- Camera invariants: position, angle, focal length, framing unchanged; vanishing points preserved
- Geometry invariants: room envelope edges and plane intersections stay pixel-stationary; opening extents preserved
- Preserve the exact room geometry, structural elements, spatial relationships, and proportions
- Keep the same lighting direction as the INPUT IMAGE
- Operation whitelist: cabinet replacement within existing bounds, surface substitution, appliance upgrade in place
- Operation blacklist: moving walls, changing window position, extending room, global relight

Output a photorealistic edited image that looks like a real photograph taken from the EXACT same camera position as the INPUT IMAGE.`
  },
  
  // PLUS TIER - Bathroom
  {
    tier: 'plus',
    roomType: 'bathroom',
    filename: 'reno-after-bathroom-plus.png',
    prompt: `Edit this photo according to the renovation instructions below.

INPUT IMAGE:
- Room: Bathroom
- This is the BEFORE photo you are editing - a dated 1980s Spanish apartment bathroom

RENOVATION INSTRUCTIONS - "Plus" tier (€35k-€45k budget):
Apply these premium transformations while maintaining the same room envelope:

1. WALLS: Large format porcelain tiles in warm neutral (full height)
2. FLOOR: Matching large format tiles
3. BATHTUB AREA: Replace with walk-in rain shower with black-framed glass enclosure in SAME position
4. TOILET: NEW wall-hung toilet (concealed cistern) in SAME position
5. SINK: NEW floating vanity with integrated basin, warm wood finish, in SAME position
6. MIRROR: Large frameless mirror with integrated LED lighting
7. FIXTURES: Premium matte black fixtures throughout
8. WINDOW: SAME position, frosted glass

CRITICAL - CAMERA-LOCKED EDIT CONSTRAINTS:
- The output MUST match the INPUT IMAGE's camera angle, perspective, viewpoint, zoom level, and framing EXACTLY
- Camera invariants: position, angle, focal length, framing unchanged; vanishing points preserved
- Geometry invariants: room envelope edges and plane intersections stay pixel-stationary; opening extents preserved
- Preserve the exact room geometry, structural elements, spatial relationships, and proportions
- Keep the same lighting direction as the INPUT IMAGE
- Operation whitelist: fixture replacement within existing bounds, surface substitution, material upgrade
- Operation blacklist: moving walls, changing window position, extending room, global relight

Output a photorealistic edited image that looks like a real photograph taken from the EXACT same camera position as the INPUT IMAGE.`
  }
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { beforeImageId, tier } = body;

    if (!beforeImageId || !tier) {
      return NextResponse.json(
        { error: 'Missing required fields: beforeImageId and tier' },
        { status: 400 }
      );
    }

    // Map beforeImageId to room type
    const roomTypeMap: Record<string, 'living' | 'kitchen' | 'bathroom'> = {
      'reno-before-living': 'living',
      'reno-before-kitchen': 'kitchen',
      'reno-before-bathroom': 'bathroom'
    };

    const roomType = roomTypeMap[beforeImageId];
    if (!roomType) {
      return NextResponse.json(
        { error: `Invalid beforeImageId: ${beforeImageId}` },
        { status: 400 }
      );
    }

    // Find the matching tier prompt
    const tierPrompt = TIER_PROMPTS.find(
      p => p.tier === tier && p.roomType === roomType
    );

    if (!tierPrompt) {
      return NextResponse.json(
        { error: `No prompt found for tier=${tier} and room=${roomType}` },
        { status: 400 }
      );
    }

    // Load the before image
    const publicDir = path.join(process.cwd(), 'public', 'images', 'landing');
    
    // Try both .webp and .png
    let beforeImagePath = path.join(publicDir, `${beforeImageId}.webp`);
    if (!fs.existsSync(beforeImagePath)) {
      beforeImagePath = path.join(publicDir, `${beforeImageId}.png`);
    }

    if (!fs.existsSync(beforeImagePath)) {
      return NextResponse.json(
        { error: `Before image not found: ${beforeImageId}` },
        { status: 404 }
      );
    }

    // Read and encode the before image
    const beforeImageBuffer = fs.readFileSync(beforeImagePath);
    const beforeImageBase64 = beforeImageBuffer.toString('base64');
    const mimeType = beforeImagePath.endsWith('.webp') ? 'image/webp' : 'image/png';

    console.log(`[generate-reno-after] Generating ${tier} tier for ${roomType}`);
    console.log(`[generate-reno-after] Using before image: ${beforeImagePath}`);

    // Call Gemini with the before image - using EXACT same config as R3 renovation pipeline
    const response = await callGeminiRest(tierPrompt.prompt, {
      model: 'gemini-3-pro-image-preview', // Same model as R3 pipeline
      generateImages: true,
      responseModalities: ['IMAGE'], // IMAGE only, like R3
      temperature: 1, // Same as R3
      topP: 0.95, // Same as R3
      maxOutputTokens: 32768, // Same as R3
      images: [{
        mimeType: mimeType as GeminiImageInput['mimeType'],
        data: beforeImageBase64
      }],
      imageConfig: {
        aspectRatio: '16:9',
        imageSize: '4K', // Same as R3
        imageOutputOptions: {
          mimeType: 'image/png'
        },
        personGeneration: 'ALLOW_ALL' // Same as R3
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
      ]
    });

    if (!response.success || !response.images || response.images.length === 0) {
      console.error(`[generate-reno-after] Failed:`, response.error);
      return NextResponse.json(
        { 
          error: 'Image generation failed',
          details: response.error,
          rawResponse: response.rawResponse
        },
        { status: 500 }
      );
    }

    // Save the generated image
    const outputFilename = tierPrompt.filename;
    const outputPath = path.join(publicDir, outputFilename);
    
    const imageData = response.images[0].data;
    const imageBuffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(outputPath, imageBuffer);

    console.log(`[generate-reno-after] Saved: ${outputPath}`);

    return NextResponse.json({
      success: true,
      tier,
      roomType,
      filename: outputFilename,
      path: `/images/landing/${outputFilename}`,
      model: response.model
    });

  } catch (error) {
    console.error('[generate-reno-after] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

