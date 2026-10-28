'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  MapPin, 
  Bed, 
  Bath, 
  Ruler, 
  Building2, 
  Pencil, 
  Check,
  ExternalLink,
  Loader2,
  Home,
  Waves,
  Trees,
  Car,
  Wind,
  DoorOpen,
  ArrowUpDown,
  StickyNote,
  User,
  ChevronDown
} from 'lucide-react';

interface PhotoData {
  url: string;
  label?: string;
}

interface ListingData {
  title?: string;
  address?: string;
  city?: string;
  region?: string;
  price_eur?: number;
  bedrooms?: number;
  bathrooms?: number;
  m2_built?: number;
  m2_useful?: number;
  description?: string;
  source_url?: string;
  reference?: string;
  floor_level?: string;
  floor_number?: number;
  condition?: string;
  property_subtype?: string;
  has_elevator?: boolean;
  is_exterior?: boolean;
  has_terrace?: boolean;
  has_balcony?: boolean;
  has_pool?: boolean;
  has_garage?: boolean;
  has_garden?: boolean;
  has_air_conditioning?: boolean;
  agency?: {
    name?: string;
    logo_url?: string;
  };
}

interface ListingReviewModeProps {
  data: ListingData;
  photos: PhotoData[];
  isResolvingLocation: boolean;
  isLocationResolved: boolean;
  onEdit: () => void;
  onAnalyse: (notes: string) => void;
  isSubmitting: boolean;
  initialNotes?: string;
}

