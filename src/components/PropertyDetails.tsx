/**
 * PropertyDetails - Progressive Component Version
 * 
 * This is the new progressive version of PropertyDetails that uses the
 * progressive component pattern for better UX and maintainability.
 */

"use client";

import React, { useState } from "react";
import ProgressiveComponent, { ConditionalRender, PipelineIndicator } from "@/components/foundation/ProgressiveComponent";
import { usePipelineData } from "@/hooks/usePipelineData";
import { PropertyDataContract, ProgressiveComponentProps } from "@/types/progressive-components";
import { Button } from "@/components/ui/button";
import { PhotoGalleryModal } from "@/components/PhotoGalleryModal";
import { Check, X, Shield, Home, Building2, Wallet } from "lucide-react";

interface PropertyDetailsProps extends ProgressiveComponentProps {
  onAnalysisClick?: () => void;
  onPhotoClick?: (photoIndex: number) => void;
}

export const PropertyDetails: React.FC<PropertyDetailsProps> = ({
  data,
  pipelineStage: externalPipelineStage,
  showStageIndicator = true,
  onAnalysisClick,
  onPhotoClick,
  className = '',
  ...props
}) => {
  const { pipelineStage, isSkeleton, hasStageData } = usePipelineData(data, {
    initialStage: externalPipelineStage
  });

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [carouselPhotoIndex, setCarouselPhotoIndex] = useState(0);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  const handlePhotoClick = (photoIndex: number) => {
    setCurrentPhotoIndex(photoIndex);
    setGalleryOpen(true);
    if (onPhotoClick) {
      onPhotoClick(photoIndex);
    }
  };

  const handleWhatsAppClick = async () => {
    if (!data?.categoryUnknowns || Object.keys(data.categoryUnknowns).length === 0) {
      alert('No hay información pendiente para consultar');
      return;
    }

    setWhatsappLoading(true);
    try {
      const response = await fetch(`/api/listings/${data.id}/whatsapp-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to generate WhatsApp message');
      }

      const result = await response.json();
      if (result.success && result.whatsappUrl) {
        window.open(result.whatsappUrl, '_blank');
      } else {
        throw new Error(result.error || 'Failed to generate message');
      }
    } catch (error) {
      console.error('WhatsApp message error:', error);
      alert('Error al generar el mensaje de WhatsApp');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return 'Precio no disponible';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatArea = (constructedArea: number | null | undefined, usefulArea: number | null | undefined) => {
    if (!constructedArea && !usefulArea) return null;
    
    if (usefulArea) {
      const mainArea = `${usefulArea} m²`;
      if (constructedArea) {
        return (
          <span>
            {mainArea}
            <span className="text-xs text-gray-500 ml-1">
              ({constructedArea} construidos)
            </span>
          </span>
        );
      }
      return mainArea;
    } else if (constructedArea) {
      return `${constructedArea} m² construidos`;
    }
    return null;
  };

  const displayLocation = (city?: string | null, address?: string | null) => {
    const c = typeof city === 'string' ? city.trim() : '';
    const a = typeof address === 'string' ? address.trim() : '';
    
    if (!c && !a) return { title: 'Ubicación no disponible', subtitle: '' };
    
    // Normalize helper
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    
    // If we have both city and address
    if (c && a) {
      // If they are effectively the same, just return one
      if (norm(c) === norm(a)) {
        return { title: c, subtitle: '' };
      }
      return { title: a, subtitle: c };
    }
    
    // If only one exists
    return { title: c || a, subtitle: '' };
  };

  const displayRoomsAndAmenities = (roomsAndAmenities: string | null | undefined) => {
    if (!roomsAndAmenities) return null;
    
    // Filter out hab and baños patterns (handles "3 hab | 2 baños" format)
    const filtered = roomsAndAmenities
      .split('|')
      .filter(item => !/\d+\s*(hab|baños)/i.test(item.trim()))
      .join('|')
      .trim();
    
    return filtered || null;
  };

  const formatEnum = (val: string | null | undefined) => {
    if (!val) return null;
    // Special cases
    if (val === 'bare_ownership') return 'Bare Ownership';
    if (val === 'chalet_detached') return 'Detached House';
    if (val === 'chalet_semi') return 'Semi-Detached';
    if (val === 'chalet_terraced') return 'Terraced House';
    // General case: capitalize words, remove underscores
    return val.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Show skeleton state when no data is available
  if (isSkeleton) {
    return (
      <div className={`property-details-skeleton ${className}`}>
        {/* Photo Carousel Skeleton */}
        <div className="mb-6">
          <div className="w-full aspect-video bg-gray-200 rounded-lg animate-pulse"></div>
        </div>

        {/* Property Info Skeleton */}
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4 animate-pulse"></div>
          <div className="h-5 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        </div>

        {/* Rooms and Amenities Skeleton */}
        <div className="mb-6">
          <div className="h-5 bg-gray-200 rounded w-1/4 mb-3 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
        </div>

        {/* DETALLES Section Skeleton */}
        <div className="mb-6">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4 animate-pulse"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
          </div>
        </div>

        {/* Pipeline Stage Indicator */}
        {showStageIndicator && (
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-200 animate-pulse">
              <span>⏳</span>
              <span>Loading...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className} {...props}>
      <div className="h-fit">
        {/* Photo Carousel Section */}
        <ConditionalRender stage={pipelineStage} requiredStages={['photos-stored', 'text-analysis', 'complete']}>
          <div className="mb-6">
            <div className="relative">
              <div 
                className="w-full aspect-video bg-gray-200 rounded-lg cursor-pointer hover:opacity-90 transition-opacity relative overflow-hidden"
                onClick={() => data?.photos && data.photos.length > 0 && handlePhotoClick(carouselPhotoIndex)}
              >
                {data?.photos && data.photos.length > 0 ? (
                  <img
                    src={data.photos[carouselPhotoIndex]?.url}
                    alt="Property photo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-4xl mb-2">🏠</div>
                      <div className="text-sm text-gray-600">No photos available</div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Navigation buttons */}
              {data?.photos && data.photos.length > 1 && (
                <>
                  {carouselPhotoIndex > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCarouselPhotoIndex(carouselPhotoIndex - 1);
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-gray-300 rounded-full p-2 shadow-lg transition-colors z-10"
                    >
                      <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  {carouselPhotoIndex < data.photos.length - 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCarouselPhotoIndex(carouselPhotoIndex + 1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-gray-300 rounded-full p-2 shadow-lg transition-colors z-10"
                    >
                      <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </>
              )}
              
              {/* Photo counter */}
              {data?.photos && data.photos.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  {carouselPhotoIndex + 1} / {data.photos.length}
                </div>
              )}
            </div>
          </div>
        </ConditionalRender>

        {/* Fallback for no photos */}
        <ConditionalRender stage={pipelineStage} requiredStages={['none', 'scraped']}>
          <div className="mb-6">
            <div className="w-full aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-2">📸</div>
                <div className="text-sm">Photos will appear after storage</div>
              </div>
            </div>
          </div>
        </ConditionalRender>

        {/* Header Section */}
        <ConditionalRender stage={pipelineStage} requiredStages={['scraped', 'photos-stored', 'text-analysis', 'complete']}>
          <div className="mb-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h1 className="text-2xl font-semibold text-gray-900 mb-1 leading-tight">
                  {(() => {
                    const loc = displayLocation(data?.city, data?.address);
                    return loc.title || data?.title || 'Título no disponible';
                  })()}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm text-gray-600">
                    {(() => {
                      const loc = displayLocation(data?.city, data?.address);
                      return loc.subtitle;
                    })()}
                  </div>
                  {data?.listingRef && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-500">Ref: {data.listingRef}</span>
                    </>
                  )}
                  {(data as any)?.sourceUrl && (
                    <>
                      <span className="text-gray-400">•</span>
                      <button
                        onClick={() => window.open((data as any).sourceUrl, '_blank')}
                        className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors cursor-pointer"
                      >
                        Original listing
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {formatPrice(data?.price)}
                </div>
                {formatArea(data?.constructedArea, data?.usefulArea) && (
                  <div className="text-sm text-gray-600 mt-1">
                    {formatArea(data?.constructedArea, data?.usefulArea)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ConditionalRender>
      
        {/* Quick Info Section & Tags */}
        <ConditionalRender stage={pipelineStage} requiredStages={['scraped', 'photos-stored', 'text-analysis', 'complete']}>
          <div className="mb-6 space-y-4">
            
            {/* Status Tags */}
            <div className="flex flex-wrap gap-2">
                {data?.property_subtype && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        <Home className="w-3 h-3 mr-1" />
                        {formatEnum(data.property_subtype)}
                    </span>
                )}
                {data?.housing_situation && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${data.housing_situation === 'free' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {formatEnum(data.housing_situation)}
                    </span>
                )}
                {data?.ad_origin && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Wallet className="w-3 h-3 mr-1" />
                        {formatEnum(data.ad_origin)}
                    </span>
                )}
                {data?.condition && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Building2 className="w-3 h-3 mr-1" />
                        {formatEnum(data.condition)}
                    </span>
                )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="space-y-4">
                {/* Habitaciones y Baños */}
                {(data?.bedrooms || data?.bathrooms) && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Habitaciones</div>
                    <div className="text-base font-semibold text-gray-900">
                      {data?.bedrooms && `${data.bedrooms} habitaciones`}
                      {data?.bedrooms && data?.bathrooms && ' • '}
                      {data?.bathrooms && `${data.bathrooms} baños`}
                    </div>
                  </div>
                )}
                
                {/* Agent Details */}
                {(data as any)?.agency && (
                    <div className="pt-4 mt-4 border-t border-gray-200">
                        <div className="text-sm font-medium text-gray-500 mb-2">Contacto</div>
                        <div className="flex items-center gap-3">
                            {(data as any).agency.logo_url ? (
                                <img src={(data as any).agency.logo_url} alt={(data as any).agency.name || 'Agent'} className="w-10 h-10 object-contain rounded bg-white border p-1" />
                            ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-lg">🏢</div>
                            )}
                            <div>
                                <div className="text-sm font-semibold text-gray-900">{(data as any).agency.name || 'Agencia'}</div>
                                <div className="text-xs text-gray-500 flex gap-2">
                                    {(data as any).agency.phone && <span>📞 {(data as any).agency.phone}</span>}
                                    {(data as any).agency.whatsapp && <span>💬 WhatsApp</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Booleans / Features Grid */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    {[
                        { k: 'has_elevator', l: 'Elevator' },
                        { k: 'is_exterior', l: 'Exterior' },
                        { k: 'has_terrace', l: 'Terrace', extra: (data as any)?.terrace_orientation },
                        { k: 'has_balcony', l: 'Balcony', extra: (data as any)?.balcony_orientation },
                        { k: 'has_garage', l: 'Garage' },
                        { k: 'has_pool', l: 'Pool' },
                        { k: 'has_garden', l: 'Garden' },
                        { k: 'has_air_conditioning', l: 'Air Cond.' },
                        { k: 'has_wardrobes', l: 'Wardrobes' },
                        { k: 'has_storage', l: 'Storage' },
                        { k: 'is_accessible', l: 'Accessible' },
                    ].filter(feat => data?.[feat.k as keyof PropertyDataContract] === true).map(feat => (
                        <div key={feat.k} className="flex flex-col text-sm text-gray-700">
                            <div className="flex items-center">
                                <Check className="w-4 h-4 text-green-500 mr-2" />
                                {feat.l}
                            </div>
                            {feat.extra && feat.extra !== 'unknown' && (
                                <span className="text-xs text-gray-500 ml-6">
                                    {feat.extra === 'street' ? 'Street View' : 'Back View'}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Legacy Characteristics String (if any remain not covered by booleans) */}
                {displayRoomsAndAmenities(data?.roomsAndAmenities) && (
                  <div className="pt-2 border-t border-gray-200 mt-2">
                    <div className="text-xs text-gray-500 mb-1">Other Features</div>
                    <div className="text-sm text-gray-700">
                      {displayRoomsAndAmenities(data?.roomsAndAmenities)}
                    </div>
                  </div>
                )}
                
                {/* Additional Features List */}
                {data?.additionalFeatures && data.additionalFeatures.length > 0 && (
                    <div className="pt-2 border-t border-gray-200 mt-2">
                        <div className="text-xs text-gray-500 mb-1">More</div>
                        <div className="flex flex-wrap gap-1">
                            {data.additionalFeatures.map((feat, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {feat}
                                </span>
                            ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ConditionalRender>


        {/* Need more details? Section */}
        {data?.categoryUnknowns && Object.keys(data.categoryUnknowns).length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-700 mb-3">
              Need more details?
            </div>
            <Button 
              onClick={handleWhatsAppClick}
              disabled={whatsappLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {whatsappLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                  </svg>
                  Ask Agent
                </>
              )}
            </Button>
          </div>
        )}

      </div>

      {/* Photo Gallery Modal */}
      {data?.photos && data.photos.length > 0 && (
        <PhotoGalleryModal
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          photos={data.photos}
          currentIndex={currentPhotoIndex}
          onNavigate={(index) => setCurrentPhotoIndex(index)}
        />
      )}
    </div>
  );
};

export default PropertyDetails;