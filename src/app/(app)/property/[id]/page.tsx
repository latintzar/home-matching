import {sampleMode} from '@/lib/sample/server';
import {sampleRecommendations} from '@/lib/sample/recommend';
import {rowToProfile} from '@/lib/recommender/profileStorage';
import { Metadata } from "next";
import { getCurrentUser, isDevBypassActive } from "@/lib/auth-helpers";
import { getSupabaseServer } from "@/lib/supabase-server";
import { LeanPropertyContent } from "./LeanPropertyContent";
import { notFound } from "next/navigation";

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  
  const { data: listing } = await supabase
    .from("listings")
    .select("title, city")
    .eq("id", id)
    .single();

  return {
    title: listing?.title || "Propiedad | Leo.casa",
    description: listing ? `${listing.title} en ${listing.city}` : "Detalles de la propiedad",
  };
}

export default async function PropertyPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await getSupabaseServer();

  // Fetch listing data
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single();

  if (listingError || !listing) {
    notFound();
  }

  // Fetch listing photos
  const { data: photos } = await supabase
    .from("listing_photos")
    .select("id, url, caption, display_order")
    .eq("listing_id", id)
    .order("display_order");

  // Fetch user's saved status for this property
  const { data: savedProperty } = user ? await supabase
    .from("saved_properties")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", id)
    .single() : { data: null };

  // Fetch user's notes for this property
  const { data: notes } = user ? await supabase
    .from("property_notes")
    .select("*")
    .eq("user_id", user.id)
    .eq("listing_id", id)
    .order("created_at", { ascending: false }) : { data: [] };

  // Fetch property view record
  const { data: viewRecord } = user ? await supabase
    .from("property_views")
    .select("*")
    .eq("user_id", user.id)
    .eq("listing_id", id)
    .single() : { data: null };

  // Create view record if doesn't exist
  if (user && !viewRecord) {
    await supabase
      .from("property_views")
      .insert({
        user_id: user.id,
        listing_id: id,
      });
  }

  const {data:account}=await supabase.from('user_profiles').select('active_profile_type').eq('id',user?.id).single();
  const {data:lifestyleProfile}=await supabase.from('user_lifestyle_profiles').select('*').eq('user_id',user?.id).eq('profile_type',account?.active_profile_type||'renter').single();
  const fit=sampleMode()&&lifestyleProfile?sampleRecommendations(rowToProfile(lifestyleProfile)).results.listings.find(item=>item.listing.listing_id===id):undefined;

  // Get agent info if available
  let agent = null;
  if (listing.agent_id) {
    const { data: agentData } = await supabase
      .from("agents")
      .select("name, logo_url, whatsapp")
      .eq("id", listing.agent_id)
      .single();
    agent = agentData;
  }

  return (
    <LeanPropertyContent
      listing={listing}
      fit={fit}
      photos={photos || []}
      isSaved={!!savedProperty}
      savedId={savedProperty?.id || null}
      notes={notes || []}
      viewRecord={viewRecord}
      agent={agent}
      userId={user?.id || null}
    />
  );
}

