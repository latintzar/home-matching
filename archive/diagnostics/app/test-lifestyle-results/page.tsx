'use client';

import { useState, useEffect } from 'react'; // Added useEffect
// import { LifestyleMap } from '@/components/lifestyle/LifestyleMap';
import { LifestyleMapLibre } from '@/components/lifestyle/LifestyleMapLibre';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function LifestyleResultsViewer() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the results JSON file
    fetch('/api/lifestyle/test-results')
      .then(res => res.json())
      .then(data => {
        setResults(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load results:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center">Loading test results...</div>;
  if (results.length === 0) return <div className="p-8 text-center">No results found. Run the bulk test script first.</div>;

  const currentResult = results[currentIndex];
  const profile = currentResult.profile;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % results.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + results.length) % results.length);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lifestyle Algorithm Test Results</h1>
        <div className="flex items-center space-x-4">
          <button className="px-4 py-2 border rounded" onClick={handlePrev} disabled={results.length <= 1}>
             Prev
          </button>
          <span className="font-mono">
            {currentIndex + 1} / {results.length}
          </span>
          <button className="px-4 py-2 border rounded" onClick={handleNext} disabled={results.length <= 1}>
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input & Profile */}
        <div className="space-y-6">
          <div className="border p-4 rounded shadow bg-white">
            <h2 className="font-bold text-lg mb-2">User Input</h2>
              <p className="text-lg italic text-gray-700">"{currentResult.input_text}"</p>
          </div>

          <div className="border p-4 rounded shadow bg-white">
            <h2 className="font-bold text-lg mb-2">Extracted Profile</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Anchors</h3>
                  <ul className="space-y-2 text-sm">
                    {profile.anchors.map((anchor: any, i: number) => (
                      <li key={i} className="bg-gray-50 p-2 rounded border">
                        <div className="font-medium">{anchor.type.toUpperCase()}</div>
                        <div>{anchor.location.address || `${anchor.location.lat}, ${anchor.location.lng}`}</div>
                        <div className="text-gray-500">
                          {anchor.transport_mode} • Max {anchor.max_duration_minutes} mins
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Vibe</h3>
                  <ul className="space-y-2 text-sm">
                    {profile.vibe.map((v: any, i: number) => (
                      <li key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                        <span>{v.amenity_type}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          v.importance === 'must_have' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {v.importance.replace('_', ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
          </div>

          <div className="border p-4 rounded shadow bg-white">
             <h2 className="font-bold text-lg mb-2">Stats</h2>
                 <div className="grid grid-cols-2 gap-4 text-center">
                     <div className="bg-green-50 p-2 rounded">
                         <div className="text-2xl font-bold text-green-700">{currentResult.stats?.sweetSpotAreaKm2 || 0}</div>
                         <div className="text-xs text-green-600">Sweet Spot Area (km²)</div>
                     </div>
                     <div className="bg-blue-50 p-2 rounded">
                         <div className="text-2xl font-bold text-blue-700">{currentResult.stats?.anchorsCount || 0}</div>
                         <div className="text-xs text-blue-600">Anchors Met</div>
                     </div>
                 </div>
          </div>
        </div>

        {/* Right Column: Map */}
        <div className="lg:col-span-2 h-[600px] border rounded-lg overflow-hidden bg-gray-50 relative flex flex-col">
          <LifestyleMapLibre 
            key={currentResult.id} // Force re-render on change
            geojsonData={currentResult.mapData} 
            center={profile.anchors[0]?.location} 
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}

