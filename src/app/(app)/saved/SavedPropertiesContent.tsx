"use client";

import Link from "next/link";
import Image from "next/image";
import { Home, MapPin, Heart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

interface Listing {
  id: string;
  title: string;
  price_eur: string;
  sqm: number | null;
  bedrooms: number;
  bathrooms: string;
  address: string;
  city: string;
  source_url: string;
}

interface SavedProperty {
  id: number;
  created_at: string;
  notes: string | null;
  listing_id: string;
  listings: Listing | null;
  photo: string | null;
}

interface SavedPropertiesContentProps {
  savedProperties: SavedProperty[];
  userId: string | null;
}

export function SavedPropertiesContent({ savedProperties, userId }: SavedPropertiesContentProps) {
  const router = useRouter();

  // Format price in Spanish locale
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
    }).format(new Date(dateString));
  };

  // Remove saved property
  const handleRemove = async (savedId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!userId) return;

    const supabase = getSupabaseBrowser();
    await supabase
      .from("saved_properties")
      .delete()
      .eq("id", savedId);

    router.refresh();
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-medium text-stone-900 mb-1">
          Propiedades Guardadas
        </h1>
        <p className="text-stone-600">
          {savedProperties.length} {savedProperties.length === 1 ? "propiedad guardada" : "propiedades guardadas"}
        </p>
      </div>

      {/* Saved Properties Grid */}
      {savedProperties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedProperties.map((saved) => {
            const listing = saved.listings;
            if (!listing) return null;

            const price = parseFloat(listing.price_eur);
            const isRental = price < 10000;
            
            return (
              <Link 
                key={saved.id} 
                href={`/property/${listing.id}`}
                className="group relative"
              >
                <Card className="bg-white border-stone-100 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-stone-200">
                  {/* Property Image */}
                  <div className="relative aspect-[4/3] bg-stone-100">
                    {saved.photo ? (
                      <Image
                        src={saved.photo}
                        alt={listing.title || "Property"}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Home className="w-12 h-12 text-stone-300" />
                      </div>
                    )}
                    
                    {/* Saved badge */}
                    <div className="absolute top-3 right-3 bg-rose-500 rounded-full p-2">
                      <Heart className="w-4 h-4 text-white fill-white" />
                    </div>

                    {/* Date saved */}
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-stone-700">
                      Guardado {formatDate(saved.created_at)}
                    </div>
                  </div>

                  {/* Property Info */}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-lg font-semibold text-stone-900">
                        {formatPrice(price)}
                        {isRental && (
                          <span className="text-sm font-normal text-stone-500">/mes</span>
                        )}
                      </p>
                      
                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-stone-400 hover:text-rose-500 hover:bg-rose-50"
                        onClick={(e) => handleRemove(saved.id, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-stone-600 mb-2 line-clamp-1">
                      {listing.bedrooms} hab · {Math.floor(parseFloat(listing.bathrooms))} baño{listing.sqm ? ` · ${listing.sqm}m²` : ''}
                    </p>
                    
                    <div className="flex items-center gap-1 text-sm text-stone-500">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="line-clamp-1">{listing.city || "España"}</span>
                    </div>

                    {/* Notes preview */}
                    {saved.notes && (
                      <p className="mt-3 text-xs text-stone-500 line-clamp-2 bg-stone-50 rounded-lg p-2">
                        💬 {saved.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="bg-white border-stone-100 rounded-2xl shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-rose-400" />
            </div>
            <h3 className="font-medium text-stone-900 mb-2">
              No tienes propiedades guardadas
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              Guarda las propiedades que te interesen para verlas más tarde
            </p>
            <Button asChild className="rounded-full">
              <Link href="/recommend">
                Ver recomendaciones
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

