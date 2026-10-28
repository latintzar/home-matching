'use client';

/**
 * PersonalizedMatch Component
 * 
 * Displays how a property matches the user's preferences.
 * Used on property pages to show personalized fit scoring.
 * 
 * Features:
 * - Overall fit score with visual gauge
 * - Top 3 matching dimensions
 * - Concerns/tradeoffs for user
 * - "Why this works for you" explanation
 */

import React, { useState, useEffect } from 'react';
import { Heart, AlertCircle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PersonalizedMatchProps {
  listingId: string;
  userId?: string;
  
  // If pre-computed data is available
  precomputed?: {
    fitScore: number;
    topMatches: string[];
    concerns: string[];
    explanation: string;
  };
  
  // Styling
  className?: string;
  compact?: boolean;
}

interface MatchData {
  fitScore: number;
  topMatches: string[];
  concerns: string[];
  explanation: string;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Score Gauge Component
// ============================================================================

function ScoreGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-16 h-16 text-lg',
    lg: 'w-20 h-20 text-xl',
  };
  
  // Color based on score
  const getColor = (s: number) => {
    if (s >= 80) return 'text-green-500 border-green-500';
    if (s >= 60) return 'text-yellow-500 border-yellow-500';
    if (s >= 40) return 'text-orange-500 border-orange-500';
    return 'text-red-500 border-red-500';
  };
  
  const getLabel = (s: number) => {
    if (s >= 80) return 'Excelente';
    if (s >= 60) return 'Buen match';
    if (s >= 40) return 'Aceptable';
    return 'No recomendado';
  };
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'rounded-full border-4 flex items-center justify-center font-bold',
          sizeClasses[size],
          getColor(score)
        )}
      >
        {score}
      </div>
      <span className={cn('text-xs', getColor(score).split(' ')[0])}>
        {getLabel(score)}
      </span>
    </div>
  );
}

// ============================================================================
// Match Badges
// ============================================================================

function MatchBadge({ text, type }: { text: string; type: 'match' | 'concern' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
        type === 'match' 
          ? 'bg-green-100 text-green-700' 
          : 'bg-orange-100 text-orange-700'
      )}
    >
      {type === 'match' ? (
        <Sparkles className="w-3 h-3" />
      ) : (
        <AlertCircle className="w-3 h-3" />
      )}
      {text}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function PersonalizedMatch({
  listingId,
  userId,
  precomputed,
  className,
  compact = false,
}: PersonalizedMatchProps) {
  const [data, setData] = useState<MatchData>({
    fitScore: precomputed?.fitScore || 0,
    topMatches: precomputed?.topMatches || [],
    concerns: precomputed?.concerns || [],
    explanation: precomputed?.explanation || '',
    loading: !precomputed,
    error: null,
  });
  
  const [expanded, setExpanded] = useState(!compact);
  
  // Fetch match data if not precomputed
  useEffect(() => {
    if (precomputed || !userId) return;
    
    async function fetchMatchData() {
      try {
        const response = await fetch(
          `/api/wpa/explain?listingId=${listingId}&userId=${userId}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch match data');
        }
        
        const result = await response.json();
        
        setData({
          fitScore: result.fitScore || 50,
          topMatches: result.topMatches || [],
          concerns: result.concerns || [],
          explanation: result.explanation || '',
          loading: false,
          error: null,
        });
      } catch (error: any) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: error.message,
        }));
      }
    }
    
    fetchMatchData();
  }, [listingId, userId, precomputed]);
  
  // Loading state
  if (data.loading) {
    return (
      <div className={cn('animate-pulse bg-gray-100 rounded-lg p-4', className)}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (data.error) {
    return (
      <div className={cn('bg-red-50 rounded-lg p-4 text-red-600 text-sm', className)}>
        No pudimos calcular tu compatibilidad con este piso.
      </div>
    );
  }
  
  // No user state
  if (!userId && !precomputed) {
    return (
      <div className={cn('bg-blue-50 rounded-lg p-4', className)}>
        <div className="flex items-center gap-3">
          <Heart className="w-5 h-5 text-blue-500" />
          <div>
            <p className="font-medium text-blue-900">¿Es este piso para ti?</p>
            <p className="text-sm text-blue-700">
              Inicia sesión para ver tu compatibilidad personalizada.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // Main render
  return (
    <div className={cn('bg-white rounded-lg border shadow-sm', className)}>
      {/* Header - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
      >
        <ScoreGauge score={data.fitScore} size={compact ? 'sm' : 'md'} />
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">
            Tu compatibilidad
          </h3>
          
          {!expanded && data.explanation && (
            <p className="text-sm text-gray-600 truncate">
              {data.explanation}
            </p>
          )}
        </div>
        
        {compact && (
          expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )
        )}
      </button>
      
      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4">
          {/* Top matches */}
          {data.topMatches.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                Lo que mejor encaja
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.topMatches.map((match, i) => (
                  <MatchBadge key={i} text={match} type="match" />
                ))}
              </div>
            </div>
          )}
          
          {/* Concerns */}
          {data.concerns.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                A considerar
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.concerns.map((concern, i) => (
                  <MatchBadge key={i} text={concern} type="concern" />
                ))}
              </div>
            </div>
          )}
          
          {/* Explanation */}
          {data.explanation && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700">{data.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Version for Lists
// ============================================================================

export function PersonalizedMatchBadge({
  fitScore,
  className,
}: {
  fitScore: number;
  className?: string;
}) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-yellow-500';
    if (s >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-medium',
        getColor(fitScore),
        className
      )}
    >
      {fitScore}% match
    </span>
  );
}

