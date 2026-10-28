'use client';

import { useState } from 'react';
import { LifestyleForm } from '@/components/lifestyle/LifestyleForm';
import { LifestyleMapLibre } from '@/components/lifestyle/LifestyleMapLibre';
import { HexScore, LifestyleProfile } from '@/types/lifestyle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LifestyleMatcherPage() {
  const [profile, setProfile] = useState<LifestyleProfile | null>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProfileGenerated = async (newProfile: LifestyleProfile) => {
    setProfile(newProfile);
    setLoadingMap(true);
    setError(null);
    
    try {
      // Generate Polygon
      const res = await fetch('/api/lifestyle/generate-polygon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: newProfile }),
      });
      
      const data = await res.json();
      if (data.success) {
        setGeojsonData(data.geojson || data);
      } else {
        setError(data.error || 'Failed to generate map');
      }
    } catch (err) {
      setError('Failed to generate map');
      console.error(err);
    } finally {
      setLoadingMap(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-3xl font-bold">Leo Lifestyle Matcher</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <LifestyleForm onProfileGenerated={handleProfileGenerated} />
          
          {profile && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Extracted Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs overflow-auto bg-gray-100 p-2 rounded max-h-[300px]">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {error && (
             <div className="mt-4 p-4 bg-red-100 text-red-800 rounded">
               {error}
             </div>
          )}
        </div>

        <div className="min-h-[600px] border rounded-lg overflow-hidden bg-gray-50 relative">
          {loadingMap && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
              Generating Map... (This may take a moment)
            </div>
          )}
          <LifestyleMapLibre 
            geojsonData={geojsonData} 
            center={profile?.anchors[0]?.location} 
          />
        </div>
      </div>
    </div>
  );
}
