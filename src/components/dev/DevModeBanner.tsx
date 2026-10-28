"use client";

// DevModeBanner.tsx
// Shows a banner when dev bypass is active

export function DevModeBanner() {
  const isDevBypass = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true' && 
                      process.env.NODE_ENV === 'development';

  if (!isDevBypass) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-medium text-black shadow-lg backdrop-blur-sm">
      <span className="flex h-2 w-2 items-center justify-center">
        <span className="absolute h-2 w-2 animate-ping rounded-full bg-amber-300"></span>
        <span className="relative h-2 w-2 rounded-full bg-amber-600"></span>
      </span>
      <span>Dev Mode - Auth Bypassed</span>
    </div>
  );
}

