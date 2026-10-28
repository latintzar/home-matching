"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Bed, Bath, Square, Heart, HeartOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { FitScoreBadge } from "./FitScoreBadge";

interface PropertyCardProps {
  id: string;
  title: string;
  address?: string;
  city?: string;
  neighborhood?: string;
  price: number;
  priceType?: "sale" | "rent";
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
  imageUrl?: string;
  fitScore?: number;
  isFavorite?: boolean;
  onFavoriteToggle?: (id: string) => void;
  className?: string;
}

export function PropertyCard({
  id,
  title,
  address,
  city,
  neighborhood,
  price,
  priceType = "rent",
  bedrooms,
  bathrooms,
  sqm,
  imageUrl,
  fitScore,
  isFavorite = false,
  onFavoriteToggle,
  className,
}: PropertyCardProps) {
  const formatPrice = (price: number, type: "sale" | "rent") => {
    if (type === "sale") {
      return price >= 1000000
        ? `€${(price / 1000000).toFixed(1)}M`
        : `€${(price / 1000).toFixed(0)}k`;
    }
    return `€${price.toLocaleString()}/mes`;
  };

  const locationText = neighborhood || city || address?.split(",")[0];

  return (
    <Link 
      href={`/property/${id}`}
      className={cn(
        "block bg-white rounded-2xl border border-stone-100 overflow-hidden hover-lift transition-all",
        className
      )}
    >
      {/* Image */}
      <div className="aspect-[4/3] relative bg-stone-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">
            <Square className="w-12 h-12" />
          </div>
        )}
        
        {/* Fit Score Badge */}
        {fitScore !== undefined && (
          <div className="absolute top-3 left-3">
            <FitScoreBadge score={fitScore} />
          </div>
        )}
        
        {/* Favorite Button */}
        {onFavoriteToggle && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFavoriteToggle(id);
            }}
            className={cn(
              "absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              isFavorite 
                ? "bg-rose-500 text-white" 
                : "bg-white/90 text-stone-600 hover:bg-white hover:text-rose-500"
            )}
          >
            {isFavorite ? (
              <Heart className="w-5 h-5 fill-current" />
            ) : (
              <Heart className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Price */}
        <p className="text-xl font-semibold text-stone-900 mb-1">
          {formatPrice(price, priceType)}
        </p>
        
        {/* Title */}
        <h3 className="text-stone-700 line-clamp-1 mb-2">
          {title}
        </h3>
        
        {/* Location */}
        {locationText && (
          <div className="flex items-center gap-1.5 text-sm text-stone-500 mb-3">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>
        )}
        
        {/* Features */}
        <div className="flex items-center gap-4 text-sm text-stone-600">
          {bedrooms !== undefined && (
            <span className="flex items-center gap-1">
              <Bed className="w-4 h-4" />
              {bedrooms}
            </span>
          )}
          {bathrooms !== undefined && (
            <span className="flex items-center gap-1">
              <Bath className="w-4 h-4" />
              {bathrooms}
            </span>
          )}
          {sqm !== undefined && (
            <span className="flex items-center gap-1">
              <Square className="w-4 h-4" />
              {sqm} m²
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// Skeleton variant for loading states
export function PropertyCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      <div className="aspect-[4/3] bg-stone-100 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-6 bg-stone-100 rounded animate-pulse w-1/3" />
        <div className="h-4 bg-stone-100 rounded animate-pulse w-2/3" />
        <div className="h-4 bg-stone-100 rounded animate-pulse w-1/2" />
        <div className="flex gap-4">
          <div className="h-4 bg-stone-100 rounded animate-pulse w-12" />
          <div className="h-4 bg-stone-100 rounded animate-pulse w-12" />
          <div className="h-4 bg-stone-100 rounded animate-pulse w-16" />
        </div>
      </div>
    </div>
  );
}

