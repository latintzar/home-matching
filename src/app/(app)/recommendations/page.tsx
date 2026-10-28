import { Metadata } from "next";
import { getSupabaseServer, getServerUser } from "@/lib/supabase-server";
import { RecommendationsContent } from "./RecommendationsContent";

export const metadata: Metadata = {
  title: "Recomendaciones | Leo.casa",
  description: "Propiedades recomendadas por Leo",
};

export default async function RecommendationsPage() {
  const user = await getServerUser();
  const supabase = await getSupabaseServer();

  // Fetch listings with real data
  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, price_eur, sqm, bedrooms, bathrooms, address, city, source_url, housing_situation")
    .gt("price_eur", 0)
    .neq("city", "-")
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch photos for these listings
  const listingIds = listings?.map(l => l.id) || [];
  const { data: photos } = listingIds.length > 0 
    ? await supabase
        .from("listing_photos")
        .select("listing_id, url")
        .in("listing_id", listingIds)
        .eq("is_primary", true)
    : { data: [] };

  // Merge photos into listings
  const listingsWithPhotos = listings?.map(listing => ({
    ...listing,
    photo: photos?.find(p => p.listing_id === listing.id)?.url || null,
  })) || [];

  return (
    <RecommendationsContent
      listings={listingsWithPhotos}
    />
  );
}

