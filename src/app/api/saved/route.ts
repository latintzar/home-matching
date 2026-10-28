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

// GET /api/saved - Get all saved properties for user
// GET /api/saved?listingId=xxx - Check if specific listing is saved
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

    const supabase = await getSupabaseServer();
    
    // Get active profile type (or use param override)
    const profileType = profileTypeParam || await getActiveProfileType(supabase, user.id);

    if (listingId) {
      // Check if specific listing is saved for this profile type
      const { data, error } = await supabase
        .from("saved_properties")
        .select("id")
        .eq("user_id", user.id)
        .eq("listing_id", listingId)
        .eq("profile_type", profileType)
        .maybeSingle();

      if (error) {
        console.error("Error checking saved status:", error);
        return NextResponse.json({ error: "Failed to check saved status" }, { status: 500 });
      }

      return NextResponse.json({ isSaved: !!data, profileType });
    } else {
      // Get all saved properties for this profile type
      const { data: saved, error } = await supabase
        .from("saved_properties")
        .select("*")
        .eq("user_id", user.id)
        .eq("profile_type", profileType)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching saved properties:", error);
        return NextResponse.json({ error: "Failed to fetch saved properties" }, { status: 500 });
      }

      return NextResponse.json({ saved, profileType });
    }
  } catch (error) {
    console.error("Saved GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/saved - Save a property (like)
// Body: { listingId, profileType? }
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { listingId, profileType: profileTypeParam } = body;

    if (!listingId) {
      return NextResponse.json({ error: "listingId required" }, { status: 400 });
    }

    const supabase = await getSupabaseServer();
    
    // Get active profile type (or use param override)
    const profileType = profileTypeParam || await getActiveProfileType(supabase, user.id);
    
    // Check if already saved for this profile type
    const { data: existing } = await supabase
      .from("saved_properties")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .eq("profile_type", profileType)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: "Already saved", isSaved: true, profileType });
    }

    const { data: saved, error } = await supabase
      .from("saved_properties")
      .insert({
        user_id: user.id,
        listing_id: listingId,
        profile_type: profileType,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving property:", error);
      return NextResponse.json({ error: "Failed to save property" }, { status: 500 });
    }

    return NextResponse.json({ saved, isSaved: true, profileType });
  } catch (error) {
    console.error("Saved POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/saved?listingId=xxx - Unsave a property (unlike)
// Optional: ?profileType=renter|buyer - Override profile type
export async function DELETE(request: NextRequest) {
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
    
    const { error } = await supabase
      .from("saved_properties")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .eq("profile_type", profileType);

    if (error) {
      console.error("Error unsaving property:", error);
      return NextResponse.json({ error: "Failed to unsave property" }, { status: 500 });
    }

    return NextResponse.json({ success: true, isSaved: false, profileType });
  } catch (error) {
    console.error("Saved DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

