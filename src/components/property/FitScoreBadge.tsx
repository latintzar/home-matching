"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Check, AlertTriangle } from "lucide-react";

interface FitScoreBadgeProps {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function FitScoreBadge({ 
  score, 
  size = "md", 
  showLabel = true,
  className 
}: FitScoreBadgeProps) {
  // Determine score category
  const isExcellent = score >= 85;
  const isGood = score >= 70 && score < 85;
  const isFair = score >= 50 && score < 70;
  const isPoor = score < 50;

  // Get label
  const getLabel = () => {
    if (isExcellent) return "Encaja perfecto";
    if (isGood) return "Buen match";
    if (isFair) return "Podría encajar";
    return "Revisa detalles";
  };

  // Get colors
  const getColors = () => {
    if (isExcellent) return {
      bg: "bg-green-500",
      bgLight: "bg-green-100",
      text: "text-green-700",
      border: "border-green-200",
    };
    if (isGood) return {
      bg: "bg-emerald-500",
      bgLight: "bg-emerald-100",
      text: "text-emerald-700",
      border: "border-emerald-200",
    };
    if (isFair) return {
      bg: "bg-yellow-500",
      bgLight: "bg-yellow-100",
      text: "text-yellow-700",
      border: "border-yellow-200",
    };
    return {
      bg: "bg-stone-400",
      bgLight: "bg-stone-100",
      text: "text-stone-600",
      border: "border-stone-200",
    };
  };

  const colors = getColors();

  // Size classes
  const sizeClasses = {
    sm: {
      container: "px-2 py-1 text-xs gap-1",
      icon: "w-3 h-3",
      score: "text-xs font-medium",
    },
    md: {
      container: "px-3 py-1.5 text-sm gap-1.5",
      icon: "w-4 h-4",
      score: "text-sm font-semibold",
    },
    lg: {
      container: "px-4 py-2 text-base gap-2",
      icon: "w-5 h-5",
      score: "text-base font-semibold",
    },
  };

  const sizes = sizeClasses[size];

  // Compact badge (just score)
  if (!showLabel) {
    return (
      <div 
        className={cn(
          "inline-flex items-center gap-1 rounded-full",
          colors.bg,
          "text-white",
          sizes.container,
          className
        )}
      >
        {isExcellent && <Sparkles className={sizes.icon} />}
        <span className={sizes.score}>{score}</span>
      </div>
    );
  }

  // Full badge with label
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border",
        colors.bgLight,
        colors.border,
        colors.text,
        sizes.container,
        className
      )}
    >
      {isExcellent ? (
        <Sparkles className={sizes.icon} />
      ) : isGood ? (
        <Check className={sizes.icon} />
      ) : isFair ? (
        <AlertTriangle className={sizes.icon} />
      ) : null}
      <span className={sizes.score}>{score}</span>
      <span className="opacity-80">{getLabel()}</span>
    </div>
  );
}

// Compact score indicator (for lists)
export function FitScoreIndicator({ score }: { score: number }) {
  const isExcellent = score >= 85;
  const isGood = score >= 70;
  const isFair = score >= 50;

  const bgColor = isExcellent 
    ? "bg-green-500" 
    : isGood 
    ? "bg-emerald-500" 
    : isFair 
    ? "bg-yellow-500" 
    : "bg-stone-300";

  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-8 h-1.5 rounded-full", bgColor)} />
      <span className="text-sm text-stone-600">{score}</span>
    </div>
  );
}

