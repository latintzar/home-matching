import {sampleMode} from '@/lib/sample/server';
import {sampleRecommendations} from '@/lib/sample/recommend';
import {rowToProfile} from '@/lib/recommender/profileStorage';
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

  const {data:account}=await supabase.from('user_profiles').select('active_profile_type').eq('id',user?.id).single();
  const {data:profile}=await supabase.from('user_lifestyle_profiles').select('*').eq('user_id',user?.id).eq('profile_type',account?.active_profile_type||'renter').single();
  const fits=sampleMode()&&profile?Object.fromEntries(sampleRecommendations(rowToProfile(profile)).results.listings.map(item=>[item.listing.listing_id,item.fitScore])):{};

  // Merge photos into listings
  const listingsWithPhotos = listings?.map(listing => ({
    ...listing,
    fitScore:fits[listing.id],
    photo: photos?.find(p => p.listing_id === listing.id)?.url || null,
  })) || [];

  return (
    <RecommendationsContent
      listings={listingsWithPhotos}
    />
  );
}

