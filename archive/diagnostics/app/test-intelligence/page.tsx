"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, CheckCircle, MapPin, Building, Wifi, Activity, Star, Euro } from "lucide-react";

interface IntelligenceResult {
  social: {
    summary: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    airbnb: {
      nearbyListings: number;
      redFlags: Array<{ date: string; text: string }>;
      touristSaturationLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      listingsDetail: Array<{
        id: string;
        name: string;
        price: string;
        rating: number;
        lat: number;
        lon: number;
      }>;
    };
  };
  visual: {
    vibe_score: number;
    maintenance_condition: string;
    security_features: string[];
    summary: string;
  };
  tenders: {
    activeWorks: any[];
    summary: string;
  };
  geology: {
    clayRisk: boolean;
    floodRisk: boolean;
    details: string;
  };
  coordinates: {
    lat: number;
    lng: number;
  };
  mapApiKey?: string;
}

export default function TestIntelligencePage() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Analysis failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'HIGH': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const generateStaticMapUrl = () => {
    if (!result || !result.mapApiKey) return '';
    
    const center = `${result.coordinates.lat},${result.coordinates.lng}`;
    const markers = result.social.airbnb.listingsDetail
      .slice(0, 15) // Limit markers to avoid URL length issues
      .map(l => `markers=color:red%7Cscale:1%7C${l.lat},${l.lon}`)
      .join('&');
    
    // Add center marker (blue)
    const centerMarker = `markers=color:blue%7Csize:mid%7Clabel:C%7C${center}`;
    
    return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=15&size=600x400&maptype=roadmap&${centerMarker}&${markers}&key=${result.mapApiKey}`;
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Intelligence Suite Debugger</h1>
        <p className="text-muted-foreground">
          Test the property intelligence modules on any address in Spain.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run Analysis</CardTitle>
          <CardDescription>Enter a full address to trigger all intelligence gathering modules.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="address" className="sr-only">Address</Label>
              <Input 
                id="address" 
                placeholder="e.g., Carrer de Torrent de les Flors 54, Barcelona" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <Button onClick={handleAnalyze} disabled={loading || !address}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Run Analysis'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-800">
            <AlertTriangle className="inline mr-2 h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      {result && (
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary & Risks</TabsTrigger>
            <TabsTrigger value="social">Social Radar</TabsTrigger>
            <TabsTrigger value="visual">Visual Detective</TabsTrigger>
            <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Overall Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className={`${getRiskColor(result.social.riskLevel)} text-white`}>
                      {result.social.riskLevel} RISK
                    </Badge>
                    <span className="text-sm text-muted-foreground">Based on social & community data</span>
                  </div>
                  <p className="text-sm">{result.social.summary}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location Vibe
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="flex items-center gap-4 mb-4">
                    <div className="text-2xl font-bold">{result.visual.vibe_score}/10</div>
                    <div className="text-sm text-muted-foreground">Vibe Score</div>
                   </div>
                   <p className="text-sm">{result.visual.summary}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="social" className="mt-4">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tourist Market (Airbnb Proxy)</CardTitle>
                  <CardDescription>Insights from nearby short-term rentals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{result.social.airbnb.nearbyListings}</div>
                      <div className="text-sm text-muted-foreground">Nearby Listings</div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{result.social.airbnb.touristSaturationLevel}</div>
                      <div className="text-sm text-muted-foreground">Saturation Level</div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{result.social.airbnb.redFlags.length}</div>
                      <div className="text-sm text-muted-foreground">Red Flags Detected</div>
                    </div>
                  </div>
                  
                  {/* Map Visualization */}
                  {result.social.airbnb.listingsDetail.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-medium mb-2">Listing Map</h3>
                      <div className="rounded-lg overflow-hidden border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={generateStaticMapUrl()} 
                          alt="Map of nearby Airbnb listings" 
                          className="w-full h-[300px] object-cover"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Blue pin: Search location. Red pins: Nearby listings.</p>
                    </div>
                  )}

                  {/* Listings List */}
                  {result.social.airbnb.listingsDetail.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="font-medium">Nearby Listings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2">
                            {result.social.airbnb.listingsDetail.map((listing, i) => (
                                <div key={i} className="p-3 border rounded flex justify-between items-start text-sm">
                                    <div className="truncate pr-2">
                                        <div className="font-medium truncate" title={listing.name}>{listing.name}</div>
                                        <div className="text-muted-foreground flex items-center gap-1 mt-1">
                                            <Euro className="h-3 w-3" /> {listing.price}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 bg-slate-100 px-2 py-1 rounded">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        <span className="font-medium">{listing.rating || 'N/A'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                  )}

                  {result.social.airbnb.redFlags.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                      <Label>Flagged Review Excerpts:</Label>
                      <ul className="space-y-2">
                        {result.social.airbnb.redFlags.map((flag, i) => (
                          <li key={i} className="text-sm p-3 bg-orange-50 border border-orange-100 rounded">
                            <span className="font-semibold block text-xs text-orange-800 mb-1">{flag.date}</span>
                            "{flag.text}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="visual" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Visual Detective</CardTitle>
                <CardDescription>AI Analysis of Street View Imagery</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-2">Maintenance Condition</h3>
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded">{result.visual.maintenance_condition}</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Security Features</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.visual.security_features.map((feature, i) => (
                        <Badge key={i} variant="outline">{feature}</Badge>
                      ))}
                      {result.visual.security_features.length === 0 && <span className="text-sm text-muted-foreground">No specific features detected</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="infrastructure" className="mt-4">
            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Public Works & Tenders
                   </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4">{result.tenders.summary}</p>
                  {result.tenders.activeWorks.length > 0 && (
                    <div className="space-y-2">
                      <Label>Active Tenders:</Label>
                      {result.tenders.activeWorks.map((work, i) => (
                        <div key={i} className="text-sm p-3 border rounded">
                          <div className="font-medium">{work.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">{work.date}</div>
                          <div className="text-xs mt-2">{work.summary}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Geological Risks
                   </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className={`p-4 rounded-lg border ${result.geology.clayRisk ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <div className="font-semibold mb-1">Expansive Clay</div>
                      <div className="text-sm">{result.geology.clayRisk ? 'Risk Detected' : 'Low Risk'}</div>
                    </div>
                    <div className={`p-4 rounded-lg border ${result.geology.floodRisk ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <div className="font-semibold mb-1">Flood Risk</div>
                      <div className="text-sm">{result.geology.floodRisk ? 'Risk Detected' : 'Low Risk'}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.geology.details}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
