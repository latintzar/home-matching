"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { 
  Home, MapPin, Bed, Bath, Maximize, ExternalLink, ChevronLeft, ChevronRight, 
  Building2, RefreshCw, X, Check, SlidersHorizontal, Grid3X3, LayoutList,
  Waves, Car, Flame, TreePine, Sparkles, Wind, Calendar, ArrowLeft, Sofa, Square, LayoutPanelLeft,
  Map as MapIcon, Search, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Map as MapGL, Marker, NavigationControl, Source, Layer, Popup, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { CircleLayer, SymbolLayer } from "mapbox-gl";

// ViewState type inline since react-map-gl doesn't export types separately
interface ViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

const MAPBOX_TOKEN = "";

// ============================================================
// TRANSLATIONS
// ============================================================

type Lang = 'es' | 'en';

const TRANSLATIONS = {
  es: {
    // Header
    catalogue: "Catálogo",
    properties: "inmuebles",
    of: "de",
    filters: "Filtros",
    clearFilters: "Limpiar",
    
    // View modes
    grid: "Cuadrícula",
    list: "Lista",
    map: "Mapa",
    
    // Filter sections
    operationType: "Tipo de operación",
    sale: "Venta",
    rent: "Alquiler",
    propertyStatus: "Estado del inmueble",
    all: "Todos",
    active: "Activos",
    sold: "Vendido",
    leased: "Alquilado",
    reserved: "Reservado",
    unavailable: "No disponible",
    propertyType: "Tipo de inmueble",
    apartment: "Piso",
    house: "Casa / Chalet",
    penthouse: "Ático",
    studio: "Estudio / Loft",
    duplex: "Dúplex",
    other: "Otros",
    
    // Location
    location: "Ubicación",
    searchLocation: "Buscar ciudad, barrio...",
    filteringBy: "Filtrando por:",
    
    // Price & Size
    price: "Precio",
    pricePerMonth: "Precio / mes",
    size: "Superficie",
    bedrooms: "Habitaciones",
    bathrooms: "Baños",
    any: "Cualq.",
    
    // Furnished
    furnishing: "Mobiliario",
    furnished: "Amueblado",
    unfurnished: "Sin amueblar",
    
    // Amenities
    features: "Características",
    terrace: "Terraza",
    balcony: "Balcón",
    pool: "Piscina",
    parking: "Parking",
    elevator: "Ascensor",
    ac: "Aire acond.",
    garden: "Jardín",
    storage: "Trastero",
    
    // Floorplans
    floorplans: "Planos",
    hasFloorplan: "Solo con planos",
    
    // Agencies
    agencies: "Agencias",
    
    // Sorting
    sortBy: "Ordenar por",
    latest: "Más recientes",
    priceLowHigh: "Precio: menor a mayor",
    priceHighLow: "Precio: mayor a menor",
    biggest: "Más grandes",
    smallest: "Más pequeños",
    bestPricePerM2: "Mejor €/m²",
    
    // Cards
    propertyIn: "Propiedad en",
    discovered: "Descubierto",
    perMonth: "/mes",
    
    // Map
    propertiesOnMap: "inmuebles en el mapa",
    clickForDetails: "Haz clic en un punto para ver detalles",
    approximateLocation: "Ubicación aproximada",
    areaLevel: "(zona)",
    neighborhoodLevel: "(barrio)",
    unverifiedLocation: "Ubicación no verificada",
    
    // Detail view
    back: "Volver",
    viewOnSite: "Ver en web",
    description: "Descripción",
    
    // WhatsApp
    contactAgent: "Contactar agente",
    gettingContact: "Obteniendo contacto...",
    viewAt: "Ver en",
    
    // WhatsApp message
    whatsappGreeting: "Hola",
    whatsappInterest: "Me interesa",
    whatsappSchedule: "¿podría agendar una visita?",
    whatsappAddressQuestion: "Y por cierto, ¿cuál es la dirección completa?",
    
    // Property articles (for WhatsApp)
    theHouse: "la casa",
    theApartment: "el piso",
    thePenthouse: "el ático",
    theDuplex: "el dúplex",
    theStudio: "el estudio",
    theChalet: "el chalet",
    theLand: "el terreno",
    theProperty: "el inmueble",
    
    // Pagination
    previous: "Anterior",
    next: "Siguiente",
    page: "Página",
    
    // Empty state
    noResults: "No se encontraron propiedades",
    tryAdjustingFilters: "Prueba ajustando los filtros",
  },
  en: {
    // Header
    catalogue: "Catalogue",
    properties: "properties",
    of: "of",
    filters: "Filters",
    clearFilters: "Clear",
    
    // View modes
    grid: "Grid",
    list: "List",
    map: "Map",
    
    // Filter sections
    operationType: "Listing type",
    sale: "For Sale",
    rent: "For Rent",
    propertyStatus: "Property status",
    all: "All",
    active: "Active",
    sold: "Sold",
    leased: "Leased",
    reserved: "Reserved",
    unavailable: "Unavailable",
    propertyType: "Property type",
    apartment: "Apartment",
    house: "House / Villa",
    penthouse: "Penthouse",
    studio: "Studio / Loft",
    duplex: "Duplex",
    other: "Other",
    
    // Location
    location: "Location",
    searchLocation: "Search city, neighborhood...",
    filteringBy: "Filtering by:",
    
    // Price & Size
    price: "Price",
    pricePerMonth: "Price / month",
    size: "Size",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    any: "Any",
    
    // Furnished
    furnishing: "Furnishing",
    furnished: "Furnished",
    unfurnished: "Unfurnished",
    
    // Amenities
    features: "Features",
    terrace: "Terrace",
    balcony: "Balcony",
    pool: "Pool",
    parking: "Parking",
    elevator: "Elevator",
    ac: "A/C",
    garden: "Garden",
    storage: "Storage",
    
    // Floorplans
    floorplans: "Floorplans",
    hasFloorplan: "With floorplans only",
    
    // Agencies
    agencies: "Agencies",
    
    // Sorting
    sortBy: "Sort by",
    latest: "Most recent",
    priceLowHigh: "Price: low to high",
    priceHighLow: "Price: high to low",
    biggest: "Largest",
    smallest: "Smallest",
    bestPricePerM2: "Best €/m²",
    
    // Cards
    propertyIn: "Property in",
    discovered: "Discovered",
    perMonth: "/mo",
    
    // Map
    propertiesOnMap: "properties on map",
    clickForDetails: "Click a point to view details",
    approximateLocation: "Approximate location",
    areaLevel: "(area)",
    neighborhoodLevel: "(neighborhood)",
    unverifiedLocation: "Unverified location",
    
    // Detail view
    back: "Back",
    viewOnSite: "View on website",
    description: "Description",
    
    // WhatsApp
    contactAgent: "Contact agent",
    gettingContact: "Getting contact...",
    viewAt: "View at",
    
    // WhatsApp message
    whatsappGreeting: "Hi",
    whatsappInterest: "I'm interested in",
    whatsappSchedule: "Could I schedule a viewing?",
    whatsappAddressQuestion: "By the way, what's the full address?",
    
    // Property articles (for WhatsApp)
    theHouse: "the house",
    theApartment: "the apartment",
    thePenthouse: "the penthouse",
    theDuplex: "the duplex",
    theStudio: "the studio",
    theChalet: "the chalet",
    theLand: "the land",
    theProperty: "the property",
    
    // Pagination
    previous: "Previous",
    next: "Next",
    page: "Page",
    
    // Empty state
    noResults: "No properties found",
    tryAdjustingFilters: "Try adjusting your filters",
  }
} as const;

interface Listing {
  domain: string;
  listing_id: string;
  price: number;
  title?: string;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
  areaM2?: number;
  area_m2?: number;
  city?: string;
  address?: string;
  neighborhood?: string;
  province?: string;
  region?: string;
  photos?: string[];
  image_urls?: string[];
  url?: string;
  source_url?: string;
  sourceUrl?: string;
  // Contract type (venta/alquiler)
  contractType?: string;
  contract_type?: string;
  first_seen?: string;
  last_seen?: string;
  status?: string;
  property_type?: string;
  propertyType?: string;
  type?: string;
  has_pool?: boolean;
  has_parking?: boolean;
  has_terrace?: boolean;
  has_balcony?: boolean;
  has_elevator?: boolean;
  has_ac?: boolean;
  has_garden?: boolean;
  is_furnished?: boolean;
  has_storage?: boolean;
  amenities?: string[];
  photos_floorplan?: string[];
  floor?: number;
  year_built?: number;
  energy_class?: string;
  // Agent contact
  agent_phone?: string;
  agent_email?: string;
  agent_name?: string;
  agency_phone?: string;
  agency_email?: string;
  shop_phone?: string;
  advisor_name?: string;
  // donpiso has nested agency object
  agency?: {
    phone?: string;
    email?: string;
    name?: string;
  };
  // Coordinates for map
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  // Coordinate precision (from harvesters)
  coordinate_precision?: 'precise' | 'approximate' | 'city_center' | 'unknown';
  // Nested location object (some harvesters use this)
  location?: {
    city?: string;
    neighborhood?: string;
    province?: string;
    address?: string;
    street_address?: string;
    lat?: number;
    lng?: number;
    coordinate_precision?: 'precise' | 'approximate' | 'city_center' | 'unknown';
    country?: string;
  };
}

type SortOption = "latest" | "oldest" | "price_high" | "price_low" | "biggest" | "smallest" | "price_per_m2";
type ListingType = "sale" | "rent"; // No "all" - must choose one
type StatusFilter = "all" | "active" | "sold" | "leased" | "reserved" | "removed";
type FurnishedFilter = "all" | "furnished" | "unfurnished";

