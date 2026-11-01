import { getCurrentUser } from '@/lib/auth-helpers';
/**
 * Analytics API Route
 * 
 * Receives analytics events from the client and stores them in Supabase
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "Sign in to record this event." }, { status: 401 });
    const body = await request.json();
    const { event, properties, timestamp, session_id } = body;

    if (!event) {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Insert event
    const { error } = await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_name: event,
      properties: properties || {},
      session_id: session_id,
      page_url: request.headers.get("referer"),
      user_agent: request.headers.get("user-agent"),
      created_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    });

    if (error) {
      console.error("Analytics insert error:", error);
      return NextResponse.json(
        { error: "Failed to track event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check analytics status
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Analytics endpoint is running",
  });
}

