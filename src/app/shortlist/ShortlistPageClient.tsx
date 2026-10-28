"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, Calendar, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { PropertyCard, PropertyCardSkeleton } from "@/components/property/PropertyCard";
import { trackPageView } from "@/lib/analytics";

interface ShortlistPageClientProps {
  userId: string;
}

interface ViewingWithListing {
  id: string;
  listing_id: string;
  status: string;
  created_at: string;
  scheduled_at?: string;
  listing?: {
    id: string;
    title: string;
    address: string;
    city: string;
    neighborhood: string;
    price_eur: number;
    bedrooms: number;
    bathrooms: number;
    sqm: number;
    photo_urls?: string[];
  };
}

export function ShortlistPageClient({ userId }: ShortlistPageClientProps) {
  const router = useRouter();
  const [viewings, setViewings] = useState<ViewingWithListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    trackPageView("shortlist");
    loadViewings();
  }, []);

  const loadViewings = async () => {
    const supabase = getSupabaseBrowser();
    
    // Get all viewings for user
    const { data, error } = await supabase
      .from("viewings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading viewings:", error);
      setIsLoading(false);
      return;
    }

    // Fetch listing data for each viewing
    const viewingsWithListings: ViewingWithListing[] = [];
    
    for (const viewing of data || []) {
      try {
        // Try to get listing from Supabase
        const { data: listing } = await supabase
          .from("listings")
          .select("id, title, address, city, neighborhood, price_eur, bedrooms, bathrooms, sqm, photo_urls:scraped_data->photo_urls")
          .eq("id", viewing.listing_id)
          .single();
        
        viewingsWithListings.push({
          ...viewing,
          listing: listing as ViewingWithListing["listing"],
        });
      } catch {
        // Listing not found, add without listing data
        viewingsWithListings.push(viewing);
      }
    }

    setViewings(viewingsWithListings);
    setIsLoading(false);
  };

  const handleRemoveFromShortlist = async (viewingId: string) => {
    const supabase = getSupabaseBrowser();
    
    await supabase
      .from("viewings")
      .delete()
      .eq("id", viewingId);
    
    setViewings((prev) => prev.filter((v) => v.id !== viewingId));
  };

  const filterViewings = (status: string) => {
    if (status === "all") return viewings;
    if (status === "interested") {
      return viewings.filter((v) => 
        ["interested", "contacted"].includes(v.status)
      );
    }
    if (status === "scheduled") {
      return viewings.filter((v) => v.status === "scheduled");
    }
    if (status === "completed") {
      return viewings.filter((v) => v.status === "completed");
    }
    return viewings;
  };

  const getTabCounts = () => ({
    all: viewings.length,
    interested: viewings.filter((v) => 
      ["interested", "contacted"].includes(v.status)
    ).length,
    scheduled: viewings.filter((v) => v.status === "scheduled").length,
    completed: viewings.filter((v) => v.status === "completed").length,
  });

  const counts = getTabCounts();
  const filteredViewings = filterViewings(activeTab);

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-serif text-xl font-medium text-stone-900">
                Tu shortlist
              </h1>
              <p className="text-sm text-stone-500">
                {counts.all} {counts.all === 1 ? "piso" : "pisos"} guardados
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-stone-100 rounded-full p-1">
            <TabsTrigger 
              value="all" 
              className="rounded-full data-[state=active]:bg-white"
            >
              Todos ({counts.all})
            </TabsTrigger>
            <TabsTrigger 
              value="interested" 
              className="rounded-full data-[state=active]:bg-white"
            >
              <Heart className="w-4 h-4 mr-1" />
              Guardados ({counts.interested})
            </TabsTrigger>
            <TabsTrigger 
              value="scheduled" 
              className="rounded-full data-[state=active]:bg-white"
            >
              <Calendar className="w-4 h-4 mr-1" />
              Visitas ({counts.scheduled})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredViewings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="font-medium text-stone-900 mb-2">
              {activeTab === "all" 
                ? "Tu shortlist está vacía" 
                : "No hay pisos en esta categoría"}
            </h3>
            <p className="text-stone-500 mb-6">
              Cuando encuentres pisos que te gusten, guárdalos aquí para compararlos.
            </p>
            <Link href="/recommend">
              <Button className="bg-stone-900 text-white hover:bg-stone-800 rounded-full">
                Buscar pisos
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredViewings.map((viewing) => {
              const listing = viewing.listing;
              
              if (!listing) {
                // Fallback for listings without data
                return (
                  <div 
                    key={viewing.id}
                    className="bg-white rounded-2xl border border-stone-100 p-6"
                  >
                    <p className="text-stone-500">
                      Piso #{viewing.listing_id}
                    </p>
                    <p className="text-sm text-stone-400">
                      Datos no disponibles
                    </p>
                  </div>
                );
              }

              return (
                <div key={viewing.id} className="relative">
                  <PropertyCard
                    id={listing.id}
                    title={listing.title}
                    address={listing.address}
                    city={listing.city}
                    neighborhood={listing.neighborhood}
                    price={listing.price_eur}
                    priceType="rent"
                    bedrooms={listing.bedrooms}
                    bathrooms={listing.bathrooms}
                    sqm={listing.sqm}
                    imageUrl={listing.photo_urls?.[0]}
                    isFavorite={true}
                    onFavoriteToggle={() => handleRemoveFromShortlist(viewing.id)}
                  />
                  
                  {/* Status badge */}
                  {viewing.status === "scheduled" && viewing.scheduled_at && (
                    <div className="absolute bottom-4 left-4 right-4 bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Visita: {new Date(viewing.scheduled_at).toLocaleDateString("es-ES")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

