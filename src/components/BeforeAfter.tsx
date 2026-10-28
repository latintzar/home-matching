"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BeforeAfterProps = {
  before: string;
  after: string;
  altBefore?: string;
  altAfter?: string;
  className?: string;
  caption?: string;
};

export function BeforeAfter({
  before,
  after,
  altBefore = "Before",
  altAfter = "After",
  className,
  caption
}: BeforeAfterProps) {
  const [pos, setPos] = React.useState(50); // percent
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Mouse drag functionality
  const [isDragging, setIsDragging] = React.useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent carousel navigation when dragging slider
    setIsDragging(true);
    setPosFromClientX(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosFromClientX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const setPosFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width);
    const next = Math.round((x / rect.width) * 100);
    setPos(next);
  };

  return (
    <div className={cn("w-full h-full", className)}>
      <div
        ref={containerRef}
        className="relative h-full min-h-[280px] overflow-hidden bg-muted"
        role="group"
        aria-label="Before/After comparison"
      >
        {/* Before layer */}
        {before ? (
        <img
          key={`before-${before}`}
          src={before}
          alt={altBefore}
          className="absolute inset-0 h-full w-full object-cover select-none"
          draggable={false}
          loading="eager"
        />
        ) : (
          <div className="absolute inset-0 h-full w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
            No before image
          </div>
        )}

        {/* After layer clipped by pos (reveal on the RIGHT side) */}
        {after && (
        <div
          key={`after-container-${after}`}
          className="absolute inset-0"
          style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
          aria-hidden="true"
        >
          <img
            key={`after-${after}`}
            src={after}
            alt={altAfter}
            className="absolute inset-0 h-full w-full object-cover select-none"
            draggable={false}
            loading="eager"
          />
        </div>
        )}

        {/* Handle + track - Interactive */}
        <div className="absolute inset-0" onMouseDown={handleMouseDown}>
          <div className="absolute inset-y-0" style={{ left: `calc(${pos}% - 1px)` }}>
            <div className="h-full w-0.5 bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
          </div>

          {/* Interactive handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `calc(${pos}% - 20px)` }}
          >
            <div
              className="pointer-events-auto h-10 w-10 rounded-full border border-white/40 bg-black/70 backdrop-blur-md shadow-xl flex items-center justify-center relative cursor-ew-resize"
              role="slider"
              aria-label="Before/After slider"
              tabIndex={0}
            >
              {/* Chevron icons instead of dots */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-white/95 select-none">
                <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.5]">
                  <path d="M14.5 6.5 9 12l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.5]">
                  <path d="M9.5 17.5 15 12 9.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}