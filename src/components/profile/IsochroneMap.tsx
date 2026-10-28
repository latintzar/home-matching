"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IsochroneMapProps {
  workLocation?: { lat: number; lng: number; address: string } | null;
  sweetSpotAreas?: string[];
  opportunityAreas?: string[];
  maxCommuteMinutes?: number;
}

export function IsochroneMap({
  workLocation,
  sweetSpotAreas = [],
  opportunityAreas = [],
  maxCommuteMinutes = 30,
}: IsochroneMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate map loading
    const timer = setTimeout(() => {
      setIsLoading(false);
      if (!workLocation) {
        setMapError("No se ha definido ubicación de trabajo");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [workLocation]);

  // For now, render a placeholder map
  // In production, this would integrate with Mapbox or similar
  return (
    <Card className="bg-white border-stone-100 rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-lg font-medium text-stone-900 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-500" />
          Tus zonas de búsqueda
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Map Container */}
        <div
          ref={mapRef}
          className="relative h-64 bg-gradient-to-br from-stone-100 to-stone-200"
        >
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
            </div>
          ) : mapError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-500">
              <AlertCircle className="w-10 h-10 mb-2 text-stone-400" />
              <p className="text-sm">{mapError}</p>
              <p className="text-xs text-stone-400 mt-1">
                Habla con Leo para definir tu ubicación
              </p>
            </div>
          ) : (
            <>
              {/* Placeholder map visualization */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Work location marker */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  
                  {/* Isochrone circles */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    {/* Sweet spot - inner circle */}
                    <div className="w-32 h-32 rounded-full bg-green-500/20 border-2 border-green-500/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    
                    {/* Opportunity - outer circle */}
                    <div className="w-48 h-48 rounded-full bg-amber-500/10 border-2 border-amber-500/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Work address label */}
              {workLocation?.address && (
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
                  <p className="text-xs text-stone-500">Trabajo</p>
                  <p className="text-sm font-medium text-stone-900 truncate max-w-[200px]">
                    {workLocation.address}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-stone-100">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500/30 border border-green-500" />
              <span className="text-stone-600">
                Sweet spot ({Math.round(maxCommuteMinutes * 0.6)} min)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500/30 border border-amber-500" />
              <span className="text-stone-600">
                Oportunidad ({maxCommuteMinutes} min)
              </span>
            </div>
          </div>

          {/* Area lists */}
          {(sweetSpotAreas.length > 0 || opportunityAreas.length > 0) && (
            <div className="mt-4 space-y-3">
              {sweetSpotAreas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-green-700 mb-1">
                    Zonas sweet spot:
                  </p>
                  <p className="text-sm text-stone-600">
                    {sweetSpotAreas.join(", ")}
                  </p>
                </div>
              )}
              {opportunityAreas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-700 mb-1">
                    Zonas de oportunidad:
                  </p>
                  <p className="text-sm text-stone-600">
                    {opportunityAreas.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Commute info */}
          <div className="mt-4 flex items-center gap-2 text-sm text-stone-500">
            <Clock className="w-4 h-4" />
            <span>Máximo {maxCommuteMinutes} minutos de commute</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