const DOMAIN_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "lucasfox.com": { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  "donpiso.com": { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
  "tecnocasa.es": { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  "century21.es": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  "remax.es": { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  "aproperties.es": { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" },
  "engelvoelkers.com": { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" },
};

const DOMAIN_NAMES: Record<string, string> = {
  "lucasfox.com": "Lucas Fox",
  "donpiso.com": "donpiso",
  "tecnocasa.es": "Tecnocasa",
  "century21.es": "Century 21",
  "remax.es": "RE/MAX",
  "aproperties.es": "aProperties",
  "engelvoelkers.com": "Engel & Völkers",
};

// Agency logo URLs
const AGENCY_LOGOS: Record<string, string> = {
  "lucasfox.com": "https://www.lucasfox.com/images/logo.svg",
  "donpiso.com": "https://www.donpiso.com/imagenes/logo-donpiso.svg",
  "tecnocasa.es": "https://www.tecnocasa.es/content/themes/tecnocasa/images/logo.svg",
  "century21.es": "https://www.century21.es/sites/all/themes/flavor/assets/images/header/logo-header.svg",
  "remax.es": "https://www.remax.es/static/images/remax-balloon.svg",
  "aproperties.es": "https://www.aproperties.es/themes/aproperties/assets/images/logo.png",
  "engelvoelkers.com": "https://www.engelvoelkers.com/images/logos/ev-logo.svg",
};

// Domains that need JS rendering to get agent contact
const JS_RENDER_DOMAINS = ['engelvoelkers.com', 'remax.es'];

// Get agent phone from various field names
const getAgentPhone = (listing: Listing): string | null => {
  return listing.agent_phone 
    || listing.agency_phone 
    || listing.shop_phone 
    || listing.agency?.phone 
    || null;
};

// Get agent name from various field names
const getAgentName = (listing: Listing): string | null => {
  return listing.agent_name 
    || listing.advisor_name 
    || null;
};

// Get first name from full name
const getFirstName = (fullName: string | null): string | null => {
  if (!fullName) return null;
  return fullName.split(' ')[0];
};

// Check if domain needs JS rendering for contact
const needsJSRender = (domain: string): boolean => {
  return JS_RENDER_DOMAINS.includes(domain);
};

// Get property type article based on language
const getPropertyArticle = (listing: Listing, lang: Lang): string => {
  const type = (listing.property_type || listing.propertyType || listing.type || '').toLowerCase();
  const translations = TRANSLATIONS[lang];
  
  // Feminine: casa, villa, finca, oficina
  const feminineTypes = ['casa', 'house', 'villa', 'finca', 'oficina', 'office'];
  if (feminineTypes.some(t => type.includes(t))) {
    return translations.theHouse;
  }
  
  // Masculine: piso, apartamento, ático, dúplex, estudio, local, chalet
  if (type.includes('apartment') || type.includes('piso') || type.includes('flat')) {
    return translations.theApartment;
  }
  if (type.includes('penthouse') || type.includes('ático') || type.includes('atico')) {
    return translations.thePenthouse;
  }
  if (type.includes('duplex') || type.includes('dúplex')) {
    return translations.theDuplex;
  }
  if (type.includes('studio') || type.includes('estudio')) {
    return translations.theStudio;
  }
  if (type.includes('chalet')) {
    return translations.theChalet;
  }
  if (type.includes('land') || type.includes('terreno') || type.includes('solar')) {
    return translations.theLand;
  }
  
  // Default
  return translations.theProperty;
};

// Build WhatsApp URL with predrafted message
const buildWhatsAppUrl = (listing: Listing, lang: Lang, agentPhone?: string | null, agentName?: string | null): string | null => {
  const phone = agentPhone || getAgentPhone(listing);
  if (!phone) return null;
  
  const translations = TRANSLATIONS[lang];
  
  // Clean phone number (remove spaces, keep + and digits)
  const cleanPhone = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  
  const firstName = getFirstName(agentName || getAgentName(listing));
  const propertyArticle = getPropertyArticle(listing, lang);
  const listingUrl = listing.url || listing.source_url || listing.sourceUrl || '';
  
  // Check if we have a precise address
  const hasSpecificAddress = listing.coordinate_precision === 'precise' || 
    (listing.address && listing.address.length > 5);
  
  // Build message with or without name
  const greeting = firstName 
    ? `${translations.whatsappGreeting} ${firstName}!!!` 
    : `${translations.whatsappGreeting}!!!`;
  const addressQuestion = hasSpecificAddress ? '' : `\n\n${translations.whatsappAddressQuestion}`;
  const message = `${greeting} ${translations.whatsappInterest} ${propertyArticle}, ${translations.whatsappSchedule}${addressQuestion}

${listingUrl}`;
  
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

const PROPERTY_TYPES = [
  { id: "apartment", label: "Piso", keywords: ["piso", "apartament", "flat", "apartment"] },
  { id: "house", label: "Casa / Chalet", keywords: ["casa", "chalet", "villa", "house", "adosado", "pareado"] },
  { id: "penthouse", label: "Ático", keywords: ["ático", "atico", "penthouse"] },
  { id: "studio", label: "Estudio / Loft", keywords: ["estudio", "studio", "loft"] },
  { id: "duplex", label: "Dúplex", keywords: ["dúplex", "duplex"] },
  { id: "other", label: "Otros", keywords: ["garaje", "garage", "box", "plaza", "local", "comercial", "oficina", "office", "nave", "terreno", "solar", "parking", "trastero", "storage"] },
];

const AMENITIES = [
  { id: "terrace", label: "Terraza", icon: Flame, field: "has_terrace" },
  { id: "balcony", label: "Balcón", icon: Square, field: "has_balcony" },
  { id: "pool", label: "Piscina", icon: Waves, field: "has_pool" },
  { id: "parking", label: "Parking", icon: Car, field: "has_parking" },
  { id: "elevator", label: "Ascensor", icon: Sparkles, field: "has_elevator" },
  { id: "ac", label: "Aire acond.", icon: Wind, field: "has_ac" },
  { id: "garden", label: "Jardín", icon: TreePine, field: "has_garden" },
  { id: "storage", label: "Trastero", icon: Home, field: "has_storage" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "latest", label: "Más recientes" },
  { value: "price_low", label: "Precio: menor a mayor" },
  { value: "price_high", label: "Precio: mayor a menor" },
  { value: "biggest", label: "Más grandes" },
  { value: "smallest", label: "Más pequeños" },
  { value: "price_per_m2", label: "Mejor €/m²" },
];

// Photo Carousel Component with touch/swipe support
const PhotoCarousel = ({ 
  photos, 
  className = "",
  showArrows = true,
  size = "small"
}: { 
  photos: string[]; 
  className?: string;
  showArrows?: boolean;
  size?: "small" | "large";
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  // Touch/swipe state
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const goTo = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex(index);
  };

  const goPrev = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goNext = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isSwipe = Math.abs(distance) > minSwipeDistance;
    
    if (isSwipe) {
      if (distance > 0) {
        // Swiped left - go next
        goNext();
      } else {
        // Swiped right - go prev
        goPrev();
      }
    e.preventDefault();
    e.stopPropagation();
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (photos.length === 0) {
    return (
      <div className={cn("relative bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center", className)}>
        <Home className="w-12 h-12 text-stone-300" />
      </div>
    );
  }

  const arrowSize = size === "large" ? "w-10 h-10" : "w-8 h-8";
  const iconSize = size === "large" ? "w-6 h-6" : "w-5 h-5";

  return (
    <div 
      className={cn("relative overflow-hidden group/carousel touch-pan-y", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Current Photo */}
      <div className="relative w-full h-full">
        <Image
          src={photos[currentIndex]}
          alt={`Photo ${currentIndex + 1}`}
          fill
          className="object-cover transition-transform duration-300"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          unoptimized
          priority={currentIndex === 0}
          draggable={false}
        />
      </div>

      {/* Navigation Arrows - hidden on mobile, visible on hover for desktop */}
      {showArrows && photos.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-all",
              "hidden md:flex", // Hide on mobile
              isHovered ? "opacity-100" : "opacity-0",
              arrowSize
            )}
          >
            <ChevronLeft className={iconSize + " text-stone-700"} />
          </button>
          <button
            onClick={goNext}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-all",
              "hidden md:flex", // Hide on mobile
              isHovered ? "opacity-100" : "opacity-0",
              arrowSize
            )}
          >
            <ChevronRight className={iconSize + " text-stone-700"} />
          </button>
        </>
      )}

      {/* Photo counter for large */}
      {size === "large" && photos.length > 1 && (
        <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-sm font-medium">
          {currentIndex + 1} / {photos.length}
        </div>
      )}

      {/* Dots for small */}
      {size === "small" && photos.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {photos.slice(0, Math.min(5, photos.length)).map((_, i) => (
            <button
              key={i}
              onClick={(e) => goTo(i, e)}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                currentIndex === i 
                  ? "bg-white w-2.5" 
                  : "bg-white/60 hover:bg-white/80"
              )}
            />
          ))}
          {photos.length > 5 && (
            <span className="text-white/80 text-xs ml-1">+{photos.length - 5}</span>
          )}
        </div>
      )}
    </div>
  );
};

