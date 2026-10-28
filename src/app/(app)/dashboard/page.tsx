import {sampleMode} from '@/lib/sample/server';
import {sampleRecommendations} from '@/lib/sample/recommend';
import {rowToProfile} from '@/lib/recommender/profileStorage';
import { Metadata } from "next";
import { getSupabaseServer, getServerUser } from "@/lib/supabase-server";
import { DashboardContent } from "./DashboardContent";

export const metadata: Metadata = {
  title: "Mis Propiedades | Leo.casa",
  description: "Tus propiedades recomendadas y guardadas",
};

export default async function DashboardPage() {
  const user = await getServerUser();
  const supabase = await getSupabaseServer();

  // Fetch user's active profile type (default to 'renter')
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("active_profile_type")
    .eq("id", user?.id)
    .single();
  
  const activeProfileType = (userProfile?.active_profile_type as 'renter' | 'buyer') || 'renter';

  // Fetch user's lifestyle profile for active profile type
  const { data: profile } = await supabase
    .from("user_lifestyle_profiles")
    .select("*")
    .eq("user_id", user?.id)
    .eq("profile_type", activeProfileType)
    .single();

  // Fetch recommended listings (price > 0, valid city)
  const { data: recommendedListings } = await supabase
    .from("listings")
    .select("id, title, price_eur, sqm, bedrooms, bathrooms, address, city, source_url")
    .gt("price_eur", 0)
    .neq("city", "-")
    .order("created_at", { ascending: false })
    .limit(6);

  // Fetch user's saved properties with listing details (for active profile type)
  const { data: savedProperties } = await supabase
    .from("saved_properties")
    .select(`
      id,
      listing_id,
      profile_type,
      listings:listing_id (
        id, title, price_eur, sqm, bedrooms, bathrooms, address, city, source_url
      )
    `)
    .eq("user_id", user?.id)
    .eq("profile_type", activeProfileType)
    .order("created_at", { ascending: false })
    .limit(6);

  // Fetch user's viewed properties (for active profile type)
  const { data: viewedProperties } = await supabase
    .from("property_views")
    .select("listing_id, viewing_completed")
    .eq("user_id", user?.id)
    .eq("profile_type", activeProfileType);

  // Create a set of viewed listing IDs
  const viewedListingIds = new Set(
    viewedProperties?.filter(v => v.viewing_completed).map(v => v.listing_id) || []
  );

  // Get all listing IDs for photo fetch
  const recommendedIds = recommendedListings?.map(l => l.id) || [];
  // Handle Supabase join type - could be object or array depending on query result
  const savedIds = savedProperties?.map(s => {
    const listing = s.listings as unknown as { id: string } | { id: string }[] | null;
    if (!listing) return null;
    if (Array.isArray(listing)) return listing[0]?.id;
    return listing.id;
  }).filter(Boolean) as string[] || [];
  const allListingIds = [...new Set([...recommendedIds, ...savedIds])];

  // Fetch photos for all listings
  const { data: photos } = allListingIds.length > 0 
    ? await supabase
        .from("listing_photos")
        .select("listing_id, url")
        .in("listing_id", allListingIds)
        .eq("is_primary", true)
    : { data: [] };

  const sampleFits=sampleMode()&&profile ? Object.fromEntries(sampleRecommendations(rowToProfile(profile)).results.listings.map(item=>[item.listing.listing_id,item.fitScore])) : {};

  // Merge photos and viewed status into recommended listings
  const recommendedWithPhotos = recommendedListings?.map(listing => ({
    ...listing,
    fitScore:sampleFits[listing.id],
    photo: photos?.find(p => p.listing_id === listing.id)?.url || null,
    viewed: viewedListingIds.has(listing.id),
  })) || [];

  // Merge photos and viewed status into saved listings
  // Handle Supabase join type - could be object or array depending on query result
  const savedWithPhotos = savedProperties?.map(saved => {
    const rawListing = saved.listings as unknown;
    const listing = Array.isArray(rawListing) ? rawListing[0] as Record<string, unknown> : rawListing as Record<string, unknown> | null;
    if (!listing) return null;
    return {
      id: listing.id as string,
      title: listing.title as string,
      price_eur: listing.price_eur as string,
      sqm: listing.sqm as number | null,
      bedrooms: listing.bedrooms as number,
      bathrooms: listing.bathrooms as string,
      address: listing.address as string,
      city: listing.city as string,
      source_url: listing.source_url as string,
      photo: photos?.find(p => p.listing_id === listing.id)?.url || null,
      viewed: viewedListingIds.has(listing.id as string),
      fitScore:sampleFits[listing.id as string],
    };
  }).filter(Boolean) || [];

  return (
    <DashboardContent
      user={user}
      profile={profile}
      activeProfileType={activeProfileType}
      recommendedListings={recommendedWithPhotos}
      savedListings={savedWithPhotos as typeof recommendedWithPhotos}
    />
  );
}
