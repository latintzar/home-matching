import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET /api/viewings?listingId=xxx - Check if listing has been viewed
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listingId");

    const supabase = await getSupabaseServer();

    if (listingId) {
      const { data, error } = await supabase
        .from("user_viewings")
        .select("*")
        .eq("user_id", user.id)
        .eq("listing_id", listingId)
        .maybeSingle();

      if (error) {
        console.error("Error checking viewing status:", error);
        return NextResponse.json({ error: "Failed to check viewing status" }, { status: 500 });
      }

      return NextResponse.json({ viewing: data, hasViewed: !!data });
    } else {
      // Get all viewings
      const { data: viewings, error } = await supabase
        .from("user_viewings")
        .select("*")
        .eq("user_id", user.id)
        .order("viewed_at", { ascending: false });

      if (error) {
        console.error("Error fetching viewings:", error);
        return NextResponse.json({ error: "Failed to fetch viewings" }, { status: 500 });
      }

      return NextResponse.json({ viewings });
    }
  } catch (error) {
    console.error("Viewings GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/viewings - Mark a property as viewed
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { listingId, notes } = body;

    if (!listingId) {
      return NextResponse.json({ error: "listingId required" }, { status: 400 });
    }

    const supabase = await getSupabaseServer();
    
    // Check if already viewed
    const { data: existing } = await supabase
      .from("user_viewings")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .maybeSingle();

    if (existing) {
      // Update the viewing with new notes if provided
      if (notes) {
        await supabase
          .from("user_viewings")
          .update({ notes })
          .eq("id", existing.id);
      }
      return NextResponse.json({ message: "Already marked as viewed", hasViewed: true });
    }

    const { data: viewing, error } = await supabase
      .from("user_viewings")
      .insert({
        user_id: user.id,
        listing_id: listingId,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error marking viewing:", error);
      return NextResponse.json({ error: "Failed to mark as viewed" }, { status: 500 });
    }

    return NextResponse.json({ viewing, hasViewed: true });
  } catch (error) {
    console.error("Viewings POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

