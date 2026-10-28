import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * Helper to get user's active profile type
 */
async function getActiveProfileType(supabase: Awaited<ReturnType<typeof getSupabaseServer>>, userId: string): Promise<'renter' | 'buyer'> {
  const { data } = await supabase
    .from("user_profiles")
    .select("active_profile_type")
    .eq("id", userId)
    .single();
  return (data?.active_profile_type as 'renter' | 'buyer') || 'renter';
}

// GET /api/notes?listingId=xxx - Get notes for a listing
// Optional: ?profileType=renter|buyer - Override profile type
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");
    const profileTypeParam = searchParams.get("profileType") as 'renter' | 'buyer' | null;

    if (!listingId) {
      return NextResponse.json({ error: "listingId required" }, { status: 400 });
    }

    const supabase = await getSupabaseServer();
    
    // Get active profile type (or use param override)
    const profileType = profileTypeParam || await getActiveProfileType(supabase, user.id);
    
    const { data: notes, error } = await supabase
      .from("property_notes")
      .select("*")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .eq("profile_type", profileType)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes:", error);
      return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
    }

    return NextResponse.json({ notes, profileType });
  } catch (error) {
    console.error("Notes GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/notes - Create a new note
// Body: { listingId, content, noteType?, mediaUrl?, profileType? }
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { listingId, content, noteType = "text", mediaUrl, profileType: profileTypeParam } = body;

    if (!listingId || !content) {
      return NextResponse.json({ error: "listingId and content required" }, { status: 400 });
    }

    const supabase = await getSupabaseServer();
    
    // Get active profile type (or use param override)
    const profileType = profileTypeParam || await getActiveProfileType(supabase, user.id);
    
    const { data: note, error } = await supabase
      .from("property_notes")
      .insert({
        user_id: user.id,
        listing_id: listingId,
        content,
        note_type: noteType,
        media_url: mediaUrl || null,
        profile_type: profileType,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating note:", error);
      return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
    }

    return NextResponse.json({ note, profileType });
  } catch (error) {
    console.error("Notes POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/notes?id=xxx - Delete a note
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("id");

    if (!noteId) {
      return NextResponse.json({ error: "note id required" }, { status: 400 });
    }

    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from("property_notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", user.id); // Ensure user owns the note

    if (error) {
      console.error("Error deleting note:", error);
      return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notes DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

