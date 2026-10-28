"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Home, MapPin, Eye, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { User } from "@supabase/supabase-js";

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
  photo: string | null;
  viewed: boolean;
  fitScore?:number;
}

interface DashboardContentProps {
  user: User | null;
  profile: Record<string, unknown> | null;
  activeProfileType: 'renter' | 'buyer';
  recommendedListings: Listing[];
  savedListings: Listing[];
}

export function DashboardContent({
  user,
  profile,
  activeProfileType,
  recommendedListings,
  savedListings,
}: DashboardContentProps) {
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario";
  
  // Format price in Spanish locale
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Property Card Component
  const PropertyCard = ({ listing, showLikedBadge = false }: { listing: Listing; showLikedBadge?: boolean }) => {
    const price = parseFloat(listing.price_eur);
    const isRental = price < 10000;
    const fitScore = listing.fitScore;

    return (
      <Link 
        href={`/property/${listing.id}`}
        className="group block"
      >
        <Card className="bg-white border-stone-100 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-stone-200">
          {/* Property Image */}
          <div className="relative aspect-[4/3] bg-stone-100">
            {listing.photo ? (
              <Image
                src={listing.photo}
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
            
            {/* Fit Score Badge */}
            {typeof fitScore === "number" && <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-sm font-medium text-stone-900 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {fitScore}%
            </div>}

            {/* Viewed Badge */}
            {listing.viewed && (
              <div className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm rounded-full p-1.5">
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
            )}

            {/* Liked Badge (for saved section) */}
            {showLikedBadge && !listing.viewed && (
              <div className="absolute top-3 right-3 bg-rose-500/90 backdrop-blur-sm rounded-full p-1.5">
                <Heart className="w-3.5 h-3.5 text-white fill-white" />
              </div>
            )}
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
            </div>
            
            <p className="text-sm text-stone-600 mb-2 line-clamp-1">
              {listing.bedrooms} hab · {Math.floor(parseFloat(listing.bathrooms))} baño{listing.sqm ? ` · ${listing.sqm}m²` : ''}
            </p>
            
            <div className="flex items-center gap-1 text-sm text-stone-500">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="line-clamp-1">{listing.city || "España"}</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl font-medium text-stone-900 mb-2">
          Mis Propiedades
        </h1>
        <p className="text-stone-600">
          Leo ha encontrado {recommendedListings.length} propiedades nuevas para ti
        </p>
      </div>

      {/* Recommended Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="font-serif text-xl font-medium text-stone-900">
              Recomendadas
            </h2>
          </div>
          {recommendedListings.length > 6 && (
            <Button 
              variant="ghost" 
              size="sm"
              className="text-stone-600 hover:text-stone-900"
            >
              Ver todas
            </Button>
          )}
        </div>

        {recommendedListings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendedListings.map((listing) => (
              <PropertyCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <Card className="bg-white border-stone-100 rounded-2xl shadow-sm">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Home className="w-8 h-8 text-stone-400" />
              </div>
              <h3 className="font-medium text-stone-900 mb-2">
                Leo está buscando propiedades para ti
              </h3>
              <p className="text-sm text-stone-500 mb-4">
                Actualiza tu perfil para recibir mejores recomendaciones
              </p>
              <Button asChild className="rounded-full">
                <Link href="/profile">
                  Actualizar perfil
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Liked Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <Heart className="w-4 h-4 text-rose-600" />
            </div>
            <h2 className="font-serif text-xl font-medium text-stone-900">
              Me gustan
            </h2>
            {savedListings.length > 0 && (
              <span className="text-sm text-stone-500">
                ({savedListings.length})
              </span>
            )}
          </div>
        </div>

        {savedListings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedListings.map((listing) => (
              <PropertyCard key={listing.id} listing={listing} showLikedBadge />
            ))}
          </div>
        ) : (
          <Card className="bg-stone-50 border-dashed border-stone-200 rounded-2xl">
            <CardContent className="p-6 text-center">
              <Heart className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-500">
                Guarda propiedades que te gusten para verlas aquí
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Profile Summary - Collapsed */}
      {profile && (
        <Card className="bg-stone-50 border-stone-100 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-stone-600">
                  <span className="font-medium text-stone-900">
                    {profile.bedrooms_min ? `${profile.bedrooms_min}+ hab` : "—"}
                  </span>
                  {" · "}
                  <span className="font-medium text-stone-900">
                    {profile.budget_max 
                      ? formatPrice(profile.budget_max as number)
                      : "—"
                    }
                  </span>
                  {" · "}
                  <span>
                    {Array.isArray(profile.preferred_areas) && profile.preferred_areas.length > 0
                      ? (profile.preferred_areas as string[])[0]
                      : "Sin zona definida"
                    }
                  </span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                asChild
                className="text-stone-600 hover:text-stone-900"
              >
                <Link href="/profile">
                  Editar perfil
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
