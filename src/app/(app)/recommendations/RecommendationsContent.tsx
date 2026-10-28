"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Home, MapPin, Filter, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  housing_situation: string | null;
  photo: string | null;
  fitScore?:number;
}

interface RecommendationsContentProps {
  listings: Listing[];
}

export function RecommendationsContent({ listings }: RecommendationsContentProps) {
  const [sortBy, setSortBy] = useState<string>(listings.some(listing=>typeof listing.fitScore==='number')?"fit":"recent");
  const [filterType, setFilterType] = useState<string>("all");

  // Format price in Spanish locale
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Filter and sort listings
  const filteredListings = listings
    .filter(listing => {
      if (filterType === "all") return true;
      if (filterType === "rental") return parseFloat(listing.price_eur) < 10000;
      if (filterType === "sale") return parseFloat(listing.price_eur) >= 10000;
      return true;
    })
    .sort((a, b) => {
      if(sortBy==='fit')return (b.fitScore||0)-(a.fitScore||0);
      if (sortBy === "price-asc") return parseFloat(a.price_eur) - parseFloat(b.price_eur);
      if (sortBy === "price-desc") return parseFloat(b.price_eur) - parseFloat(a.price_eur);
      if (sortBy === "size") return (b.sqm || 0) - (a.sqm || 0);
      return 0; // recent - already sorted by created_at
    });

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium text-stone-900 mb-1">
            Recomendaciones
          </h1>
          <p className="text-stone-600">
            {filteredListings.length} propiedades que encajan con tu estilo de vida
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px] rounded-xl border-stone-200">
              <Filter className="w-4 h-4 mr-2 text-stone-500" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="rental">Alquiler</SelectItem>
              <SelectItem value="sale">Venta</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] rounded-xl border-stone-200">
              <SlidersHorizontal className="w-4 h-4 mr-2 text-stone-500" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              {listings.some(listing=>typeof listing.fitScore==='number')&&<SelectItem value="fit">Mejor encaje</SelectItem>}
              <SelectItem value="recent">Más recientes</SelectItem>
              <SelectItem value="price-asc">Precio: menor a mayor</SelectItem>
              <SelectItem value="price-desc">Precio: mayor a menor</SelectItem>
              <SelectItem value="size">Tamaño</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Listings Grid */}
      {filteredListings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredListings.map((listing) => {
            const price = parseFloat(listing.price_eur);
            const isRental = price < 10000;
            
            return (
              <Link 
                key={listing.id} 
                href={`/property/${listing.id}`}
                className="group"
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
                    {typeof listing.fitScore==='number' && <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium text-stone-900">
                      {listing.fitScore}% match
                    </div>}
                    {/* Type Badge */}
                    <div className="absolute top-3 left-3 bg-stone-900/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-white">
                      {isRental ? "Alquiler" : "Venta"}
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
          })}
        </div>
      ) : (
        <Card className="bg-white border-stone-100 rounded-2xl shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Home className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="font-medium text-stone-900 mb-2">
              No hay propiedades
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              No encontramos propiedades que coincidan con tus filtros
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setFilterType("all");
                setSortBy("recent");
              }}
              className="rounded-full border-stone-200"
            >
              Limpiar filtros
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

