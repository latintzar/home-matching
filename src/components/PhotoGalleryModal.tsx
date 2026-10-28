"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Image as ImageIcon } from "lucide-react";

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: Array<{ url: string; tag?: string; photoNumber?: number }>;
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  isOpen,
  onClose,
  photos,
  currentIndex,
  onNavigate,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Reset image loaded state when photo changes
  useEffect(() => {
    if (isOpen && photos.length > 0) {
      setImageLoaded(false);
    }
  }, [currentIndex, isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || photos.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        setImageLoaded(false);
        onNavigate(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < photos.length - 1) {
        setImageLoaded(false);
        onNavigate(currentIndex + 1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onClose, onNavigate]);

  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const goToPrevious = () => {
    if (hasPrevious) {
      onNavigate(currentIndex - 1);
      setImageLoaded(false);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      onNavigate(currentIndex + 1);
      setImageLoaded(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-0"
      onClick={onClose}
    >
      <div
        className="bg-white w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-4">
            {currentPhoto.tag && (
              <div className="text-lg font-semibold text-gray-900">
                {currentPhoto.tag}
              </div>
            )}
            <div className="text-sm text-gray-500">
              {currentIndex + 1} / {photos.length}
            </div>
          </div>
          <Button 
            onClick={onClose} 
            variant="ghost"
            size="icon"
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Image Container */}
        <div className="flex-1 relative bg-gray-900 flex items-center justify-center overflow-hidden">
          {/* Loading placeholder */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="animate-pulse text-gray-400">
                <ImageIcon className="h-16 w-16" />
              </div>
            </div>
          )}
          
          <img
            src={currentPhoto.url}
            alt={currentPhoto.tag || `Photo ${currentIndex + 1}`}
            className={`max-w-full max-h-full w-auto h-auto object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/fallback.svg";
              setImageLoaded(true);
            }}
          />

          {/* Navigation Arrows */}
          {hasPrevious && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white border border-gray-300 rounded-full p-2.5 shadow-xl transition-all hover:scale-110 z-10"
              onClick={goToPrevious}
              title="Previous photo (←)"
            >
              <ChevronLeft className="h-6 w-6 text-gray-700" />
            </button>
          )}

          {hasNext && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white border border-gray-300 rounded-full p-2.5 shadow-xl transition-all hover:scale-110 z-10"
              onClick={goToNext}
              title="Next photo (→)"
            >
              <ChevronRight className="h-6 w-6 text-gray-700" />
            </button>
          )}
        </div>

        {/* Thumbnail Strip */}
        {photos.length > 1 && (
          <div className="border-t bg-white px-4 py-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center h-20">
              {photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onNavigate(index);
                    setImageLoaded(false);
                  }}
                  className={`flex-shrink-0 h-16 w-20 rounded-lg overflow-hidden transition-all duration-200 ${
                    index === currentIndex 
                      ? 'ring-2 ring-blue-200 shadow-lg scale-105' 
                      : 'opacity-60 hover:opacity-80 hover:scale-102'
                  }`}
                  title={photo.tag || `Photo ${index + 1}`}
                >
                  <img
                    src={photo.url}
                    alt={photo.tag || `Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
