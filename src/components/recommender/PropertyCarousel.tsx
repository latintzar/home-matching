'use client';
import {appFetch as fetch} from '@/lib/app-path';

/**
 * PropertyCarousel Component
 * 
 * Displays properties during in-call vibe checks.
 * Shows 3-5 properties with swipeable cards and quick feedback options.
 * 
 * Used by:
 * - SpeakWithLeoContent (during calls)
 * - Property pages (for similar listings)
 */

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  Heart, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Bed, 
  Square, 
  Euro,
  Sparkles,
  AlertTriangle,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

interface PropertyForCarousel {
  listing_id: string;
  url: string;
  title: string;
  price: number;
  sqm: number;
  bedrooms: number;
  city: string;
  neighborhood: string;
  image_urls: string[];
  
  quickScore: number;
  standouts: string[];
  concerns: string[];
  
  fitScore: number;
  whyItWorks: string;
}

interface PropertyCarouselProps {
  properties: PropertyForCarousel[];
  sessionId: string;
  onFeedback?: (listingId: string, reaction: string, comment?: string) => void;
  onClose?: () => void;
  className?: string;
}

// ============================================================================
// Single Property Card
// ============================================================================

function PropertyCard({
  property,
  onLike,
  onDislike,
  onCurious,
  isActive,
}: {
  property: PropertyForCarousel;
  onLike: () => void;
  onDislike: () => void;
  onCurious: () => void;
  isActive: boolean;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  
  const images = property.image_urls.slice(0, 5);
  
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };
  
  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };
  
  // Swipe handling
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      if (info.offset.x > 0) {
        onLike();
      } else {
        onDislike();
      }
    }
  };
  
  return (
    <motion.div
      className={cn(
        'relative w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl overflow-hidden',
        !isActive && 'opacity-50 scale-95'
      )}
      drag={isActive ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isActive ? 1 : 0.5, y: 0 }}
      exit={{ opacity: 0, x: 200 }}
    >
      {/* Image carousel */}
      <div className="relative aspect-[4/3] bg-gray-200">
        {images.length > 0 ? (
          <>
            <Image
              src={images[currentImageIndex]}
              alt={property.title}
              fill
              className="object-cover"
              sizes="(max-width: 384px) 100vw, 384px"
            />
            
            {/* Image navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                
                {/* Image dots */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-2 h-2 rounded-full transition-colors',
                        i === currentImageIndex ? 'bg-white' : 'bg-white/50'
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            Sin fotos
          </div>
        )}
        
        {/* Fit score badge */}
        <div className="absolute top-3 left-3">
          <span
            className={cn(
              'px-2 py-1 rounded-full text-white text-sm font-bold',
              property.fitScore >= 80 ? 'bg-green-500' :
              property.fitScore >= 60 ? 'bg-yellow-500' :
              'bg-orange-500'
            )}
          >
            {property.fitScore}% match
          </span>
        </div>
        
        {/* Quick link */}
        <a
          href={property.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Price and basics */}
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-gray-900">
            {property.price.toLocaleString()}€
          </span>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Bed className="w-4 h-4" />
              {property.bedrooms}
            </span>
            <span className="flex items-center gap-1">
              <Square className="w-4 h-4" />
              {property.sqm}m²
            </span>
          </div>
        </div>
        
        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          {property.neighborhood}, {property.city}
        </div>
        
        {/* Standouts */}
        {property.standouts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {property.standouts.slice(0, 2).map((standout, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs"
              >
                <Sparkles className="w-3 h-3" />
                {standout}
              </span>
            ))}
          </div>
        )}
        
        {/* Concerns */}
        {property.concerns.length > 0 && showDetails && (
          <div className="flex flex-wrap gap-1">
            {property.concerns.map((concern, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs"
              >
                <AlertTriangle className="w-3 h-3" />
                {concern}
              </span>
            ))}
          </div>
        )}
        
        {/* Toggle details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-blue-600 hover:underline"
        >
          {showDetails ? 'Ver menos' : 'Ver más detalles'}
        </button>
        
        {/* Why it works */}
        {showDetails && property.whyItWorks && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
            {property.whyItWorks}
          </p>
        )}
        
        {/* Action buttons */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={onDislike}
            className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <button
            onClick={onCurious}
            className="w-10 h-10 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center hover:bg-blue-200 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          
          <button
            onClick={onLike}
            className="w-12 h-12 rounded-full bg-green-100 text-green-500 flex items-center justify-center hover:bg-green-200 transition-colors"
          >
            <Heart className="w-6 h-6" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Carousel Component
// ============================================================================

export default function PropertyCarousel({
  properties,
  sessionId,
  onFeedback,
  onClose,
  className,
}: PropertyCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState<Map<string, string>>(new Map());
  
  // Send feedback to API
  const sendFeedback = useCallback(async (
    listingId: string,
    reaction: string,
    comment?: string
  ) => {
    // Update local state
    setFeedback(prev => new Map(prev).set(listingId, reaction));
    
    // Call parent handler
    if (onFeedback) {
      onFeedback(listingId, reaction, comment);
    }
    
    // Send to API
    try {
      await fetch('/api/agents/vibe-check', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          listingId,
          reaction,
          comment,
        }),
      });
    } catch (error) {
      console.error('[Carousel] Feedback error:', error);
    }
  }, [sessionId, onFeedback]);
  
  // Handle reactions
  const handleLike = (property: PropertyForCarousel) => {
    sendFeedback(property.listing_id, 'like');
    if (currentIndex < properties.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };
  
  const handleDislike = (property: PropertyForCarousel) => {
    sendFeedback(property.listing_id, 'dislike');
    if (currentIndex < properties.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };
  
  const handleCurious = (property: PropertyForCarousel) => {
    sendFeedback(property.listing_id, 'curious');
    // Don't advance - let user explore more
  };
  
  // Navigation
  const goToNext = () => {
    if (currentIndex < properties.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };
  
  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };
  
  // All reviewed?
  const allReviewed = feedback.size === properties.length;
  
  if (properties.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-8 text-gray-500', className)}>
        No hay propiedades para mostrar
      </div>
    );
  }
  
  return (
    <div className={cn('relative', className)}>
      {/* Progress indicator */}
      <div className="flex justify-center gap-2 mb-4">
        {properties.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              i === currentIndex ? 'w-6 bg-blue-500' : 
              feedback.has(properties[i].listing_id) ? 'bg-green-400' : 'bg-gray-300'
            )}
          />
        ))}
      </div>
      
      {/* Cards */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <PropertyCard
            key={properties[currentIndex].listing_id}
            property={properties[currentIndex]}
            onLike={() => handleLike(properties[currentIndex])}
            onDislike={() => handleDislike(properties[currentIndex])}
            onCurious={() => handleCurious(properties[currentIndex])}
            isActive={true}
          />
        </AnimatePresence>
        
        {/* Navigation arrows */}
        {currentIndex > 0 && (
          <button
            onClick={goToPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        
        {currentIndex < properties.length - 1 && (
          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
      
      {/* Counter */}
      <div className="text-center mt-4 text-sm text-gray-500">
        {currentIndex + 1} de {properties.length}
        {allReviewed && (
          <span className="ml-2 text-green-600">✓ Todas vistas</span>
        )}
      </div>
      
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Realtime Carousel Listener
// ============================================================================

export function useVibeCheckCarousel(userId: string | undefined) {
  const [properties, setProperties] = useState<PropertyForCarousel[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (!userId) return;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Subscribe to vibe check channel
    const channel = supabase.channel(`vibe-check:${userId}`)
      .on('broadcast', { event: 'show_carousel' }, ({ payload }) => {
        console.log('[VibeCheck] Received carousel:', payload);
        setProperties(payload.properties || []);
        setSessionId(payload.sessionId || '');
        setIsVisible(true);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
  
  const hideCarousel = () => {
    setIsVisible(false);
    setProperties([]);
    setSessionId('');
  };
  
  return {
    properties,
    sessionId,
    isVisible,
    hideCarousel,
  };
}

