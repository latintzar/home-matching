import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getSupabaseServer } from "@/lib/supabase-server";
import { SavedPropertiesContent } from "./SavedPropertiesContent";

export const metadata: Metadata = {
  title: "Guardados | Leo.casa",
  description: "Tus propiedades guardadas",
};

export default async function SavedPropertiesPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServer();

  // Fetch saved properties with listing details
  const { data: savedProperties } = await supabase
    .from("saved_properties")
    .select(`
      id,
      created_at,
      notes,
      listing_id,
      listings (
        id,
        title,
        price_eur,
        sqm,
        bedrooms,
        bathrooms,
        address,
        city,
        source_url
      )
    `)
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  // Get listing IDs for photos
  const listingIds = savedProperties?.map(sp => sp.listing_id).filter(Boolean) || [];
  
  // Fetch photos
  const { data: photos } = listingIds.length > 0 
    ? await supabase
        .from("listing_photos")
        .select("listing_id, url")
        .in("listing_id", listingIds)
        .eq("is_primary", true)
    : { data: [] };

  // Merge photos into saved properties and normalize listings (Supabase may return array)
  const savedWithPhotos = savedProperties?.map(sp => {
    // Supabase join can return array or single object depending on relationship
    const rawListings = sp.listings as unknown;
    const listings = Array.isArray(rawListings) ? rawListings[0] : rawListings;
    return {
      ...sp,
      listings: listings || null,
      photo: photos?.find(p => p.listing_id === sp.listing_id)?.url || null,
    };
  }) || [];

  return (
    <SavedPropertiesContent
      savedProperties={savedWithPhotos as any}
      userId={user?.id || null}
    />
  );
}

