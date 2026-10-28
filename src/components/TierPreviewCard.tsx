"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { ArrowRight, MessageCircle } from "lucide-react";

interface TierPreviewCardProps {
  tier: 'livable' | 'comfortable' | 'competitive';
  tierName: string;
  priceRange: string;
  afterPhotoUrl?: string;
  onClick: () => void;
}

export const TierPreviewCard: React.FC<TierPreviewCardProps> = ({
  tier,
  tierName,
  priceRange,
  afterPhotoUrl,
  onClick
}) => {
  return (
    <Card 
      className="mt-4 cursor-pointer hover:shadow-md transition-all duration-200 border overflow-hidden group"
      onClick={onClick}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        {afterPhotoUrl && (
          <div className="w-full sm:w-32 h-32 flex-shrink-0 relative overflow-hidden bg-muted">
            <img 
              src={afterPhotoUrl}
              alt={`${tierName} renovation preview`}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground">{tierName}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-sm text-muted-foreground">{priceRange}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">See our renovation idea</p>
        </div>
      </div>
    </Card>
  );
};

