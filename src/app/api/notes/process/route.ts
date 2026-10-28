import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * POST /api/notes/process
 * Process notes and extract preference signals using AI
 * 
 * Can be called:
 * 1. Directly with noteIds (on-demand after user finishes typing)
 * 2. Without noteIds to process all unprocessed notes for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { noteIds } = body;

    const supabase = await getSupabaseServer();

    // Get notes to process
    let query = supabase
      .from("user_notes")
      .select("*")
      .eq("user_id", user.id)
      .is("processed_at", null);

    if (noteIds?.length) {
      query = query.in("id", noteIds);
    }

    const { data: notes, error } = await query.order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching notes:", error);
      return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
    }

    if (!notes?.length) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No notes to process",
      });
    }

    // Process notes with AI
    const processedNotes = [];
    const signals = [];

    for (const note of notes) {
      try {
        // Extract preference signals from note content
        const extractedSignals = await extractSignalsFromNote(note.content || "");

        // Store extracted signals
        for (const signal of extractedSignals) {
          signals.push({
            user_id: user.id,
            source_type: "note",
            source_id: note.id,
            signal_type: signal.type,
            category: signal.category,
            description: signal.description,
            confidence: signal.confidence,
          });
        }

        // Mark note as processed
        await supabase
          .from("user_notes")
          .update({
            processed_at: new Date().toISOString(),
            extracted_signals: extractedSignals,
          })
          .eq("id", note.id);

        processedNotes.push({
          id: note.id,
          signalsExtracted: extractedSignals.length,
        });

      } catch (noteError) {
        console.error(`Error processing note ${note.id}:`, noteError);
      }
    }

    // Insert all signals
    if (signals.length > 0) {
      await supabase.from("user_preference_signals").insert(signals);
    }

    // Trigger fit score recalculation for user's saved properties
    // (This could be done async via a queue in production)
    await recalculateFitScores(user.id, supabase);

    return NextResponse.json({
      success: true,
      processed: processedNotes.length,
      signalsExtracted: signals.length,
      notes: processedNotes,
    });

  } catch (error) {
    console.error("Notes process error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Extract preference signals from note content
 * Uses simple keyword matching for now - can be upgraded to AI later
 */
async function extractSignalsFromNote(content: string): Promise<Array<{
  type: "like" | "dislike" | "must_have" | "dealbreaker";
  category: string;
  description: string;
  confidence: number;
}>> {
  const signals: Array<{
    type: "like" | "dislike" | "must_have" | "dealbreaker";
    category: string;
    description: string;
    confidence: number;
  }> = [];

  const lowerContent = content.toLowerCase();

  // Positive indicators
  const likePatterns = [
    { pattern: /me (gusta|encanta|fascina)/gi, type: "like" as const },
    { pattern: /perfecto|ideal|genial|impresionante/gi, type: "like" as const },
    { pattern: /love|perfect|great|amazing/gi, type: "like" as const },
    { pattern: /lo mejor|punto fuerte/gi, type: "like" as const },
    { pattern: /necesito|requiero|debe tener/gi, type: "must_have" as const },
    { pattern: /imprescindible|esencial/gi, type: "must_have" as const },
  ];

  // Negative indicators  
  const dislikePatterns = [
    { pattern: /no me (gusta|convence)/gi, type: "dislike" as const },
    { pattern: /odio|detesto|horrible/gi, type: "dislike" as const },
    { pattern: /pequeño|pequeña|estrecho|oscuro/gi, type: "dislike" as const },
    { pattern: /hate|dislike|awful|terrible/gi, type: "dislike" as const },
    { pattern: /ruido|ruidoso|molesto/gi, type: "dislike" as const },
    { pattern: /nunca|jamás|inaceptable/gi, type: "dealbreaker" as const },
    { pattern: /sin.*no|must have|deal ?breaker/gi, type: "dealbreaker" as const },
  ];

  // Category detection
  const categories: Record<string, string[]> = {
    kitchen: ["cocina", "kitchen", "encimera", "fregadero", "horno"],
    bathroom: ["baño", "bathroom", "ducha", "bañera", "aseo"],
    bedroom: ["habitación", "dormitorio", "bedroom", "cuarto"],
    living_room: ["salón", "living", "sala", "comedor"],
    outdoor_space: ["balcón", "terraza", "jardín", "patio", "balcony", "terrace"],
    light: ["luz", "luminoso", "light", "bright", "oscuro", "dark"],
    location: ["zona", "barrio", "ubicación", "location", "neighborhood"],
    noise: ["ruido", "tranquilo", "noise", "quiet", "silencioso"],
    flooring: ["suelo", "floor", "parquet", "tarima", "baldosa"],
    storage: ["armarios", "almacenaje", "storage", "closet"],
    size: ["grande", "pequeño", "amplio", "espacioso", "estrecho"],
    transport: ["metro", "bus", "transporte", "cercanías"],
    parking: ["parking", "garaje", "aparcamiento"],
  };

  // Find category from content
  const findCategory = (text: string): string => {
    for (const [category, keywords] of Object.entries(categories)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return category;
        }
      }
    }
    return "general";
  };

  // Process positive patterns
  for (const { pattern, type } of likePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      signals.push({
        type,
        category: findCategory(lowerContent),
        description: content.slice(0, 100),
        confidence: 0.7,
      });
      break; // Only one signal per note for simple analysis
    }
  }

  // Process negative patterns if no positive found
  if (signals.length === 0) {
    for (const { pattern, type } of dislikePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        signals.push({
          type,
          category: findCategory(lowerContent),
          description: content.slice(0, 100),
          confidence: 0.7,
        });
        break;
      }
    }
  }

  return signals;
}

/**
 * Recalculate fit scores for user's saved properties
 * This is a placeholder - implement actual fit score logic based on your algorithm
 */
async function recalculateFitScores(userId: string, supabase: Awaited<ReturnType<typeof getSupabaseServer>>) {
  // Get user's saved properties
  const { data: savedProperties } = await supabase
    .from("user_saved_properties")
    .select("listing_id")
    .eq("user_id", userId);

  if (!savedProperties?.length) return;

  // Get user's preference signals
  const { data: signals } = await supabase
    .from("user_preference_signals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // In a real implementation, you would:
  // 1. Fetch property details for each saved property
  // 2. Compare against preference signals
  // 3. Calculate and store new fit scores
  
  console.log(`[FitScore] Would recalculate scores for ${savedProperties.length} properties based on ${signals?.length || 0} signals`);
}

