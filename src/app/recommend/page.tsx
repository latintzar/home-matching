'use client';

/**
 * Recommend Page
 * 
 * Entry point for the Leo Recommender - helps users find properties
 * that match their lifestyle, not just filters.
 * 
 * Connected to:
 * - /recommend/intake - Voice/chat intake with ElevenLabs
 * - /api/recommender/generate - Full recommender pipeline
 * - /api/recommender/search - Legacy search endpoint
 */

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RecommendationResults } from '@/components/recommender/RecommendationResults';
import { LifeProfileIntake } from '@/components/recommender/LifeProfileIntake';
import { LifeProfile, SweetSpot } from '@/types/recommender';

type PageState = 'loading' | 'intake' | 'searching' | 'results';

interface ScoredListing {
  listing: {
    listing_id: string;
    url: string;
    title: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    sqm: number;
    city: string;
    region: string;
    image_urls: string[];
  };
  fitScore: number;
  breakdown: Record<string, number>;
  topReasons: string[];
  concerns: string[];
  explanation: string;
}

interface SearchResult {
  listings: ScoredListing[];
  total: number;
  sweetSpot?: SweetSpot;
  wpaEnabled?: boolean;
}

function RecommendPageContent() {
  const searchParams = useSearchParams();
  const urlProfileId = searchParams.get('profileId');
  
  const [state, setState] = useState<PageState>('loading');
  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchProgress, setSearchProgress] = useState<string>('');

  // Run search using the full recommender pipeline (NO FALLBACK)
  const runSearch = useCallback(async (id: string) => {
    setSearchProgress('Generando sweet spot...');
    
    try {
      // Use the full recommender pipeline
      const res = await fetch('/api/recommender/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profileId: id,
          // Cost-controlled options
          maxResults: 20,
          maxWPA: 10,  // Max 10 WPA calls (~€1.50)
          skipWPA: false,
        }),
      });
      
      const data = await res.json();
      
      if (data.success && data.results) {
        setSearchResult({
          listings: data.results.listings || [],
          total: data.results.total || 0,
          sweetSpot: data.results.sweetSpot,
          wpaEnabled: data.results.wpaEnabled,
        });
        setState('results');
      } else {
        // No fallback - show the actual error
        setError(data.error || 'La búsqueda falló. El harvest puede no estar completo aún.');
        setState('results');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Error de conexión');
      setState('results');
    }
  }, []);

  // Check for existing profile on mount - prioritize URL profileId
  useEffect(() => {
    const checkExistingProfile = async () => {
      // If profileId is in URL (from intake flow), use that directly
      if (urlProfileId) {
        console.log('[Recommend] Using profileId from URL:', urlProfileId);
        setProfileId(urlProfileId);
        
        // Load the profile details
        try {
          const res = await fetch(`/api/recommender/profile?profileId=${urlProfileId}`);
          const data = await res.json();
          
          if (data.success && data.profile) {
            setProfile(data.profile);
            // Profile from intake flow - always run search
            setState('searching');
            runSearch(urlProfileId);
          } else {
            // Profile not found - run search anyway (profile might be saved differently)
            setState('searching');
            runSearch(urlProfileId);
          }
        } catch (err) {
          console.error('Failed to load profile:', err);
          // Still try to run search
          setState('searching');
          runSearch(urlProfileId);
        }
        return;
      }
      
      // No URL profileId - check for session profile
      try {
        const res = await fetch('/api/recommender/profile');
        const data = await res.json();
        
        if (data.success && data.profile) {
          setProfile(data.profile);
          setProfileId(data.profile.id);
          
          if (data.profile.intakeCompleted) {
            // Go straight to search if profile is complete
            setState('searching');
            runSearch(data.profile.id);
          } else {
            setState('intake');
          }
        } else {
          setState('intake');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setState('intake');
      }
    };

    checkExistingProfile();
  }, [urlProfileId, runSearch]);

  // Save profile to API
  const handleSave = useCallback(async (partialProfile: Partial<LifeProfile>) => {
    try {
      const res = await fetch('/api/recommender/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          ...partialProfile,
        }),
      });
      
      const data = await res.json();
      
      if (data.success && data.profile) {
        setProfileId(data.profile.id);
        setProfile(data.profile);
        return data.profile.id;
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
    return null;
  }, [profileId]);

  // Handle intake completion
  const handleComplete = useCallback(async (completedProfile: LifeProfile) => {
    setProfile(completedProfile);
    setState('searching');
    setSearchProgress('Guardando perfil...');

    try {
      // Save the completed profile
      const res = await fetch('/api/recommender/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          ...completedProfile,
          intakeCompleted: true,
        }),
      });
      
      const data = await res.json();
      
      if (data.success && data.profile) {
        setProfileId(data.profile.id);
        setProfile(data.profile);
        
        // Run search
        await runSearch(data.profile.id);
      } else {
        throw new Error('Failed to save profile');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
      setState('intake');
    }
  }, [profileId, runSearch]);

  // Start over
  const handleStartOver = useCallback(() => {
    setProfile(null);
    setProfileId(null);
    setState('intake');
  }, []);

  // Loading state
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Intake state
  if (state === 'intake') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              🏠 Leo <span className="text-emerald-600">Recommender</span>
            </h1>
            <p className="text-lg text-gray-600">
              Te ayudamos a encontrar la casa que encaja con tu vida, no solo con tus filtros.
            </p>
          </div>

          {/* Intake Form */}
          <LifeProfileIntake
            initialProfile={profile || undefined}
            onComplete={handleComplete}
            onSave={handleSave}
          />

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Searching state
  if (state === 'searching') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 relative">
            <div className="absolute inset-0 border-4 border-emerald-200 rounded-full animate-ping" />
            <div className="absolute inset-2 border-4 border-emerald-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
            <div className="absolute inset-4 border-4 border-emerald-600 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
            <div className="absolute inset-0 flex items-center justify-center text-4xl">🏠</div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Buscando tu casa ideal...
          </h2>
          <p className="text-gray-600">
            Analizando {((profile?.constraints?.maxBudget || 400000) / 1000).toFixed(0)}+ propiedades
            en tus zonas preferidas
          </p>
          <div className="mt-8 space-y-2 text-sm text-gray-500">
            <p>✅ Perfil de vida analizado</p>
            <p className="animate-pulse">🔍 Buscando coincidencias...</p>
            <p className="opacity-50">📊 Calculando puntuaciones</p>
            <p className="opacity-50">🎯 Ordenando resultados</p>
          </div>
        </div>
      </div>
    );
  }

  // Results state
  if (state === 'results') {
    return (
      <RecommendationResults profile={profile} searchResult={searchResult} error={error} onEditProfile={handleStartOver} />
    );
  }

  return null;
}

// Main export with Suspense boundary for useSearchParams
export default function RecommendPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <RecommendPageContent />
    </Suspense>
  );
}

