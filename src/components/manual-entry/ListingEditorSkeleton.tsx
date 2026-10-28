'use client';

import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useMemo } from 'react';
import { Sparkles } from 'lucide-react';

const FACTS = [
  "Legal: 'Vicios ocultos' claims remain valid for 6 months after key handover (Civil Code Art. 1490).",
  "Renovation: Switching to thermal-break windows can cut heating losses by as much as 40%.",
  "Due diligence: The 'Nota Simple' is the only official snapshot of ownership, charges, and embargoes.",
  "Tax: ITP varies wildly—6% in Madrid, yet up to 11% in Catalonia or Valencia.",
  "Structure: 'Tabiques' are ~7cm hollow brick; they're non-load bearing and easy to remove for open layouts.",
  "Architecture: Many 1900-1970 flats hide 3m+ ceilings (often 'Volta Catalana') behind drop ceilings.",
  "Financial: Community fee debts transfer with the property—buyers inherit pending balances.",
  "Market: 'Nuda Propiedad' lets you buy title while the seller keeps lifetime usufruct (occupancy rights).",
];

export function ListingEditorSkeleton() {
  // Pre-compute random starting index to avoid hydration mismatch
  const startIndex = useMemo(() => Math.floor(Math.random() * FACTS.length), []);
  const [factIndex, setFactIndex] = useState(startIndex);

  useEffect(() => {
    // Rotate fact every 4 seconds for comfortable reading
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FACTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen h-screen overflow-hidden bg-[#FDFBF7] flex flex-col relative">
      {/* Glassmorphic Full Viewport Background + Modal */}
      <div 
        className="fixed inset-0 z-[60] flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(253,251,247,0.85) 0%, rgba(245,240,235,0.9) 50%, rgba(253,251,247,0.85) 100%)',
          backdropFilter: 'blur(12px) saturate(120%)',
          WebkitBackdropFilter: 'blur(12px) saturate(120%)',
        }}
      >
        {/* Subtle animated gradient overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 30%, rgba(218,101,77,0.06) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 70%, rgba(180,140,100,0.05) 0%, transparent 50%)
            `,
          }}
        />
        
        {/* Modal Card */}
        <div 
          className="relative px-10 py-8 rounded-[28px] max-w-lg mx-4 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.75) 100%)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.7),
              0 0 0 1px rgba(255,255,255,0.4) inset,
              0 8px 32px rgba(0,0,0,0.08),
              0 24px 64px -24px rgba(0,0,0,0.12)
            `,
            border: '1px solid rgba(255,255,255,0.6)',
          }}
        >
          {/* Subtle inner glow */}
          <div 
            className="absolute inset-0 rounded-[28px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.6) 0%, transparent 50%)',
            }}
          />
          
          <div className="relative flex justify-center mb-4">
            <div 
              className="p-3.5 rounded-2xl"
              style={{
                background: 'linear-gradient(145deg, rgba(255,248,244,0.95) 0%, rgba(255,228,217,0.8) 100%)',
                boxShadow: '0 2px 12px rgba(218,101,77,0.15), inset 0 1px 2px rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.7)',
              }}
            >
              <Sparkles className="h-6 w-6 text-[#da654d]" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
            </div>
          </div>
          
          <h3 className="relative font-serif text-xl font-medium text-stone-800 mb-3 tracking-tight">
            Preparando tu mesa de análisis…
          </h3>
          
          <div className="relative min-h-[72px] flex items-center justify-center">
            <p
              key={factIndex}
              className="text-stone-600 text-sm leading-relaxed"
              style={{
                animation: 'fadeSlideIn 0.2s ease-out',
              }}
            >
              {FACTS[factIndex]}
            </p>
          </div>
          
          <div className="relative mt-5 flex justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[#da654d]/80 animate-bounce [animation-delay:-0.2s]" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#da654d]/80 animate-bounce [animation-delay:-0.1s]" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#da654d]/80 animate-bounce" />
          </div>
        </div>
      </div>

      {/* Fast fade-in animation */}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Header Skeleton - Same layout as actual page */}
      <header className="flex-shrink-0 bg-[#FDFBF7] border-b border-stone-100 z-50 opacity-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center">
          <Skeleton className="h-5 w-20 bg-stone-200" />
        </div>
      </header>

      {/* Main Content - Same layout as actual page */}
      <div className="flex-1 overflow-hidden opacity-30">
        <div className="max-w-7xl mx-auto px-6 py-6 h-full">
          <div className="flex gap-6 h-full">
            {/* Left: Form Content Skeleton */}
            <div className="flex-1 min-w-0 overflow-y-auto pr-2 pb-6 space-y-6">
          <div className="space-y-2">
                <Skeleton className="h-6 w-48 bg-stone-200" />
                <Skeleton className="h-4 w-72 bg-stone-100" />
          </div>

          {/* Card 1: Basics */}
          <div className="border border-stone-100 shadow-sm bg-white rounded-xl overflow-hidden">
            <div className="h-1 bg-stone-200 w-full" />
                <div className="p-5 space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-8 w-8 rounded-full bg-stone-100" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-24 bg-stone-200" />
                      <Skeleton className="h-3 w-36 bg-stone-100" />
                </div>
              </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-14 w-full bg-stone-50 rounded-lg" />
                    <Skeleton className="h-14 w-full bg-stone-50 rounded-lg" />
              </div>
                  <Skeleton className="h-10 w-full bg-stone-50 rounded-lg" />
            </div>
          </div>

          {/* Card 2: Details */}
          <div className="border border-stone-100 shadow-sm bg-white rounded-xl overflow-hidden">
            <div className="h-1 bg-stone-200 w-full" />
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-4 gap-3">
                    <Skeleton className="h-10 bg-stone-50 rounded-lg" />
                    <Skeleton className="h-10 bg-stone-50 rounded-lg" />
                    <Skeleton className="h-10 bg-stone-50 rounded-lg" />
                    <Skeleton className="h-10 bg-stone-50 rounded-lg" />
                  </div>
                  <Skeleton className="h-24 w-full bg-stone-50 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Right: Sidebar Skeleton */}
            <div className="w-80 flex-shrink-0">
              <div className="border border-stone-200 shadow-sm bg-white rounded-xl p-5 space-y-4">
                <Skeleton className="h-4 w-32 bg-stone-200" />
                <Skeleton className="h-28 w-full bg-stone-50 rounded-lg" />
                <Skeleton className="h-12 w-full bg-stone-200 rounded-xl" />
                <Skeleton className="h-3 w-48 mx-auto bg-stone-100" />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