// WhatsApp Contact Button with JS rendering support
const WhatsAppButton = ({ 
  listing, 
  lang = 'es',
  className = "",
  size = "normal"
}: { 
  listing: Listing; 
  lang?: Lang;
  className?: string;
  size?: "normal" | "large";
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedContact, setFetchedContact] = useState<{ phone: string; name?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const translations = TRANSLATIONS[lang];
  const url = listing.url || listing.source_url || listing.sourceUrl || "#";
  const hasPhone = getAgentPhone(listing) !== null;
  const needsJS = needsJSRender(listing.domain);
  
  // Fetch contact via ScrapFly for JS-rendered domains
  const fetchContact = async () => {
    if (!needsJS || hasPhone) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/get-agent-contact?url=${encodeURIComponent(url)}&domain=${listing.domain}`);
      const data = await response.json();
      
      if (data.phone) {
        setFetchedContact({ phone: data.phone, name: data.name });
        // Auto-open WhatsApp after fetching
        const whatsappUrl = buildWhatsAppUrl(listing, lang, data.phone, data.name);
        if (whatsappUrl) {
          window.open(whatsappUrl, '_blank');
        }
      } else {
        setError(lang === 'es' ? "No se encontró el contacto" : "Contact not found");
        // Fallback to agency website
        window.open(url, '_blank');
      }
    } catch (err) {
      setError(lang === 'es' ? "Error al obtener contacto" : "Error getting contact");
      window.open(url, '_blank');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClick = () => {
    if (needsJS && !hasPhone && !fetchedContact) {
      fetchContact();
    } else {
      const whatsappUrl = buildWhatsAppUrl(listing, lang, fetchedContact?.phone, fetchedContact?.name);
      if (whatsappUrl) {
        window.open(whatsappUrl, '_blank');
      } else {
        window.open(url, '_blank');
      }
    }
  };
  
  const whatsappUrl = buildWhatsAppUrl(listing, lang, fetchedContact?.phone, fetchedContact?.name);
  const agentName = getFirstName(fetchedContact?.name || getAgentName(listing));
  
  const sizeClasses = size === "large" 
    ? "px-6 py-4 text-lg" 
    : "px-4 py-3";
  
  // If we have a phone (or fetched one), show WhatsApp button with brand color
  if (whatsappUrl || fetchedContact) {
    return (
      <a
        href={whatsappUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl text-white font-medium transition-colors",
          sizeClasses,
          className
        )}
        style={{ backgroundColor: '#25D366' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1da851'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#25D366'}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        {agentName 
          ? (lang === 'es' ? `Contactar a ${agentName}` : `Contact ${agentName}`)
          : translations.contactAgent}
      </a>
    );
  }
  
  // If domain needs JS rendering, show button that fetches contact
  if (needsJS) {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl font-medium transition-colors text-white",
          isLoading && "cursor-wait opacity-70",
          sizeClasses,
          className
        )}
        style={{ backgroundColor: isLoading ? '#1da851' : '#25D366' }}
        onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#1da851')}
        onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#25D366')}
      >
        {isLoading ? (
          <>
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {translations.gettingContact}
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {translations.contactAgent}
          </>
        )}
      </button>
    );
  }
  
  // Fallback: link to agency website
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "w-full flex items-center justify-center gap-2 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 transition-colors",
        sizeClasses,
        className
      )}
    >
      {translations.viewAt} {DOMAIN_NAMES[listing.domain] || 'agencia'}
      <ExternalLink className="w-4 h-4" />
    </a>
  );
};

// Detail View Component (inline, not drawer)
const DetailView = ({ 
  listing, 
  onClose,
  onOpenMapView,
  lang = 'es'
}: { 
  listing: Listing; 
  onClose: () => void;
  onOpenMapView?: (lat: number, lng: number) => void;
  lang?: Lang;
}) => {
  const translations = TRANSLATIONS[lang];
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [mapInView, setMapInView] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Lazy load map when it comes into view
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMapInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);
  
  const photos = listing.photos || listing.image_urls || [];
  const area = listing.sqm || listing.areaM2 || listing.area_m2;
  const isRental = listing.price < 5000;
  const pricePerM2 = area && area > 0 ? Math.round(listing.price / area) : null;
  const colors = DOMAIN_COLORS[listing.domain] || { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" };
  const url = listing.url || listing.source_url || listing.sourceUrl || "#";

  const formatPriceFull = (price: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("es-ES", { 
      day: "numeric", 
      month: "long", 
      year: "numeric" 
    });
  };

  const getLocation = (): string => {
    // Check both top-level and nested location fields
    return listing.neighborhood || 
           listing.location?.neighborhood ||
           listing.city || 
           listing.location?.city ||
           listing.province || 
           listing.location?.province ||
           listing.region || 
           "España";
  };

  // Collect all amenities
  const allAmenities: string[] = [];
  if (listing.has_pool) allAmenities.push("Piscina");
  if (listing.has_parking) allAmenities.push("Parking");
  if (listing.has_terrace) allAmenities.push("Terraza");
  if (listing.has_elevator) allAmenities.push("Ascensor");
  if (listing.has_ac) allAmenities.push("Aire acondicionado");
  if (listing.has_garden) allAmenities.push("Jardín");
  if (listing.amenities) allAmenities.push(...listing.amenities);

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-6">
      {/* Back button header */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-100">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium hidden sm:inline">{translations.back}</span>
          </button>
          
          {/* Agency link - subtle, in header */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            <span>{translations.viewAt} {DOMAIN_NAMES[listing.domain] || listing.domain}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Photo Carousel */}
        <div className="relative aspect-[16/9] lg:rounded-xl overflow-hidden bg-stone-100 lg:mx-4 lg:mt-4">
          {photos.length > 0 ? (
            <>
              <Image
                src={photos[currentPhotoIndex]}
                alt={listing.title || "Property"}
                fill
                className="object-cover"
                unoptimized
                priority
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6 text-stone-700" />
                  </button>
                  <button
                    onClick={() => setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-all"
                  >
                    <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6 text-stone-700" />
                  </button>
                  <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-sm font-medium">
                    {currentPhotoIndex + 1} / {photos.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home className="w-16 h-16 text-stone-300" />
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div className="flex gap-2 px-4 py-3 overflow-x-auto">
            {photos.slice(0, 10).map((photo, i) => (
              <button
                key={i}
                onClick={() => setCurrentPhotoIndex(i)}
                className={cn(
                  "relative w-14 h-10 lg:w-16 lg:h-12 flex-shrink-0 rounded-lg overflow-hidden transition-all",
                  currentPhotoIndex === i 
                    ? "ring-2 ring-stone-900 ring-offset-2" 
                    : "opacity-50 hover:opacity-100"
                )}
              >
                <Image
                  src={photo}
                  alt={`Thumbnail ${i + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </button>
            ))}
            {photos.length > 10 && (
              <div className="w-14 h-10 lg:w-16 lg:h-12 flex-shrink-0 rounded-lg bg-stone-200 flex items-center justify-center text-stone-500 text-xs lg:text-sm font-medium">
                +{photos.length - 10}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 lg:p-6 space-y-6">
          {/* Agency logo + date */}
          <div className="flex items-center gap-3 flex-wrap">
            {AGENCY_LOGOS[listing.domain] ? (
              <img 
                src={AGENCY_LOGOS[listing.domain]} 
                alt={DOMAIN_NAMES[listing.domain] || listing.domain}
                className="h-6 lg:h-7 w-auto object-contain"
                onError={(e) => {
                  // Fallback to text if logo fails to load
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <span className={cn("text-sm font-medium", colors.text, AGENCY_LOGOS[listing.domain] ? "hidden" : "")}>
              {DOMAIN_NAMES[listing.domain] || listing.domain}
            </span>
            {listing.first_seen && (
              <>
                <span className="text-stone-300">•</span>
                <span className="text-sm text-stone-400">
                  {translations.discovered} {formatDate(listing.first_seen)}
                </span>
              </>
            )}
          </div>

          {/* Title/Location */}
          <div>
            <h1 className="text-lg lg:text-xl font-semibold text-stone-900 mb-1">
              {listing.title || `${translations.propertyIn} ${getLocation()}`}
            </h1>
            <div className="flex items-center gap-1.5 text-stone-500 text-sm lg:text-base">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>
                {[
                  listing.address || listing.location?.address || listing.location?.street_address,
                  listing.neighborhood || listing.location?.neighborhood,
                  listing.city || listing.location?.city,
                  listing.province || listing.location?.province
                ].filter(Boolean).join(", ") || getLocation()}
              </span>
            </div>
          </div>

          {/* Price - BIGGER than title, below address */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 pb-4 border-b border-stone-100">
            <div>
              <p className="text-3xl lg:text-4xl font-bold text-stone-900 tracking-tight">
                {formatPriceFull(listing.price)}
                {isRental && <span className="text-lg lg:text-xl font-normal text-stone-400">{translations.perMonth}</span>}
              </p>
              {pricePerM2 && !isRental && (
                <p className="text-stone-500 mt-1 text-base">{pricePerM2.toLocaleString()} €/m²</p>
              )}
            </div>
            
            {/* WhatsApp button - desktop only (mobile has sticky footer) */}
            <div className="hidden lg:block">
              <WhatsAppButton listing={listing} lang={lang} size="normal" />
            </div>
          </div>

          {/* Key specs */}
          <div className="flex flex-wrap gap-2 lg:gap-3">
            {listing.bedrooms && (
              <div className="flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-3 bg-stone-50 rounded-xl">
                <Bed className="w-4 h-4 lg:w-5 lg:h-5 text-stone-500" />
                <div>
                  <p className="font-semibold text-stone-900 text-sm lg:text-base">{listing.bedrooms}</p>
                  <p className="text-xs text-stone-500">hab.</p>
                </div>
              </div>
            )}
            {listing.bathrooms && (
              <div className="flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-3 bg-stone-50 rounded-xl">
                <Bath className="w-4 h-4 lg:w-5 lg:h-5 text-stone-500" />
                <div>
                  <p className="font-semibold text-stone-900 text-sm lg:text-base">{listing.bathrooms}</p>
                  <p className="text-xs text-stone-500">baños</p>
                </div>
              </div>
            )}
            {area && (
              <div className="flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-3 bg-stone-50 rounded-xl">
                <Maximize className="w-4 h-4 lg:w-5 lg:h-5 text-stone-500" />
                <div>
                  <p className="font-semibold text-stone-900 text-sm lg:text-base">{area} m²</p>
                  <p className="text-xs text-stone-500">superficie</p>
                </div>
              </div>
            )}
            {listing.floor && (
              <div className="flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-3 bg-stone-50 rounded-xl">
                <Building2 className="w-4 h-4 lg:w-5 lg:h-5 text-stone-500" />
                <div>
                  <p className="font-semibold text-stone-900 text-sm lg:text-base">Planta {listing.floor}</p>
                  <p className="text-xs text-stone-500">altura</p>
                </div>
              </div>
            )}
          </div>

          {/* Amenities */}
          {allAmenities.length > 0 && (
            <div>
              <h2 className="text-base lg:text-lg font-semibold text-stone-900 mb-3">Características</h2>
              <div className="flex flex-wrap gap-2">
                {[...new Set(allAmenities)].map((amenity, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-stone-100 rounded-full text-xs lg:text-sm font-medium text-stone-700"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div>
              <h2 className="text-base lg:text-lg font-semibold text-stone-900 mb-3">{translations.description}</h2>
              <p className="text-stone-600 leading-relaxed whitespace-pre-line text-sm lg:text-base">
                {listing.description}
              </p>
            </div>
          )}

          {/* Map - Static image with lazy loading */}
          {(() => {
            const mapLat = listing.lat || listing.latitude;
            const mapLng = listing.lng || listing.longitude;
            if (mapLat && mapLng) {
              // Static map URL (much cheaper than interactive map)
              const staticMapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+1a1a1a(${mapLng},${mapLat})/${mapLng},${mapLat},14,0/800x400@2x?access_token=${MAPBOX_TOKEN}`;
              
              return (
                <div ref={mapContainerRef}>
                  <h2 className="text-base lg:text-lg font-semibold text-stone-900 mb-3">{translations.location}</h2>
                  <button 
                    onClick={() => onOpenMapView?.(mapLat, mapLng)}
                    className="w-full rounded-xl overflow-hidden border border-stone-200 relative group cursor-pointer"
                    style={{ height: 280 }}
                    title={translations.map}
                  >
                    {mapInView ? (
                      <>
                        <img
                          src={staticMapUrl}
                          alt={`${translations.location} ${getLocation()}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                            <MapIcon className="w-4 h-4" />
                            <span className="font-medium text-sm">{translations.map}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                        <div className="animate-pulse flex flex-col items-center gap-2">
                          <MapIcon className="w-8 h-8 text-stone-300" />
                          <span className="text-stone-400 text-sm">...</span>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            }
            return null;
          })()}

          {/* Meta info */}
          <div className="pt-4 border-t border-stone-100 space-y-2 text-xs lg:text-sm text-stone-400">
            {listing.energy_class && (
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Certificación energética: {listing.energy_class}</span>
              </div>
            )}
            {listing.year_built && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Año de construcción: {listing.year_built}</span>
              </div>
            )}
            <p className="font-mono text-xs pt-2">ID: {listing.listing_id}</p>
          </div>
        </div>
      </div>
      
      {/* Mobile sticky footer with WhatsApp button */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-stone-200 p-4 shadow-lg">
        <WhatsAppButton listing={listing} lang={lang} size="large" />
      </div>
    </div>
  );
};

// Helper to calculate adaptive step based on drag velocity
const getAdaptiveStep = (delta: number, range: number, baseStep: number): number => {
  const percentChange = Math.abs(delta) / range;
  if (percentChange > 0.1) return baseStep * 100; // Very fast: 100x step
  if (percentChange > 0.05) return baseStep * 50;  // Fast: 50x step
  if (percentChange > 0.02) return baseStep * 10;  // Medium: 10x step
  if (percentChange > 0.01) return baseStep * 5;   // Slow: 5x step
  return baseStep; // Very slow: base step
};

// Round to nearest step
const roundToStep = (value: number, step: number): number => {
  return Math.round(value / step) * step;
};

// Price Range Filter with local state for smooth dragging
const PriceRangeFilter = React.memo(({
  listingType,
  minPrice,
  maxPrice,
  priceRange,
  setPriceRange,
}: {
  listingType: ListingType;
  minPrice: number;
  maxPrice: number;
  priceRange: [number, number];
  setPriceRange: (v: [number, number]) => void;
}) => {
  const [localRange, setLocalRange] = useState(priceRange);
  const [minInput, setMinInput] = useState(priceRange[0].toLocaleString("es-ES"));
  const [maxInput, setMaxInput] = useState(priceRange[1].toLocaleString("es-ES"));
  const isDragging = useRef(false);
  const lastValue = useRef(priceRange);
  const priceRangeTotal = maxPrice - minPrice;
  const baseStep = listingType === "rent" ? 10 : 1000;

  // Sync local state when parent state changes (but not while dragging)
  useEffect(() => {
    if (!isDragging.current) {
      setLocalRange(priceRange);
      setMinInput(priceRange[0].toLocaleString("es-ES"));
      setMaxInput(priceRange[1].toLocaleString("es-ES"));
      lastValue.current = priceRange;
    }
  }, [priceRange]);

  return (
    <div className="py-5 border-b border-stone-100">
      <h3 className="text-sm font-semibold text-stone-900 mb-3 tracking-tight">Precio</h3>
      <div className="space-y-3">
        <Slider
          value={localRange}
          min={minPrice}
          max={maxPrice}
          step={1}
          onValueChange={(v) => {
            isDragging.current = true;
            const rawValues = v as [number, number];
            
            // Calculate adaptive steps based on drag speed
            const deltaMin = rawValues[0] - lastValue.current[0];
            const deltaMax = rawValues[1] - lastValue.current[1];
            
            const stepMin = getAdaptiveStep(deltaMin, priceRangeTotal, baseStep);
            const stepMax = getAdaptiveStep(deltaMax, priceRangeTotal, baseStep);
            
            const snappedMin = roundToStep(rawValues[0], stepMin);
            const snappedMax = roundToStep(rawValues[1], stepMax);
            
            // Clamp to bounds
            const finalMin = Math.max(minPrice, Math.min(snappedMin, rawValues[1]));
            const finalMax = Math.min(maxPrice, Math.max(snappedMax, rawValues[0]));
            
            const snappedValues: [number, number] = [finalMin, finalMax];
            lastValue.current = snappedValues;
            
            setLocalRange(snappedValues);
            setMinInput(snappedValues[0].toLocaleString("es-ES"));
            setMaxInput(snappedValues[1].toLocaleString("es-ES"));
          }}
          onValueCommit={(v) => {
            isDragging.current = false;
            // Final snap to base step on release
            const finalMin = roundToStep(localRange[0], baseStep);
            const finalMax = roundToStep(localRange[1], baseStep);
            const finalValues: [number, number] = [
              Math.max(minPrice, finalMin),
              Math.min(maxPrice, finalMax)
            ];
            setLocalRange(finalValues);
            setMinInput(finalValues[0].toLocaleString("es-ES"));
            setMaxInput(finalValues[1].toLocaleString("es-ES"));
            setPriceRange(finalValues);
          }}
          className="w-full"
        />
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">€</span>
            <input
              type="text"
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
              onBlur={() => {
                const num = Number(minInput.replace(/\D/g, ""));
                const rounded = Math.max(minPrice, Math.min(localRange[1], Math.round(num / 10) * 10));
                setLocalRange([rounded, localRange[1]]);
                setMinInput(rounded.toLocaleString("es-ES"));
                setPriceRange([rounded, localRange[1]]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onFocus={(e) => e.target.select()}
              className={cn(
                "w-full pl-7 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-1",
                listingType === "rent" ? "pr-12" : "pr-3"
              )}
              placeholder="Min"
            />
            {listingType === "rent" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">/mes</span>
            )}
          </div>
          <span className="text-stone-400">—</span>
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">€</span>
            <input
              type="text"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              onBlur={() => {
                const num = Number(maxInput.replace(/\D/g, ""));
                const rounded = Math.min(maxPrice, Math.max(localRange[0], Math.round(num / 10) * 10));
                setLocalRange([localRange[0], rounded]);
                setMaxInput(rounded.toLocaleString("es-ES"));
                setPriceRange([localRange[0], rounded]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onFocus={(e) => e.target.select()}
              className={cn(
                "w-full pl-7 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-1",
                listingType === "rent" ? "pr-12" : "pr-3"
              )}
              placeholder="Max"
            />
            {listingType === "rent" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">/mes</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
PriceRangeFilter.displayName = "PriceRangeFilter";

// Size Range Filter with local state for smooth dragging
const SizeRangeFilter = React.memo(({
  minSize,
  maxSize,
  sizeRange,
  setSizeRange,
}: {
  minSize: number;
  maxSize: number;
  sizeRange: [number, number];
  setSizeRange: (v: [number, number]) => void;
}) => {
  const [localRange, setLocalRange] = useState(sizeRange);
  const [minInput, setMinInput] = useState(sizeRange[0].toLocaleString("es-ES"));
  const [maxInput, setMaxInput] = useState(sizeRange[1].toLocaleString("es-ES"));
  const isDragging = useRef(false);
  const lastValue = useRef(sizeRange);
  const sizeRangeTotal = maxSize - minSize;
  const baseStep = 5; // 5m² base step

  // Sync local state when parent state changes (but not while dragging)
  useEffect(() => {
    if (!isDragging.current) {
      setLocalRange(sizeRange);
      setMinInput(sizeRange[0].toLocaleString("es-ES"));
      setMaxInput(sizeRange[1].toLocaleString("es-ES"));
      lastValue.current = sizeRange;
    }
  }, [sizeRange]);

  return (
    <div className="py-5 border-b border-stone-100">
      <h3 className="text-sm font-semibold text-stone-900 mb-3 tracking-tight flex items-center gap-2">
        <Maximize className="w-4 h-4 text-stone-500" />
        Superficie
      </h3>
      <div className="space-y-3">
        <Slider
          value={localRange}
          min={minSize}
          max={maxSize}
          step={1}
          onValueChange={(v) => {
            isDragging.current = true;
            const rawValues = v as [number, number];
            
            // Calculate adaptive steps based on drag speed
            const deltaMin = rawValues[0] - lastValue.current[0];
            const deltaMax = rawValues[1] - lastValue.current[1];
            
            const stepMin = getAdaptiveStep(deltaMin, sizeRangeTotal, baseStep);
            const stepMax = getAdaptiveStep(deltaMax, sizeRangeTotal, baseStep);
            
            const snappedMin = roundToStep(rawValues[0], stepMin);
            const snappedMax = roundToStep(rawValues[1], stepMax);
            
            // Clamp to bounds
            const finalMin = Math.max(minSize, Math.min(snappedMin, rawValues[1]));
            const finalMax = Math.min(maxSize, Math.max(snappedMax, rawValues[0]));
            
            const snappedValues: [number, number] = [finalMin, finalMax];
            lastValue.current = snappedValues;
            
            setLocalRange(snappedValues);
            setMinInput(snappedValues[0].toLocaleString("es-ES"));
            setMaxInput(snappedValues[1].toLocaleString("es-ES"));
          }}
          onValueCommit={(v) => {
            isDragging.current = false;
            // Final snap to base step on release
            const finalMin = roundToStep(localRange[0], baseStep);
            const finalMax = roundToStep(localRange[1], baseStep);
            const finalValues: [number, number] = [
              Math.max(minSize, finalMin),
              Math.min(maxSize, finalMax)
            ];
            setLocalRange(finalValues);
            setMinInput(finalValues[0].toLocaleString("es-ES"));
            setMaxInput(finalValues[1].toLocaleString("es-ES"));
            setSizeRange(finalValues);
          }}
          className="w-full"
        />
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
              onBlur={() => {
                const num = Number(minInput.replace(/\D/g, ""));
                const rounded = Math.max(minSize, Math.min(localRange[1], Math.round(num / 10) * 10));
                setLocalRange([rounded, localRange[1]]);
                setMinInput(rounded.toLocaleString("es-ES"));
                setSizeRange([rounded, localRange[1]]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onFocus={(e) => e.target.select()}
              className="w-full pl-3 pr-8 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-1"
              placeholder="Min"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">m²</span>
          </div>
          <span className="text-stone-400">—</span>
          <div className="flex-1 relative">
            <input
              type="text"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              onBlur={() => {
                const num = Number(maxInput.replace(/\D/g, ""));
                const rounded = Math.min(maxSize, Math.max(localRange[0], Math.round(num / 10) * 10));
                setLocalRange([localRange[0], rounded]);
                setMaxInput(rounded.toLocaleString("es-ES"));
                setSizeRange([localRange[0], rounded]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onFocus={(e) => e.target.select()}
              className="w-full pl-3 pr-8 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-1"
              placeholder="Max"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">m²</span>
          </div>
        </div>
      </div>
    </div>
  );
});
SizeRangeFilter.displayName = "SizeRangeFilter";

// Filter Section Component - MUST be outside main component to prevent re-renders
const FilterSection = ({ title, icon: Icon, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <div className="py-5 border-b border-stone-100 last:border-0">
    <h3 className="text-sm font-semibold text-stone-900 mb-3 tracking-tight flex items-center gap-2">
      {Icon && <Icon className="w-4 h-4 text-stone-500" />}
      {title}
    </h3>
    {children}
  </div>
);

export default function TestCataloguePage() {
  // Data state
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [domains, setDomains] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filter state
  const [listingType, setListingType] = useState<ListingType>("sale");
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<Set<string>>(new Set());
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000000]);
  const [sizeRange, setSizeRange] = useState<[number, number]>([0, 500]);
  const [bedroomMin, setBedroomMin] = useState<number>(0);
  const [bathroomMin, setBathroomMin] = useState<number>(0);
  const [hasFloorplan, setHasFloorplan] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active"); // Default to showing active only
  const [furnishedFilter, setFurnishedFilter] = useState<FurnishedFilter>("all");
  const [locationSearchInput, setLocationSearchInput] = useState<string>(""); // What user types
  const [locationFilter, setLocationFilter] = useState<string>(""); // Applied filter
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const locationInputRef = useRef<HTMLInputElement>(null);
  
  // UI state
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [popupListing, setPopupListing] = useState<Listing | null>(null);
  const [mapViewState, setMapViewState] = useState<Partial<ViewState>>({
    latitude: 40.0,
    longitude: -3.0,
    zoom: 5.5
  });
  // Circle radius for imprecise locations (in meters)
  const [impreciseCircle, setImpreciseCircle] = useState<{ lat: number; lng: number; radius: number } | null>(null);
  const pageSize = 24;
  
  // Mobile state
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Language state
  const [lang, setLang] = useState<Lang>('es');
  const t = TRANSLATIONS[lang];
  
  // Scroll position ref
  const scrollPositionRef = useRef(0);
  const mapRef = useRef<any>(null);
  
  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Prevent body scroll when mobile filters are open
  useEffect(() => {
    if (showMobileFilters) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showMobileFilters]);

  // Fetch data
  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/catalogue`);
      const json = await res.json();
      setAllListings(json.listings || []);
      setDomains(json.domains || {});
      setTotalCount(json.total || 0);
    } catch (e) {
      console.error("Failed to fetch:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#listing-")) {
        const id = hash.replace("#listing-", "");
        const listing = allListings.find(
          (l) => `${l.domain}-${l.listing_id}` === id
        );
        if (listing) {
          setSelectedListing(listing);
        }
      } else {
        setSelectedListing(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    handlePopState();
    
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allListings]);

  // Open listing detail
  const openListing = useCallback((listing: Listing) => {
    scrollPositionRef.current = window.scrollY;
    const id = `${listing.domain}-${listing.listing_id}`;
    window.history.pushState({ listing: id }, "", `#listing-${id}`);
    setSelectedListing(listing);
    window.scrollTo(0, 0);
  }, []);

  // Close listing detail
  const closeListing = useCallback(() => {
    window.history.pushState({}, "", window.location.pathname + window.location.search);
    setSelectedListing(null);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositionRef.current);
    });
  }, []);

  // Helper to check if listing matches listing type
  const matchesListingType = useCallback((l: Listing, type: ListingType): boolean => {
    const contractType = (l.contractType || l.contract_type || "").toLowerCase();
    
    // 1. Check explicit contract_type field
    if (contractType) {
      const isSale = contractType === "venta" || contractType === "sale" || contractType === "buy";
      const isRent = contractType === "alquiler" || contractType === "rent" || contractType === "rental";
      if (type === "sale") return isSale;
      if (type === "rent") return isRent;
    }
    
    // 2. Infer from URL (most reliable for Spanish sites)
    const url = (l.url || "").toLowerCase();
    if (url.includes("/venta/") || url.includes("/sale/") || url.includes("for-sale") || url.includes("-sale-")) {
      return type === "sale";
    }
    if (url.includes("/alquiler/") || url.includes("/rent/") || url.includes("for-rent") || url.includes("-rent-")) {
      return type === "rent";
    }
    
    // 3. Check title
    const title = (l.title || "").toLowerCase();
    if (title.includes("en venta") || title.includes("for sale")) return type === "sale";
    if (title.includes("en alquiler") || title.includes("for rent")) return type === "rent";
    
    // 4. Fallback to price heuristic
    const isSale = (l.price || 0) > 5000;
    return type === "sale" ? isSale : !isSale;
  }, []);

  // Compute price/size bounds from data - different for sale vs rent
  const { minPrice, maxPrice, minSize, maxSize } = useMemo(() => {
    let minP = Infinity, maxP = 0, minS = Infinity, maxS = 0;
    
    allListings.forEach(l => {
      // Only count listings matching current listing type
      if (matchesListingType(l, listingType)) {
        const price = l.price || 0;
        if (price > 0 && price < (listingType === "sale" ? 50000000 : 50000)) {
          if (price < minP) minP = price;
          if (price > maxP) maxP = price;
        }
      const area = l.sqm || l.areaM2 || l.area_m2 || 0;
        if (area > 0 && area < 2000) {
          if (area < minS) minS = area;
          if (area > maxS) maxS = area;
        }
      }
    });
    
    // Round to nice increments of 10
    const roundedMinP = minP === Infinity ? 0 : Math.floor(minP / 10) * 10;
    const roundedMaxP = maxP === 0 ? (listingType === "sale" ? 5000000 : 5000) : Math.ceil(maxP / 10) * 10;
    const roundedMinS = minS === Infinity ? 0 : Math.floor(minS / 10) * 10;
    const roundedMaxS = maxS === 0 ? 500 : Math.ceil(maxS / 10) * 10;
    
    return { 
      minPrice: roundedMinP,
      maxPrice: roundedMaxP, 
      minSize: roundedMinS,
      maxSize: roundedMaxS
    };
  }, [allListings, listingType, matchesListingType]);

  // Initialize/reset ranges when data loads or listing type changes
  useEffect(() => {
    setPriceRange([minPrice, maxPrice]);
    setSizeRange([minSize, maxSize]);
  }, [minPrice, maxPrice, minSize, maxSize, listingType]);

  // Extract unique locations for autocomplete with full context
  const uniqueLocations = useMemo(() => {
    const locationSet = new Map<string, { 
      type: 'city' | 'neighborhood' | 'province'; 
      count: number;
      displayName: string;  // Full display name (e.g., "Gràcia, Barcelona")
      searchKey: string;    // Key for filtering (just the name)
      parent?: string;      // Parent location for context
    }>();
    
    for (const l of allListings) {
      // Only include listings that match the current listing type
      if (!matchesListingType(l, listingType)) continue;
      
      // Check both top-level and nested location fields
      const city = (l.city || l.location?.city)?.trim();
      const neighborhood = (l.neighborhood || l.location?.neighborhood)?.trim();
      const province = (l.province || l.location?.province || l.region)?.trim();
      
      // Add city (with province context)
      if (city && city.length > 1) {
        const cityKey = city.toLowerCase();
        const existing = locationSet.get(`city:${cityKey}`);
        if (existing) {
          existing.count++;
        } else {
          const displayName = province && province.toLowerCase() !== city.toLowerCase() 
            ? `${city}, ${province}` 
            : city;
          locationSet.set(`city:${cityKey}`, { 
            type: 'city', 
            count: 1, 
            displayName,
            searchKey: cityKey,
            parent: province || undefined
          });
        }
      }
      
      // Add neighborhood (with city context)
      if (neighborhood && neighborhood.length > 1 && neighborhood.toLowerCase() !== city?.toLowerCase()) {
        const neighborhoodKey = neighborhood.toLowerCase();
        // Use composite key to handle same neighborhood name in different cities
        const compositeKey = city ? `neighborhood:${neighborhoodKey}:${city.toLowerCase()}` : `neighborhood:${neighborhoodKey}`;
        const existing = locationSet.get(compositeKey);
        if (existing) {
          existing.count++;
        } else {
          const displayName = city ? `${neighborhood}, ${city}` : neighborhood;
          locationSet.set(compositeKey, { 
            type: 'neighborhood', 
            count: 1, 
            displayName,
            searchKey: neighborhoodKey,
            parent: city || undefined
          });
        }
      }
      
      // Add province/region
      if (province && province.length > 1 && province.toLowerCase() !== city?.toLowerCase()) {
        const provinceKey = province.toLowerCase();
        const existing = locationSet.get(`province:${provinceKey}`);
        if (existing) {
          existing.count++;
        } else {
          locationSet.set(`province:${provinceKey}`, { 
            type: 'province', 
            count: 1, 
            displayName: province,
            searchKey: provinceKey
          });
        }
      }
    }
    
    // Convert to array and sort by count (most popular first)
    return Array.from(locationSet.values())
      .sort((a, b) => b.count - a.count);
  }, [allListings, listingType, matchesListingType]);

  // Normalize string for accent-insensitive comparison (á → a, ñ → n, etc.)
  const normalizeStr = useCallback((str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
      .trim();
  }, []);

  // Filter location suggestions based on search input
  const locationSuggestions = useMemo(() => {
    if (!locationSearchInput.trim()) return [];
    const searchNormalized = normalizeStr(locationSearchInput);
    return uniqueLocations
      .filter(loc => 
        normalizeStr(loc.searchKey).includes(searchNormalized) ||
        normalizeStr(loc.displayName).includes(searchNormalized)
      )
      .slice(0, 10); // Limit to 10 suggestions
  }, [uniqueLocations, locationSearchInput, normalizeStr]);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedSuggestionIndex(-1);
  }, [locationSuggestions]);

  // Handle selecting a location suggestion
  const handleSelectLocation = useCallback((displayName: string, searchKey: string) => {
    setLocationSearchInput(displayName);
    setLocationFilter(searchKey); // Use searchKey for filtering
    setShowLocationSuggestions(false);
    setHighlightedSuggestionIndex(-1);
  }, []);

  // Handle clearing location filter
  const handleClearLocation = useCallback(() => {
    setLocationSearchInput("");
    setLocationFilter("");
    setShowLocationSuggestions(false);
    setHighlightedSuggestionIndex(-1);
  }, []);

  // Handle keyboard navigation in location suggestions
  const handleLocationKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showLocationSuggestions || locationSuggestions.length === 0) {
      // If Enter pressed with no suggestions but input has value, try to apply it
      if (e.key === 'Enter' && locationSearchInput.trim()) {
        // Check if input matches any location (accent-insensitive)
        const inputNormalized = normalizeStr(locationSearchInput);
        const match = uniqueLocations.find(loc => 
          normalizeStr(loc.searchKey) === inputNormalized
        );
        if (match) {
          handleSelectLocation(match.displayName, match.searchKey);
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedSuggestionIndex(prev => 
          prev < locationSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : locationSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedSuggestionIndex >= 0 && highlightedSuggestionIndex < locationSuggestions.length) {
          const loc = locationSuggestions[highlightedSuggestionIndex];
          handleSelectLocation(loc.displayName, loc.searchKey);
        }
        break;
      case 'Escape':
        setShowLocationSuggestions(false);
        setHighlightedSuggestionIndex(-1);
        break;
    }
  }, [showLocationSuggestions, locationSuggestions, highlightedSuggestionIndex, locationSearchInput, uniqueLocations, handleSelectLocation, normalizeStr]);

  // Client-side filtering
  const filteredAndSorted = useMemo(() => {
    let result = [...allListings];

    // Always filter by listing type (sale vs rent) - use contractType field
    result = result.filter(l => matchesListingType(l, listingType));

    // Location filter - exact match at any level (city, neighborhood, province)
    // Only filter when a location has been explicitly selected
    if (locationFilter.trim()) {
      // Normalize function for accent-insensitive comparison
      const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const searchNorm = normalize(locationFilter);
      
      result = result.filter(l => {
        // Check both top-level and nested location fields
        const city = normalize(l.city || l.location?.city || '');
        const neighborhood = normalize(l.neighborhood || l.location?.neighborhood || '');
        const province = normalize(l.province || l.location?.province || l.region || '');
        
        // Check if any location field matches (accent-insensitive)
        return city === searchNorm || 
               neighborhood === searchNorm || 
               province === searchNorm ||
               city.includes(searchNorm) ||
               neighborhood.includes(searchNorm) ||
               province.includes(searchNorm);
      });
    }

    if (selectedDomains.size > 0) {
      result = result.filter(l => selectedDomains.has(l.domain));
    }

    if (selectedPropertyTypes.size > 0) {
      result = result.filter(l => {
        const type = (l.property_type || l.propertyType || l.type || l.title || "").toLowerCase();
        return Array.from(selectedPropertyTypes).some(pt => {
          const propType = PROPERTY_TYPES.find(p => p.id === pt);
          return propType?.keywords.some(kw => type.includes(kw));
        });
      });
    }

    result = result.filter(l => {
      const price = l.price || 0;
      return price >= priceRange[0] && price <= priceRange[1];
    });

    result = result.filter(l => {
      const area = l.sqm || l.areaM2 || l.area_m2 || 0;
      if (area === 0) return true;
      return area >= sizeRange[0] && area <= sizeRange[1];
    });

    if (bedroomMin > 0) {
      result = result.filter(l => (l.bedrooms || 0) >= bedroomMin);
    }

    if (bathroomMin > 0) {
      result = result.filter(l => (l.bathrooms || 0) >= bathroomMin);
    }

    if (selectedAmenities.size > 0) {
      result = result.filter(l => {
        return Array.from(selectedAmenities).every(amenityId => {
          const amenity = AMENITIES.find(a => a.id === amenityId);
          if (!amenity) return true;
          return (l as any)[amenity.field] === true;
        });
      });
    }

    // Floorplan filter
    if (hasFloorplan) {
      result = result.filter(l => l.photos_floorplan && l.photos_floorplan.length > 0);
    }

    // Status filter (sold/leased/reserved/removed)
    if (statusFilter !== "all") {
      result = result.filter(l => {
        const status = l.status?.toLowerCase() || "active";
        // Map various status values to our filter categories
        if (statusFilter === "active") {
          return status === "active" || !l.status;
        }
        if (statusFilter === "sold") {
          return status === "sold" || status === "vendido";
        }
        if (statusFilter === "leased") {
          return status === "leased" || status === "rented" || status === "alquilado";
        }
        if (statusFilter === "reserved") {
          return status === "reserved" || status === "reservado";
        }
        if (statusFilter === "removed") {
          return status === "removed";
        }
        return true;
      });
    }

    // Furnished filter (only applies to rentals)
    if (listingType === "rent" && furnishedFilter !== "all") {
      result = result.filter(l => {
        if (furnishedFilter === "furnished") {
          return l.is_furnished === true;
        }
        if (furnishedFilter === "unfurnished") {
          return l.is_furnished === false;
        }
        return true;
      });
    }

    const getAreaVal = (l: Listing) => l.sqm || l.areaM2 || l.area_m2 || 0;
    const getDate = (l: Listing) => l.first_seen || l.last_seen || "";
    const getPricePerM2 = (l: Listing) => {
      const area = getAreaVal(l);
      return area > 0 ? (l.price || 0) / area : Infinity;
    };

    result.sort((a, b) => {
      switch (sortBy) {
        case "latest": return getDate(b).localeCompare(getDate(a));
        case "oldest": return getDate(a).localeCompare(getDate(b));
        case "price_high": return (b.price || 0) - (a.price || 0);
        case "price_low": return (a.price || 0) - (b.price || 0);
        case "biggest": return getAreaVal(b) - getAreaVal(a);
        case "smallest": return getAreaVal(a) - getAreaVal(b);
        case "price_per_m2": return getPricePerM2(a) - getPricePerM2(b);
        default: return 0;
      }
    });

    return result;
  }, [allListings, listingType, locationFilter, selectedDomains, selectedPropertyTypes, priceRange, sizeRange, bedroomMin, bathroomMin, selectedAmenities, hasFloorplan, statusFilter, furnishedFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSorted.length / pageSize);
  const paginatedListings = filteredAndSorted.slice((page - 1) * pageSize, page * pageSize);

  // Memoize map GeoJSON data (expensive for 29k+ listings)
  const { listingsWithCoords, geojsonData } = useMemo(() => {
    const withCoords = filteredAndSorted.filter(l => {
      // Check both top-level and nested location for coordinates
      const lat = l.lat || l.latitude || l.location?.lat;
      const lng = l.lng || l.longitude || l.location?.lng;
      return lat !== undefined && lat !== null && lng !== undefined && lng !== null;
    });
    
    // Scatter overlapping coordinates slightly
    const coordCounts = new Map<string, number>();
    const getScatteredCoords = (lat: number, lng: number): [number, number] => {
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const count = coordCounts.get(key) || 0;
      coordCounts.set(key, count + 1);
      
      if (count === 0) return [lng, lat];
      
      const angle = (count * 137.5) * (Math.PI / 180);
      const distance = 0.0001 * Math.sqrt(count);
      return [lng + distance * Math.cos(angle), lat + distance * Math.sin(angle)];
    };
    
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: withCoords.map(listing => {
        // Check both top-level and nested location for coordinates
        const lat = listing.lat || listing.latitude || listing.location?.lat || 0;
        const lng = listing.lng || listing.longitude || listing.location?.lng || 0;
        const [scatteredLng, scatteredLat] = getScatteredCoords(lat, lng);
        
        return {
          type: "Feature" as const,
          properties: {
            id: `${listing.domain}-${listing.listing_id}`,
            price: listing.price,
            domain: listing.domain,
            city: listing.city || listing.location?.city || listing.neighborhood || listing.location?.neighborhood || "",
            bedrooms: listing.bedrooms || 0,
            sqm: listing.sqm || listing.areaM2 || listing.area_m2 || 0,
            precision: listing.coordinate_precision || listing.location?.coordinate_precision || 'unknown',
          },
          geometry: {
            type: "Point" as const,
            coordinates: [scatteredLng, scatteredLat]
          }
        };
      })
    };
    
    return { listingsWithCoords: withCoords, geojsonData: geojson };
  }, [filteredAndSorted]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [listingType, locationFilter, selectedDomains, selectedPropertyTypes, priceRange, sizeRange, bedroomMin, bathroomMin, selectedAmenities, hasFloorplan, statusFilter, furnishedFilter, sortBy]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    // listingType is not counted - it's a primary selector, not a filter
    if (locationFilter.trim()) count++;
    if (selectedDomains.size > 0) count++;
    if (selectedPropertyTypes.size > 0) count++;
    if (selectedAmenities.size > 0) count += selectedAmenities.size;
    if (priceRange[0] > minPrice || priceRange[1] < maxPrice) count++;
    if (sizeRange[0] > minSize || sizeRange[1] < maxSize) count++;
    if (bedroomMin > 0) count++;
    if (bathroomMin > 0) count++;
    if (hasFloorplan) count++;
    if (statusFilter !== "active") count++; // "active" is default, so count others
    if (listingType === "rent" && furnishedFilter !== "all") count++; // Only count for rentals
    return count;
  }, [listingType, locationFilter, selectedDomains, selectedPropertyTypes, selectedAmenities, priceRange, sizeRange, bedroomMin, bathroomMin, hasFloorplan, statusFilter, furnishedFilter, minPrice, maxPrice, minSize, maxSize]);

  const clearAllFilters = () => {
    // listingType is not cleared - it's a primary selector
    handleClearLocation();
    setSelectedDomains(new Set());
    setSelectedPropertyTypes(new Set());
    setSelectedAmenities(new Set());
    setPriceRange([minPrice, maxPrice]);
    setSizeRange([minSize, maxSize]);
    setBedroomMin(0);
    setBathroomMin(0);
    setHasFloorplan(false);
    setStatusFilter("active");
    setFurnishedFilter("all");
  };

  // Toggle helpers
  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const togglePropertyType = (type: string) => {
    setSelectedPropertyTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => {
      const next = new Set(prev);
      if (next.has(amenity)) next.delete(amenity);
      else next.add(amenity);
      return next;
    });
  };

  // Formatters
  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M €`;
    if (price >= 1000) return `${Math.round(price / 1000)}K €`;
    return `${price} €`;
  };

  const formatPriceFull = (price: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getPhotos = (listing: Listing): string[] => {
    return listing.photos || listing.image_urls || [];
  };

  const getArea = (listing: Listing): number | null => {
    return listing.sqm || listing.areaM2 || listing.area_m2 || null;
  };

  const getLocation = (listing: Listing): string => {
    // Check both top-level and nested location fields
    return listing.neighborhood || 
           listing.location?.neighborhood ||
           listing.city || 
           listing.location?.city ||
           listing.province || 
           listing.location?.province ||
           listing.region || 
           "España";
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  // Property Card Component
  const PropertyCard = ({ listing }: { listing: Listing }) => {
    const photos = getPhotos(listing);
    const area = getArea(listing);
    const isRental = listing.price < 5000;
    const pricePerM2 = area && area > 0 ? Math.round(listing.price / area) : null;
    const colors = DOMAIN_COLORS[listing.domain] || { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" };

    return (
      <Card 
        className="bg-white border-0 rounded-2xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group"
        onClick={() => openListing(listing)}
      >
        {/* Photo Carousel */}
        <div className="relative aspect-[4/3]">
          <PhotoCarousel photos={photos} className="w-full h-full" size="small" />
          
          {/* Time badge - top left */}
          {listing.first_seen && (
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium z-10">
              {formatDate(listing.first_seen)}
            </div>
          )}

          {/* Status overlay for sold/leased/reserved/removed */}
          {(() => {
            const status = listing.status?.toLowerCase();
            if (status === "sold" || status === "vendido") {
              return (
                <div className="absolute inset-0 bg-rose-900/70 backdrop-blur-sm flex items-center justify-center z-20">
              <span className="text-white font-bold text-lg tracking-wide">VENDIDO</span>
            </div>
              );
            }
            if (status === "leased" || status === "rented" || status === "alquilado") {
              return (
                <div className="absolute inset-0 bg-amber-900/70 backdrop-blur-sm flex items-center justify-center z-20">
                  <span className="text-white font-bold text-lg tracking-wide">ALQUILADO</span>
                </div>
              );
            }
            if (status === "reserved" || status === "reservado") {
              return (
                <div className="absolute inset-0 bg-blue-900/70 backdrop-blur-sm flex items-center justify-center z-20">
                  <span className="text-white font-bold text-lg tracking-wide">RESERVADO</span>
                </div>
              );
            }
            if (status === "removed") {
              return (
                <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center z-20">
                  <span className="text-white font-bold text-lg tracking-wide">NO DISPONIBLE</span>
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* Info */}
        <CardContent className="p-4">
          {/* Title */}
          {listing.title && (
            <p className="text-sm text-stone-600 line-clamp-1 mb-1">{listing.title}</p>
          )}
          
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-lg font-bold text-stone-900 tracking-tight">
              {formatPriceFull(listing.price)}
              {isRental && (
                <span className="text-sm font-normal text-stone-400">/mes</span>
              )}
            </p>
            {pricePerM2 && !isRental && (
              <span className="text-xs text-stone-400 font-medium">
                {pricePerM2.toLocaleString()}€/m²
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-stone-500 mb-2">
            {listing.bedrooms && (
              <span className="flex items-center gap-1">
                <Bed className="w-3.5 h-3.5" />
                {listing.bedrooms}
              </span>
            )}
            {listing.bathrooms && (
              <span className="flex items-center gap-1">
                <Bath className="w-3.5 h-3.5" />
                {listing.bathrooms}
              </span>
            )}
            {area && (
              <span className="flex items-center gap-1">
                <Maximize className="w-3.5 h-3.5" />
                {area}m²
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 text-sm text-stone-400">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="line-clamp-1">{getLocation(listing)}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Handler to open map view zoomed to a specific location
  const handleOpenMapView = useCallback((lat: number, lng: number) => {
    // Close detail view
    closeListing();
    // Set map view to neighborhood zoom
    setMapViewState({
      latitude: lat,
      longitude: lng,
      zoom: 15
    });
    // Switch to map view
    setViewMode("map");
  }, [closeListing]);

  // If a listing is selected, show detail view
  if (selectedListing) {
    return <DetailView listing={selectedListing} onClose={closeListing} onOpenMapView={handleOpenMapView} lang={lang} />;
  }

  // Filter content (shared between desktop sidebar and mobile modal)
  const FilterContent = () => (
    <>
      {/* Listing Type - Primary selector (Venta / Alquiler) */}
      <FilterSection title={t.operationType}>
              <div className="flex gap-2">
                {[
            { value: "sale", label: t.sale },
            { value: "rent", label: t.rent },
                ].map((type) => (
                  <button
                    key={type.value}
              onClick={() => {
                setListingType(type.value as ListingType);
                setStatusFilter("active");
                if (type.value === "sale") {
                  setFurnishedFilter("all");
                }
              }}
                    className={cn(
                "flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all",
                      listingType === type.value
                  ? "bg-stone-900 text-white shadow-md"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </FilterSection>

      {/* Location Search */}
      <FilterSection title={t.location} icon={MapPin}>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              ref={locationInputRef}
              type="text"
              placeholder={t.searchLocation}
              value={locationSearchInput}
              onChange={(e) => {
                setLocationSearchInput(e.target.value);
                setShowLocationSuggestions(true);
                if (locationFilter && e.target.value !== locationFilter) {
                  setLocationFilter("");
                }
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
              onKeyDown={handleLocationKeyDown}
              className={cn(
                "w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 capitalize",
                locationFilter ? "border-stone-400 bg-stone-50" : "border-stone-200"
              )}
            />
            {locationSearchInput && (
                      <button
                onClick={handleClearLocation}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-stone-400" />
              </button>
            )}
          </div>
          
          {/* Location Suggestions */}
          {showLocationSuggestions && locationSuggestions.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {locationSuggestions.map((loc, index) => (
                <button
                  key={`${loc.type}:${loc.searchKey}`}
                  onClick={() => handleSelectLocation(loc.displayName, loc.searchKey)}
                        className={cn(
                    "w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50 flex items-center justify-between gap-2 transition-colors",
                    index === highlightedSuggestionIndex && "bg-stone-100"
                        )}
                      >
                  <div className="flex items-center gap-2">
                    <span className="capitalize font-medium text-stone-900">{loc.displayName}</span>
                    <span className="text-xs text-stone-400 capitalize">
                      {loc.type === 'city' ? '🏙️' : loc.type === 'neighborhood' ? '📍' : '🗺️'}
                          </span>
                        </div>
                  <span className="text-xs text-stone-400">{loc.count}</span>
                </button>
              ))}
                        </div>
          )}
          
          {/* Quick location tags */}
          {!locationFilter && !locationSearchInput && uniqueLocations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {uniqueLocations
                .filter(loc => loc.type === 'city')
                .slice(0, 5)
                .map((loc) => (
                  <button
                    key={`${loc.type}:${loc.searchKey}`}
                    onClick={() => handleSelectLocation(loc.displayName, loc.searchKey)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                  >
                    {loc.displayName}
                      </button>
                ))
              }
            </div>
          )}
        </div>
      </FilterSection>

      {/* Status Filter */}
      <FilterSection title={t.propertyStatus}>
        <div className="flex flex-wrap gap-2">
          {(listingType === "sale" 
            ? [
                { value: "all", label: t.all, color: "bg-stone-100 text-stone-600" },
                { value: "active", label: t.active, color: "bg-emerald-100 text-emerald-700" },
                { value: "sold", label: t.sold, color: "bg-rose-100 text-rose-700" },
                { value: "reserved", label: t.reserved, color: "bg-blue-100 text-blue-700" },
                { value: "removed", label: t.unavailable, color: "bg-stone-200 text-stone-500" },
              ]
            : [
                { value: "all", label: t.all, color: "bg-stone-100 text-stone-600" },
                { value: "active", label: t.active, color: "bg-emerald-100 text-emerald-700" },
                { value: "leased", label: t.leased, color: "bg-amber-100 text-amber-700" },
                { value: "reserved", label: t.reserved, color: "bg-blue-100 text-blue-700" },
                { value: "removed", label: t.unavailable, color: "bg-stone-200 text-stone-500" },
              ]
          ).map((status) => (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value as StatusFilter)}
              className={cn(
                "py-1.5 px-3 rounded-full text-sm font-medium transition-all border",
                statusFilter === status.value
                  ? `${status.color} border-current`
                  : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
              )}
            >
              {status.label}
            </button>
          ))}
              </div>
            </FilterSection>

            {/* Property Types */}
      <FilterSection title={t.propertyType}>
              <div className="flex flex-wrap gap-2">
          {[
            { id: "apartment", labelKey: "apartment" as const },
            { id: "house", labelKey: "house" as const },
            { id: "penthouse", labelKey: "penthouse" as const },
            { id: "studio", labelKey: "studio" as const },
            { id: "duplex", labelKey: "duplex" as const },
            { id: "other", labelKey: "other" as const },
          ].map((type) => {
                  const isSelected = selectedPropertyTypes.has(type.id);
                  return (
                    <button
                      key={type.id}
                      onClick={() => togglePropertyType(type.id)}
                      className={cn(
                        "py-1.5 px-3 rounded-full text-sm font-medium transition-all border",
                        isSelected
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                      )}
                    >
                {t[type.labelKey]}
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            {/* Price Range */}
      <PriceRangeFilter
        listingType={listingType}
        minPrice={minPrice}
        maxPrice={maxPrice}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
      />

            {/* Size Range */}
      <SizeRangeFilter
        minSize={minSize}
        maxSize={maxSize}
        sizeRange={sizeRange}
        setSizeRange={setSizeRange}
      />

            {/* Bedrooms */}
      <FilterSection title={t.bedrooms} icon={Bed}>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setBedroomMin(num)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                      bedroomMin === num
                        ? "bg-stone-900 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    )}
                  >
              {num === 0 ? t.any : num === 5 ? "5+" : num}
                  </button>
                ))}
              </div>
            </FilterSection>

      {/* Bathrooms */}
      <FilterSection title={t.bathrooms} icon={Bath}>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((num) => (
            <button
              key={num}
              onClick={() => setBathroomMin(num)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                bathroomMin === num
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              {num === 0 ? t.any : num === 4 ? "4+" : num}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Furnished Filter - Only for rentals */}
      {listingType === "rent" && (
        <FilterSection title={t.furnishing} icon={Sofa}>
          <div className="flex gap-2">
            {[
              { value: "all", label: t.all },
              { value: "furnished", label: t.furnished },
              { value: "unfurnished", label: t.unfurnished },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFurnishedFilter(option.value as FurnishedFilter)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                  furnishedFilter === option.value
                    ? "bg-stone-900 text-white shadow-sm"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                )}
              >
                {option.value === "furnished" && <Sofa className="w-4 h-4" />}
                {option.label}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

            {/* Amenities */}
      <FilterSection title={t.features}>
              <div className="grid grid-cols-2 gap-2">
          {[
            { id: "terrace", labelKey: "terrace" as const, icon: Flame },
            { id: "balcony", labelKey: "balcony" as const, icon: Square },
            { id: "pool", labelKey: "pool" as const, icon: Waves },
            { id: "parking", labelKey: "parking" as const, icon: Car },
            { id: "elevator", labelKey: "elevator" as const, icon: Sparkles },
            { id: "ac", labelKey: "ac" as const, icon: Wind },
            { id: "garden", labelKey: "garden" as const, icon: TreePine },
            { id: "storage", labelKey: "storage" as const, icon: Home },
          ].map((amenity) => {
                  const isSelected = selectedAmenities.has(amenity.id);
                  const Icon = amenity.icon;
                  return (
                    <button
                      key={amenity.id}
                      onClick={() => toggleAmenity(amenity.id)}
                      className={cn(
                        "flex items-center gap-2 py-2.5 px-3 rounded-lg text-sm transition-all border",
                        isSelected
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                <span className="font-medium">{t[amenity.labelKey]}</span>
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            {/* Floorplan */}
      <FilterSection title={t.floorplans}>
              <button
                onClick={() => setHasFloorplan(!hasFloorplan)}
                className={cn(
                  "w-full flex items-center justify-between py-3 px-4 rounded-lg transition-all border",
                  hasFloorplan
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <LayoutPanelLeft className="w-5 h-5" />
            <span className="font-medium">{t.hasFloorplan}</span>
                </div>
                {hasFloorplan && <Check className="w-5 h-5" />}
              </button>
            </FilterSection>

      {/* Agencies */}
      <FilterSection title={t.agencies}>
        <div className="space-y-2">
          {Object.entries(domains)
            .sort((a, b) => b[1] - a[1])
            .map(([domain, count]) => {
              const colors = DOMAIN_COLORS[domain] || { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" };
              const isSelected = selectedDomains.has(domain);
              return (
                <button
                  key={domain}
                  onClick={() => toggleDomain(domain)}
                  className={cn(
                    "w-full flex items-center justify-between py-2 px-3 rounded-lg transition-all text-left",
                    isSelected ? colors.bg : "hover:bg-stone-50"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-2 h-2 rounded-full", colors.dot)} />
                    <span className={cn("text-sm font-medium", isSelected ? colors.text : "text-stone-700")}>
                      {DOMAIN_NAMES[domain] || domain}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 tabular-nums">{count.toLocaleString()}</span>
                    {isSelected && <Check className="w-4 h-4 text-stone-900" />}
                  </div>
                </button>
              );
            })}
        </div>
      </FilterSection>
    </>
  );

  // Otherwise show catalogue
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Mobile Filters Modal - Fullscreen */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 bg-white md:hidden overflow-y-auto">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white z-10 px-4 py-4 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="w-5 h-5 text-stone-700" />
              <h2 className="text-lg font-bold text-stone-900">{t.filters}</h2>
              {activeFilterCount > 0 && (
                <span className="bg-stone-900 text-white text-xs px-2 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowMobileFilters(false)}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Filter Content */}
          <div className="px-4 pb-24">
            <FilterContent />
          </div>
          
          {/* Apply Button - Fixed at bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 md:hidden">
            <button
              onClick={() => setShowMobileFilters(false)}
              className="w-full py-4 bg-stone-900 text-white font-semibold rounded-xl hover:bg-stone-800 transition-colors"
            >
              {lang === 'es' ? `Ver ${filteredAndSorted.length.toLocaleString()} inmuebles` : `Show ${filteredAndSorted.length.toLocaleString()} properties`}
            </button>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Left Sidebar - Filters (Desktop only) */}
        <aside className="hidden md:block w-80 flex-shrink-0 h-screen sticky top-0 overflow-y-auto bg-white border-r border-stone-200">
          {/* Sidebar Header */}
          <div className="sticky top-0 bg-white z-10 px-6 py-5 border-b border-stone-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-stone-700" />
                <h2 className="text-lg font-bold text-stone-900">{t.filters}</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Language Toggle */}
                <button
                  onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors text-sm font-medium text-stone-700"
                  title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
                >
                  <Globe className="w-4 h-4" />
                  <span className="uppercase">{lang === 'es' ? 'EN' : 'ES'}</span>
                </button>
                {activeFilterCount > 0 && (
                  <button 
                    onClick={clearAllFilters}
                    className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t.clearFilters}
                  </button>
                )}
              </div>
            </div>
            
            {/* Results count */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-stone-900 tabular-nums">
                {filteredAndSorted.length.toLocaleString()}
              </span>
              <span className="text-stone-500 text-sm">
                {t.of} {totalCount.toLocaleString()} {t.properties}
              </span>
            </div>
          </div>
          
          {/* Desktop Filter Sections */}
          <div className="px-6">
            <FilterContent />
          </div>
        </aside>

        {/* Main Content */}
        <main className={cn(
          "flex-1",
          // On mobile map view, remove min-height to allow fullscreen
          viewMode === "map" && isMobile ? "" : "min-h-screen"
        )}>
          {/* Top Bar - responsive */}
          <div className={cn(
            "sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-stone-200",
            // Hide on mobile map view
            viewMode === "map" && isMobile && "hidden"
          )}>
            <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2">
              {/* Mobile: Filter button + Count */}
              <div className="flex items-center gap-2 md:hidden">
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="text-sm font-medium">{t.filters}</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-stone-900 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <div className="text-sm text-stone-500">
                  <span className="font-semibold text-stone-900">{filteredAndSorted.length.toLocaleString()}</span> {t.properties}
                </div>
              </div>
              
              {/* Desktop: Title */}
              <div className="hidden md:flex items-center gap-3">
                <Building2 className="w-6 h-6 text-stone-700" />
                <h1 className="text-lg font-bold text-stone-900">{t.catalogue}</h1>
              </div>
              
              <div className="flex items-center gap-2 md:gap-3">
                {/* Language toggle - mobile */}
                <button
                  onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
                  className="md:hidden flex items-center gap-1 px-2 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors text-sm font-medium text-stone-700"
                >
                  <Globe className="w-4 h-4" />
                </button>
                
                {/* Sort - hidden on mobile, shown as icon only */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="hidden md:block py-2 px-3 pr-8 rounded-lg border border-stone-200 text-sm font-medium text-stone-700 bg-white hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                >
                  {[
                    { value: "latest", labelKey: "latest" as const },
                    { value: "price_low", labelKey: "priceLowHigh" as const },
                    { value: "price_high", labelKey: "priceHighLow" as const },
                    { value: "biggest", labelKey: "biggest" as const },
                    { value: "smallest", labelKey: "smallest" as const },
                    { value: "price_per_m2", labelKey: "bestPricePerM2" as const },
                  ].map((opt) => (
                    <option key={opt.value} value={opt.value}>{t[opt.labelKey]}</option>
                  ))}
                </select>

                {/* View toggle */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-stone-100">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      viewMode === "grid" ? "bg-white shadow-sm text-stone-900" : "text-stone-400 hover:text-stone-600"
                    )}
                    title={t.grid}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-2 rounded-md transition-all hidden md:block", // Hide list on mobile
                      viewMode === "list" ? "bg-white shadow-sm text-stone-900" : "text-stone-400 hover:text-stone-600"
                    )}
                    title={t.list}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("map")}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      viewMode === "map" ? "bg-white shadow-sm text-stone-900" : "text-stone-400 hover:text-stone-600"
                    )}
                    title={t.map}
                  >
                    <MapIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Refresh */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchListings}
                  disabled={loading}
                  className="rounded-lg"
                >
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </div>

          {/* Map View - Full height when active */}
          {viewMode === "map" ? (
            (() => {
              // GeoJSON data is now memoized above (listingsWithCoords, geojsonData)
              
              // GeoJSON for imprecise circle overlay
              const circleGeoJson: GeoJSON.FeatureCollection | null = impreciseCircle ? {
                type: "FeatureCollection",
                features: [{
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Point",
                    coordinates: [impreciseCircle.lng, impreciseCircle.lat]
                  }
                }]
              } : null;

              // Cluster layer style - consistent color
              const clusterLayer: CircleLayer = {
                id: "clusters",
                type: "circle",
                source: "listings",
                filter: ["has", "point_count"],
                paint: {
                  "circle-color": "#da654d",
                  "circle-radius": [
                    "step",
                    ["get", "point_count"],
                    18,  // < 10
                    10,
                    24,  // 10-50
                    50,
                    30   // 50+
                  ],
                  "circle-stroke-width": 2,
                  "circle-stroke-color": "#fff"
                }
              };

              const clusterCountLayer: SymbolLayer = {
                id: "cluster-count",
                type: "symbol",
                source: "listings",
                filter: ["has", "point_count"],
                layout: {
                  "text-field": ["get", "point_count_abbreviated"],
                  "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                  "text-size": 12
                },
                paint: {
                  "text-color": "#fff"
                }
              };

              const unclusteredPointLayer: CircleLayer = {
                id: "unclustered-point",
                type: "circle",
                source: "listings",
                filter: ["!", ["has", "point_count"]],
                paint: {
                  "circle-color": "#da654d",
                  "circle-radius": 8,
                  "circle-stroke-width": 2,
                  "circle-stroke-color": "#fff"
                }
              };

              // Popup card component - matches grid PropertyCard style (minus location)
              const PopupCard = ({ listing }: { listing: Listing }) => {
                const photos = getPhotos(listing);
                const area = getArea(listing);
                const isRental = listing.price < 5000;
                const pricePerM2 = area && area > 0 ? Math.round(listing.price / area) : null;
                const colors = DOMAIN_COLORS[listing.domain] || { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" };
                const [photoIndex, setPhotoIndex] = useState(0);
                
                const prevPhoto = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setPhotoIndex(prev => prev === 0 ? photos.length - 1 : prev - 1);
                };
                
                const nextPhoto = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setPhotoIndex(prev => prev === photos.length - 1 ? 0 : prev + 1);
                };

                return (
                  <div 
                    className="w-[280px] bg-white rounded-2xl overflow-hidden shadow-2xl cursor-pointer transition-all hover:shadow-xl"
                    onClick={(e) => {
                      // Only open listing if not clicking carousel buttons
                      const target = e.target as HTMLElement;
                      if (!target.closest('button')) {
                        openListing(listing);
                      }
                    }}
                  >
                    {/* Photo section */}
                    <div className="relative aspect-[4/3] group">
                      {photos.length > 0 ? (
                        <img
                          src={photos[photoIndex]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                          <Home className="w-10 h-10 text-stone-300" />
                        </div>
                      )}
                      
                      {/* Time badge - top left */}
                      {listing.first_seen && (
                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium z-10">
                          {formatDate(listing.first_seen)}
                        </div>
                      )}
                      
                      {/* Close button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopupListing(null);
                          setImpreciseCircle(null);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center z-20"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      
                      {/* Navigation arrows */}
                      {photos.length > 1 && (
                        <>
                          <button
                            onClick={prevPhoto}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={nextPhoto}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      
                      {/* Photo dots */}
                      {photos.length > 1 && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {photos.slice(0, 5).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full transition-all",
                                i === photoIndex ? "bg-white" : "bg-white/50"
                              )}
                            />
                          ))}
                        </div>
                      )}

                      {/* Status overlay for sold/leased/reserved/removed */}
                      {(() => {
                        const status = listing.status?.toLowerCase();
                        if (status === "sold" || status === "vendido") {
                          return (
                            <div className="absolute inset-0 bg-rose-900/70 backdrop-blur-sm flex items-center justify-center z-20">
                          <span className="text-white font-bold text-lg tracking-wide">VENDIDO</span>
                        </div>
                          );
                        }
                        if (status === "leased" || status === "rented" || status === "alquilado") {
                          return (
                            <div className="absolute inset-0 bg-amber-900/70 backdrop-blur-sm flex items-center justify-center z-20">
                              <span className="text-white font-bold text-lg tracking-wide">ALQUILADO</span>
                            </div>
                          );
                        }
                        if (status === "reserved" || status === "reservado") {
                          return (
                            <div className="absolute inset-0 bg-blue-900/70 backdrop-blur-sm flex items-center justify-center z-20">
                              <span className="text-white font-bold text-lg tracking-wide">RESERVADO</span>
                            </div>
                          );
                        }
                        if (status === "removed") {
                          return (
                            <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center z-20">
                              <span className="text-white font-bold text-lg tracking-wide">NO DISPONIBLE</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    
                    {/* Info section - matches PropertyCard style */}
                    <div className="p-4">
                      {/* Title */}
                      {listing.title && (
                        <p className="text-sm text-stone-600 line-clamp-1 mb-1">{listing.title}</p>
                      )}
                      
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-lg font-bold text-stone-900 tracking-tight">
                          {formatPriceFull(listing.price)}
                          {isRental && (
                            <span className="text-sm font-normal text-stone-400">/mes</span>
                          )}
                        </p>
                        {pricePerM2 && !isRental && (
                          <span className="text-xs text-stone-400 font-medium">
                            {pricePerM2.toLocaleString()}€/m²
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm text-stone-500">
                        {listing.bedrooms && (
                          <span className="flex items-center gap-1">
                            <Bed className="w-3.5 h-3.5" />
                            {listing.bedrooms}
                          </span>
                        )}
                        {listing.bathrooms && (
                          <span className="flex items-center gap-1">
                            <Bath className="w-3.5 h-3.5" />
                            {listing.bathrooms}
                          </span>
                        )}
                        {area && (
                          <span className="flex items-center gap-1">
                            <Maximize className="w-3.5 h-3.5" />
                            {area}m²
                          </span>
                        )}
                      </div>
                      
                      {/* Imprecise location indicator - only show if no street address */}
                      {(() => {
                        const address = listing.address || '';
                        const streetPatterns = /\b(calle|c\/|c\.|carrer|avenida|av\.|avda\.|plaza|pl\.|paseo|pº|ronda|travesía|camino|urbanización|urb\.)/i;
                        const hasStreetAddress = streetPatterns.test(address) || listing.coordinate_precision === 'precise';
                        const isImprecise = listing.coordinate_precision === 'city_center' || 
                                           listing.coordinate_precision === 'approximate' ||
                                           listing.coordinate_precision === 'unknown';
                        
                        if (hasStreetAddress || !isImprecise) return null;
                        
                        return (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
                            <MapPin className="w-3 h-3" />
                            <span>
                              {listing.coordinate_precision === 'city_center' 
                                ? `${t.approximateLocation} ${t.areaLevel}` 
                                : listing.coordinate_precision === 'approximate'
                                ? `${t.approximateLocation} ${t.neighborhoodLevel}`
                                : t.unverifiedLocation}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              };

              return (
                <div 
                  className="relative" 
                  style={{ 
                    // Fullscreen on mobile, calc height on desktop
                    height: isMobile ? "100vh" : "calc(100vh - 73px)" 
                  }}
                >
                  {/* Close/Hide map button - top right */}
                  <button
                    onClick={() => setViewMode("grid")}
                    className="absolute top-4 right-4 z-10 flex items-center gap-2 px-4 py-2 bg-white hover:bg-stone-50 rounded-full shadow-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span className="text-sm font-medium">{lang === 'es' ? 'Cerrar Mapa' : 'Hide Map'}</span>
                  </button>
                  
                  <MapGL
                    ref={mapRef}
                    {...mapViewState}
                    onMove={(evt) => setMapViewState(evt.viewState as Partial<ViewState>)}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle="mapbox://styles/mapbox/light-v11"
                    mapboxAccessToken={MAPBOX_TOKEN}
                    interactiveLayerIds={["clusters", "unclustered-point"]}
                    onClick={(e) => {
                      // Check if clicked on a cluster or point
                      const features = e.features;
                      if (features && features.length > 0) {
                        const feature = features[0];
                        if (feature.properties?.cluster) {
                          // It's a cluster - zoom in
                          setPopupListing(null);
                          const clusterId = feature.properties.cluster_id;
                          const mapboxSource = e.target.getSource("listings") as any;
                          mapboxSource.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
                            if (err) return;
                            e.target.easeTo({
                              center: (feature.geometry as any).coordinates,
                              zoom: zoom
                            });
                          });
                        } else {
                          // It's an individual point
                          const listingId = feature.properties?.id;
                          const precision = feature.properties?.precision || 'unknown';
                          if (listingId) {
                            const listing = listingsWithCoords.find(l => 
                              `${l.domain}-${l.listing_id}` === listingId
                            );
                            if (listing) {
                              // On mobile: go directly to detail view (like Airbnb)
                              if (isMobile) {
                                openListing(listing);
                                return;
                              }
                              
                              // On desktop: show popup card
                              const coords = (feature.geometry as any).coordinates;
                              const currentZoom = e.target.getZoom();
                              
                              setPopupListing(listing);
                              
                              // Check if listing has a street-level address
                              const address = listing.address || '';
                              const streetPatterns = /\b(calle|c\/|c\.|carrer|avenida|av\.|avda\.|plaza|pl\.|paseo|pº|ronda|travesía|camino|urbanización|urb\.)/i;
                              const hasStreetAddress = streetPatterns.test(address) || precision === 'precise';
                              
                              // Only show circle for truly imprecise locations (no street address)
                              if (!hasStreetAddress && (precision === 'city_center' || precision === 'approximate' || precision === 'unknown')) {
                                const radiusMap: Record<string, number> = {
                                  'city_center': 5000,
                                  'approximate': 2000,
                                  'unknown': 3000
                                };
                                const radius = radiusMap[precision] || 3000;
                                setImpreciseCircle({
                                  lat: coords[1],
                                  lng: coords[0],
                                  radius
                                });
                              } else {
                                setImpreciseCircle(null);
                              }
                              
                              // Just pan to show popup (no zoom changes)
                              const latOffset = 0.15 / Math.pow(2, currentZoom - 6);
                              e.target.easeTo({
                                center: [coords[0], coords[1] + latOffset],
                                duration: 300
                              });
                            }
                          }
                        }
                      } else {
                        // Clicked on empty map area - close popup
                        setPopupListing(null);
                        setImpreciseCircle(null);
                      }
                    }}
                    cursor="pointer"
                  >
                    <NavigationControl position="bottom-right" />
                    
                    <Source
                      id="listings"
                      type="geojson"
                      data={geojsonData}
                      cluster={true}
                      clusterMaxZoom={14}
                      clusterRadius={50}
                    >
                      <Layer {...clusterLayer} />
                      <Layer {...clusterCountLayer} />
                      <Layer {...unclusteredPointLayer} />
                    </Source>
                    
                    {/* Imprecise location circle overlay */}
                    {impreciseCircle && (() => {
                      // Create a circle polygon from center + radius
                      const createCirclePolygon = (centerLng: number, centerLat: number, radiusMeters: number, points = 64): GeoJSON.Feature => {
                        const coords: [number, number][] = [];
                        const distanceX = radiusMeters / (111320 * Math.cos(centerLat * Math.PI / 180));
                        const distanceY = radiusMeters / 110540;
                        
                        for (let i = 0; i <= points; i++) {
                          const angle = (i / points) * 2 * Math.PI;
                          const lng = centerLng + distanceX * Math.cos(angle);
                          const lat = centerLat + distanceY * Math.sin(angle);
                          coords.push([lng, lat]);
                        }
                        
                        return {
                          type: "Feature",
                          properties: {},
                          geometry: {
                            type: "Polygon",
                            coordinates: [coords]
                          }
                        };
                      };
                      
                      const circleFeature = createCirclePolygon(
                        impreciseCircle.lng,
                        impreciseCircle.lat,
                        impreciseCircle.radius
                      );
                      
                      return (
                        <Source
                          id="imprecise-circle"
                          type="geojson"
                          data={{
                            type: "FeatureCollection",
                            features: [circleFeature]
                          }}
                        >
                          <Layer
                            id="imprecise-circle-fill"
                            type="fill"
                            paint={{
                              "fill-color": "#da654d",
                              "fill-opacity": 0.08
                            }}
                          />
                          <Layer
                            id="imprecise-circle-line"
                            type="line"
                            paint={{
                              "line-color": "#da654d",
                              "line-width": 2,
                              "line-dasharray": [2, 2],
                              "line-opacity": 0.5
                            }}
                          />
                        </Source>
                      );
                    })()}
                    
                    {/* Popup for selected listing */}
                    {popupListing && (
                      <Popup
                        latitude={popupListing.lat || popupListing.latitude || 0}
                        longitude={popupListing.lng || popupListing.longitude || 0}
                        anchor="bottom"
                        closeButton={false}
                        closeOnClick={false}
                        offset={15}
                        className="map-popup"
                      >
                        <PopupCard listing={popupListing} />
                      </Popup>
                    )}
                  </MapGL>
                  
                  {/* Floating info - hidden on mobile (has back button instead) */}
                  <div className="hidden md:block absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg">
                    <div className="text-sm">
                      <span className="font-bold text-stone-900">{listingsWithCoords.length.toLocaleString()}</span>
                      <span className="text-stone-500"> {t.propertiesOnMap}</span>
                    </div>
                    <div className="text-xs text-stone-400 mt-1">
                      {t.clickForDetails}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            /* Listings Grid/List */
            <div className="p-6">
              {loading ? (
                <div className={cn(
                  "grid gap-5",
                  viewMode === "grid" 
                    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                    : "grid-cols-1"
                )}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Card key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse border-0 shadow-sm">
                      <div className="aspect-[4/3] bg-gradient-to-br from-stone-100 to-stone-200" />
                      <CardContent className="p-4">
                        <div className="h-5 bg-stone-200 rounded-full mb-3 w-28" />
                        <div className="h-4 bg-stone-100 rounded-full mb-2 w-36" />
                        <div className="h-4 bg-stone-100 rounded-full w-24" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : paginatedListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center mb-4">
                    <Home className="w-10 h-10 text-stone-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-stone-900 mb-2">
                    {t.noResults}
                  </h3>
                  <p className="text-stone-500 text-center max-w-md">
                    {t.tryAdjustingFilters}
                  </p>
                  {activeFilterCount > 0 && (
                    <Button 
                      variant="outline" 
                      onClick={clearAllFilters}
                      className="mt-4 rounded-lg"
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className={cn(
                    "grid gap-5",
                    viewMode === "grid" 
                      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                      : "grid-cols-1 max-w-3xl"
                  )}>
                    {paginatedListings.map((listing) => (
                      <PropertyCard 
                        key={`${listing.domain}-${listing.listing_id}`} 
                        listing={listing} 
                      />
                    ))}
                  </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (page <= 4) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 3) {
                          pageNum = totalPages - 6 + i;
                        } else {
                          pageNum = page - 3 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={cn(
                              "w-9 h-9 rounded-lg text-sm font-medium transition-all",
                              page === pageNum
                                ? "bg-stone-900 text-white"
                                : "text-stone-600 hover:bg-stone-100"
                            )}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="rounded-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          )}
        </main>
      </div>
    </div>
  );
}