export function ListingReviewMode(props: ListingReviewModeProps) {
  const {
    data,
    photos,
    isResolvingLocation,
    isLocationResolved,
    onEdit,
    onAnalyse,
    isSubmitting,
    initialNotes = ''
  } = props;

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [showDescription, setShowDescription] = useState(false);

  useEffect(() => {
    if (photos.length <= 1 || isCarouselHovered) return;
    const interval = setInterval(() => {
      setCurrentPhotoIndex(prev => (prev + 1) % photos.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [photos.length, isCarouselHovered]);

  const nextPhoto = useCallback(() => {
    setCurrentPhotoIndex(prev => (prev + 1) % photos.length);
  }, [photos.length]);

  const prevPhoto = useCallback(() => {
    setCurrentPhotoIndex(prev => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPhoto, prevPhoto]);

  const formatPrice = (price?: number) => {
    if (!price) return '—';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(price);
  };

  const getConditionLabel = (condition?: string) => {
    const labels: Record<string, string> = {
      'new': 'Obra Nueva',
      'good': 'Buen Estado',
      'renovate': 'A Reformar',
      'renovated': 'Reformado'
    };
    return labels[condition || ''] || condition || '—';
  };

  const getFloorLabel = (level?: string, number?: number) => {
    if (level === 'ground') return 'Planta Baja';
    if (level === 'top') return 'Ático';
    if (number) return `Planta ${number}`;
    return level || '—';
  };

  const amenities = [
    { key: 'has_elevator', icon: ArrowUpDown, label: 'Ascensor' },
    { key: 'is_exterior', icon: Wind, label: 'Exterior' },
    { key: 'has_terrace', icon: Home, label: 'Terraza' },
    { key: 'has_balcony', icon: DoorOpen, label: 'Balcón' },
    { key: 'has_pool', icon: Waves, label: 'Piscina' },
    { key: 'has_garage', icon: Car, label: 'Garaje' },
    { key: 'has_garden', icon: Trees, label: 'Jardín' },
    { key: 'has_air_conditioning', icon: Wind, label: 'A/C' },
  ];

  const activeAmenities = amenities.filter(a => data[a.key as keyof ListingData]);
  const canAnalyse = !isResolvingLocation && (isLocationResolved || data.address);

  return (
    <div className="min-h-screen h-screen overflow-hidden bg-[#FDFBF7] flex flex-col">
      <header className="flex-shrink-0 bg-[#FDFBF7] border-b border-stone-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl font-medium tracking-tight text-stone-900">Leo.casa</span>
          </div>
          <div className="flex items-center gap-3">
            {data.source_url && (
              <a
                href={data.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View Original
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-6 h-full">
          <div className="flex gap-6 h-full">
            <div className="flex-1 min-w-0 overflow-y-auto pr-2 pb-6">
              <div 
                className="relative rounded-2xl overflow-hidden bg-stone-900 aspect-[16/10] mb-6"
                onMouseEnter={() => setIsCarouselHovered(true)}
                onMouseLeave={() => setIsCarouselHovered(false)}
              >
                {photos.length > 0 ? (
                  <>
                    <div className="absolute inset-0">
                      <img
                        src={photos[currentPhotoIndex]?.url}
                        alt={`Property photo ${currentPhotoIndex + 1}`}
                        className="w-full h-full object-cover transition-opacity duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    </div>

                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={prevPhoto}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2.5 rounded-full shadow-lg transition-all hover:scale-110 z-10"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="h-4 w-4 text-stone-800" />
                        </button>
                        <button
                          onClick={nextPhoto}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2.5 rounded-full shadow-lg transition-all hover:scale-110 z-10"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="h-4 w-4 text-stone-800" />
                        </button>
                      </>
                    )}

                    <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <span className="text-white text-sm font-medium">
                        {currentPhotoIndex + 1} / {photos.length}
                      </span>
                    </div>

                    {photos.length > 1 && (
                      <div className="absolute bottom-3 right-3 flex gap-1.5 max-w-[60%] overflow-x-auto pb-1">
                        {photos.slice(0, 8).map((photo, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentPhotoIndex(idx)}
                            className={`flex-shrink-0 w-12 h-9 rounded-md overflow-hidden border-2 transition-all ${
                              idx === currentPhotoIndex 
                                ? 'border-white shadow-lg scale-105' 
                                : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={photo.url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                        {photos.length > 8 && (
                          <div className="flex-shrink-0 w-12 h-9 rounded-md bg-black/50 flex items-center justify-center text-white text-xs font-medium">
                            +{photos.length - 8}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-200">
                    <div className="text-center text-stone-400">
                      <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No photos available</p>
                    </div>
                  </div>
                )}
              </div>

              <Card className="border-stone-200 shadow-sm relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="absolute top-3 right-3 text-stone-500 hover:text-stone-700 hover:bg-stone-100 z-10"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
                
                <CardContent className="p-6">
                  <div className="mb-5 pr-16">
                    <h1 className="text-xl font-serif font-semibold text-stone-900 mb-2">
                      {data.title || 'Property Listing'}
                    </h1>
                    <div className="flex items-center gap-2 text-stone-600">
                      {isResolvingLocation ? (
                        <div className="flex items-center gap-2 text-amber-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Resolving address...</span>
                        </div>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4 text-[#da654d]" />
                          <span className="text-sm">{data.address || data.city || 'Address pending'}</span>
                          {isLocationResolved && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-3 mb-5 pb-5 border-b border-stone-100">
                    <p className="text-3xl font-bold text-[#da654d]">
                      {formatPrice(data.price_eur)}
                    </p>
                    {data.m2_built && data.price_eur && (
                      <p className="text-sm text-stone-500">
                        ({formatPrice(Math.round(data.price_eur / data.m2_built))}/m²)
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-5">
                    <div className="text-center p-3 bg-stone-50 rounded-lg">
                      <Bed className="h-4 w-4 mx-auto mb-1 text-stone-400" />
                      <p className="text-lg font-semibold text-stone-800">{data.bedrooms || '—'}</p>
                      <p className="text-xs text-stone-500">Hab.</p>
                    </div>
                    <div className="text-center p-3 bg-stone-50 rounded-lg">
                      <Bath className="h-4 w-4 mx-auto mb-1 text-stone-400" />
                      <p className="text-lg font-semibold text-stone-800">{data.bathrooms || '—'}</p>
                      <p className="text-xs text-stone-500">Baños</p>
                    </div>
                    <div className="text-center p-3 bg-stone-50 rounded-lg">
                      <Ruler className="h-4 w-4 mx-auto mb-1 text-stone-400" />
                      <p className="text-lg font-semibold text-stone-800">{data.m2_built || '—'}</p>
                      <p className="text-xs text-stone-500">m²</p>
                    </div>
                    <div className="text-center p-3 bg-stone-50 rounded-lg">
                      <Building2 className="h-4 w-4 mx-auto mb-1 text-stone-400" />
                      <p className="text-sm font-semibold text-stone-800">{getFloorLabel(data.floor_level, data.floor_number)}</p>
                      <p className="text-xs text-stone-500">Planta</p>
                    </div>
                  </div>

                  {activeAmenities.length > 0 && (
                    <div className="mb-5">
                      <div className="flex flex-wrap gap-2">
                        {activeAmenities.map(amenity => (
                          <Badge 
                            key={amenity.key} 
                            variant="secondary" 
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 px-2.5 py-1"
                          >
                            <amenity.icon className="h-3 w-3 mr-1" />
                            {amenity.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 mb-5 text-sm">
                    {data.condition && (
                      <Badge variant="outline" className="font-medium">
                        {getConditionLabel(data.condition)}
                      </Badge>
                    )}
                    {data.property_subtype && (
                      <Badge variant="outline" className="font-medium capitalize">
                        {data.property_subtype.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    {data.reference && (
                      <span className="text-stone-500">
                        Ref: <span className="font-mono text-stone-700">{data.reference}</span>
                      </span>
                    )}
                  </div>

                  {data.description && (
                    <div className="border-t border-stone-100 pt-4">
                      <button 
                        onClick={() => setShowDescription(!showDescription)}
                        className="flex items-center justify-between w-full text-left"
                      >
                        <span className="text-sm font-medium text-stone-700">Descripción</span>
                        <ChevronDown className={`h-4 w-4 text-stone-400 transition-transform ${showDescription ? 'rotate-180' : ''}`} />
                      </button>
                      {showDescription && (
                        <p className="text-sm text-stone-600 leading-relaxed mt-3 whitespace-pre-line">
                          {data.description}
                        </p>
                      )}
                    </div>
                  )}

                  {data.agency?.name && (
                    <div className="border-t border-stone-100 pt-4 mt-4 flex items-center gap-3">
                      {data.agency.logo_url && (
                        <img 
                          src={data.agency.logo_url} 
                          alt={data.agency.name} 
                          className="h-8 w-auto object-contain"
                        />
                      )}
                      <div>
                        <p className="text-xs text-stone-400">Anunciado por</p>
                        <p className="text-sm font-medium text-stone-700">{data.agency.name}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="w-80 flex-shrink-0 overflow-y-auto">
              <div>
                <Card className="border-stone-200 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                      <StickyNote className="h-4 w-4 text-[#da654d]" />
                      Buyer Agent&apos;s Notes
                    </h3>
                    
                    <Textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[120px] bg-white border-stone-200 focus:border-[#da654d] placeholder:text-stone-400 text-sm resize-none mb-4" 
                      placeholder="E.g. 'Client loves open kitchens', 'Check for humidity', 'Budget is tight'..." 
                    />

                    <div className="mb-4 opacity-50 pointer-events-none">
                      <Label className="text-xs text-stone-500 mb-1.5 block">Assign to Client (Coming Soon)</Label>
                      <div className="flex items-center gap-2 p-2.5 border border-dashed border-stone-300 rounded-lg text-sm text-stone-400">
                        <User className="h-4 w-4" />
                        <span>Select client...</span>
                        <ChevronDown className="h-4 w-4 ml-auto" />
                      </div>
                    </div>

                    <Button
                      onClick={() => onAnalyse(notes)}
                      disabled={!canAnalyse || isSubmitting}
                      className={`w-full py-5 text-base rounded-xl shadow-md transition-all ${
                        canAnalyse 
                          ? 'bg-[#da654d] hover:bg-[#c8553d] text-white' 
                          : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : isResolvingLocation ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Waiting for address...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Analyse with Leo
                        </>
                      )}
                    </Button>
                    
                    {!canAnalyse && !isResolvingLocation && (
                      <p className="text-center text-xs text-stone-400 mt-2">
                        Waiting for address to resolve
                      </p>
                    )}

                    <p className="text-xs text-center text-stone-400 mt-3">
                      Generates full report + renovation potential
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
