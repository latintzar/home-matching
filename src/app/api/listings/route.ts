import { NextResponse } from "next/server";
import { getListings, getDataSource } from "@/lib/data-adapter";

export async function GET(request: Request) {
  try {
    // Parse query params
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const city = url.searchParams.get('city') || undefined;
    
    // Use data adapter (switches between Supabase/DynamoDB based on USE_DYNAMODB env)
    const listings = await getListings({ limit, city });

    return NextResponse.json({ 
      success: true, 
      listings: listings.map(l => ({
        id: l.id,
        title: l.title,
        price_eur: l.price_eur,
        created_at: l.created_at,
      })),
      count: listings.length,
      _source: getDataSource(), // For debugging
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 }
    );
  }
}