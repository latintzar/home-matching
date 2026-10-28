import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

/**
 * GET /api/cron/process-notes
 * Vercel Cron job to process all unprocessed notes older than 20 minutes
 * Schedule: Every 5 minutes - see vercel.json for cron config
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional, for security)
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // In development, allow without auth
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = await getSupabaseServer();
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    // Get ALL unprocessed notes older than 20 minutes
    const { data: notes, error } = await supabase
      .from("user_notes")
      .select("id, user_id, listing_id, content, created_at")
      .is("processed_at", null)
      .lt("created_at", twentyMinutesAgo)
      .limit(500);

    if (error) {
      console.error("[Cron] Error fetching notes:", error);
      return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
    }

    if (!notes?.length) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No notes to process",
      });
    }

    // Group notes by user
    const byUser: Record<string, typeof notes> = {};
    for (const note of notes) {
      if (!byUser[note.user_id]) {
        byUser[note.user_id] = [];
      }
      byUser[note.user_id].push(note);
    }

    let totalProcessed = 0;
    let totalSignals = 0;

    // Process each user's notes
    for (const [userId, userNotes] of Object.entries(byUser)) {
      try {
        const result = await processUserNotes(userId, userNotes, supabase);
        totalProcessed += result.processed;
        totalSignals += result.signals;
      } catch (userError) {
        console.error(`[Cron] Error processing user ${userId}:`, userError);
      }
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      signals: totalSignals,
      users: Object.keys(byUser).length,
    });

  } catch (error) {
    console.error("[Cron] Notes processing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

interface NoteToProcess {
  id: string;
  user_id: string;
  listing_id: string;
  content: string | null;
  created_at: string;
}

async function processUserNotes(
  userId: string,
  notes: NoteToProcess[],
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>
): Promise<{ processed: number; signals: number }> {
  const signals = [];
  let processed = 0;

  for (const note of notes) {
    try {
      // Extract signals from note content
      const extractedSignals = extractSignalsFromNote(note.content || "");

      // Add signals with proper user/note reference
      for (const signal of extractedSignals) {
        signals.push({
          user_id: userId,
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

      processed++;
    } catch (noteError) {
      console.error(`[Cron] Error processing note ${note.id}:`, noteError);
    }
  }

  // Insert all signals at once
  if (signals.length > 0) {
    await supabase.from("user_preference_signals").insert(signals);
  }

  console.log(`[Cron] Processed ${processed} notes for user ${userId}, extracted ${signals.length} signals`);

  return { processed, signals: signals.length };
}

/**
 * Simple signal extraction (same logic as in /api/notes/process)
 */
function extractSignalsFromNote(content: string): Array<{
  type: "like" | "dislike" | "must_have" | "dealbreaker";
  category: string;
  description: string;
  confidence: number;
}> {
  const signals: Array<{
    type: "like" | "dislike" | "must_have" | "dealbreaker";
    category: string;
    description: string;
    confidence: number;
  }> = [];

  const lowerContent = content.toLowerCase();

  // Positive patterns
  const hasPositive = /me (gusta|encanta)|perfecto|ideal|genial|love|perfect|great/i.test(content);
  const hasMustHave = /necesito|requiero|debe tener|imprescindible|esencial/i.test(content);
  
  // Negative patterns
  const hasDislike = /no me (gusta|convence)|odio|detesto|horrible|hate|dislike|pequeño|oscuro/i.test(content);
  const hasDealbreaker = /nunca|jamás|inaceptable|deal ?breaker/i.test(content);

  // Category keywords
  const categoryMap: Record<string, string[]> = {
    kitchen: ["cocina", "kitchen"],
    bathroom: ["baño", "bathroom"],
    bedroom: ["habitación", "dormitorio", "bedroom"],
    outdoor_space: ["balcón", "terraza", "jardín", "balcony", "terrace"],
    light: ["luz", "luminoso", "light", "oscuro"],
    location: ["zona", "barrio", "ubicación"],
    noise: ["ruido", "tranquilo", "noise"],
    size: ["grande", "pequeño", "amplio", "espacioso"],
  };

  let category = "general";
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => lowerContent.includes(k))) {
      category = cat;
      break;
    }
  }

  // Determine signal type
  let signalType: "like" | "dislike" | "must_have" | "dealbreaker" | null = null;
  
  if (hasDealbreaker) signalType = "dealbreaker";
  else if (hasMustHave) signalType = "must_have";
  else if (hasDislike) signalType = "dislike";
  else if (hasPositive) signalType = "like";

  if (signalType) {
    signals.push({
      type: signalType,
      category,
      description: content.slice(0, 100),
      confidence: 0.7,
    });
  }

  return signals;
}

