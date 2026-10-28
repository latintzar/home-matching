'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AmorphousOrbProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'orange' | 'black';
  isAnimating?: boolean;
  isSpeaking?: boolean;
  className?: string;
}

/**
 * Amorphous Orb Component
 * 
 * An organic, blob-like shape that animates smoothly.
 * - When idle: gentle breathing animation
 * - When speaking/active: more dynamic edge movement
 */
export function AmorphousOrb({
  size = 'md',
  color = 'orange',
  isAnimating = false,
  isSpeaking = false,
  className,
}: AmorphousOrbProps) {
  const [blobPath, setBlobPath] = useState(generateBlobPath());
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

  // Size mappings
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-32 h-32',
    xl: 'w-40 h-40',
  };

  // Color mappings - using Leo brand orange
  const colorClasses = {
    orange: 'fill-amber-500',
    black: 'fill-stone-900',
  };

  // Generate blob animation
  useEffect(() => {
    if (!isAnimating && !isSpeaking) {
      // Gentle idle animation
      const idleAnimation = () => {
        const now = Date.now();
        if (now - lastUpdateRef.current > 2000) {
          setBlobPath(generateBlobPath(0.02));
          lastUpdateRef.current = now;
        }
        animationRef.current = requestAnimationFrame(idleAnimation);
      };
      animationRef.current = requestAnimationFrame(idleAnimation);
    } else if (isSpeaking) {
      // More dynamic animation when speaking
      const speakingAnimation = () => {
        const now = Date.now();
        const updateInterval = 100; // Faster updates when speaking
        if (now - lastUpdateRef.current > updateInterval) {
          setBlobPath(generateBlobPath(0.15)); // More variance when speaking
          lastUpdateRef.current = now;
        }
        animationRef.current = requestAnimationFrame(speakingAnimation);
      };
      animationRef.current = requestAnimationFrame(speakingAnimation);
    } else if (isAnimating) {
      // Medium animation when active but not speaking
      const activeAnimation = () => {
        const now = Date.now();
        if (now - lastUpdateRef.current > 500) {
          setBlobPath(generateBlobPath(0.08));
          lastUpdateRef.current = now;
        }
        animationRef.current = requestAnimationFrame(activeAnimation);
      };
      animationRef.current = requestAnimationFrame(activeAnimation);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, isSpeaking]);

  return (
    <div className={cn('relative', sizeClasses[size], className)}>
      {/* Glow effect when speaking */}
      {isSpeaking && (
        <div 
          className={cn(
            'absolute inset-0 rounded-full blur-xl opacity-40 animate-pulse',
            color === 'black' ? 'bg-stone-600' : 'bg-amber-400'
          )} 
        />
      )}
      
      {/* Main blob SVG - Added padding to viewBox to prevent clipping */}
      <svg
        viewBox="-15 -15 130 130"
        className={cn(
          'w-full h-full transition-all overflow-visible',
          isSpeaking ? 'duration-100' : 'duration-1000'
        )}
      >
        <path
          d={blobPath}
          className={cn(
            colorClasses[color],
            'transition-all',
            isSpeaking ? 'duration-100' : 'duration-1000'
          )}
        />
      </svg>
      
      {/* Inner highlight for depth */}
      <div 
        className={cn(
          'absolute inset-[25%] rounded-full opacity-20',
          color === 'black' ? 'bg-stone-400' : 'bg-white'
        )} 
        style={{
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
}

/**
 * Generate an amorphous blob path using bezier curves
 * @param variance - How much the blob deviates from a circle (0-1)
 */
function generateBlobPath(variance: number = 0.1): string {
  const points = 8; // Number of control points
  const radius = 45; // Base radius
  const center = 50; // Center of viewBox
  
  const controlPoints: { x: number; y: number }[] = [];
  
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const randomRadius = radius + (Math.random() - 0.5) * radius * variance * 2;
    controlPoints.push({
      x: center + Math.cos(angle) * randomRadius,
      y: center + Math.sin(angle) * randomRadius,
    });
  }
  
  // Create smooth bezier curve through points
  let path = `M ${controlPoints[0].x} ${controlPoints[0].y}`;
  
  for (let i = 0; i < points; i++) {
    const current = controlPoints[i];
    const next = controlPoints[(i + 1) % points];
    const nextNext = controlPoints[(i + 2) % points];
    
    // Calculate control points for smooth curve
    const cp1x = current.x + (next.x - controlPoints[(i - 1 + points) % points].x) / 4;
    const cp1y = current.y + (next.y - controlPoints[(i - 1 + points) % points].y) / 4;
    const cp2x = next.x - (nextNext.x - current.x) / 4;
    const cp2y = next.y - (nextNext.y - current.y) / 4;
    
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  
  path += ' Z';
  return path;
}

/**
 * Mini orb for sidebar icon - static but amorphous
 */
export function MiniAmorphousOrb({ className }: { className?: string }) {
  // Pre-generated blob path for consistency
  const staticPath = "M 50 5 C 65 5, 85 15, 92 30 C 99 45, 95 65, 85 80 C 75 95, 55 98, 40 92 C 25 86, 8 70, 5 50 C 2 30, 15 12, 30 6 C 45 0, 50 5, 50 5 Z";
  
  return (
    <svg viewBox="0 0 100 100" className={cn('fill-amber-500', className)}>
      <path d={staticPath} />
    </svg>
  );
}

