'use client';

/**
 * PublicShortlistClient
 * 
 * Client component for displaying a shared shortlist
 * accessed via secure token - no authentication required.
 */

import React, { useState, useEffect } from 'react';

interface ShortlistListing {
  id: string;
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqm: number;
  city: string;
  imageUrl?: string;
  url?: string;
  agentNotes?: string;
}

interface PublicShortlistClientProps {
  token: string;
}

export function PublicShortlistClient({ token }: PublicShortlistClientProps) {
  const [listings, setListings] = useState<ShortlistListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string>('Tu agente');

  useEffect(() => {
    const fetchShortlist = async () => {
      try {
        const res = await fetch(`/api/shortlist/${token}`);
        const data = await res.json();
        
        if (data.success) {
          setListings(data.listings || []);
          setAgentName(data.agentName || 'Tu agente');
        } else {
          setError(data.error || 'No se encontró la shortlist');
        }
      } catch (err) {
        console.error('Error fetching shortlist:', err);
        setError('Error al cargar la shortlist');
      } finally {
        setLoading(false);
      }
    };

    fetchShortlist();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Cargando tu shortlist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Shortlist no encontrada</h1>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-400 mt-4">
            Verifica que el enlace sea correcto o contacta con tu agente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Tu Shortlist 🏠
          </h1>
          <p className="text-gray-600">
            {agentName} ha seleccionado estos {listings.length} pisos para ti
          </p>
        </div>

        {/* Listings Grid */}
        {listings.length > 0 ? (
          <div className="space-y-6">
            {listings.map((listing, i) => (
              <div 
                key={listing.id} 
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="md:flex">
                  {/* Image */}
                  <div className="md:w-1/3 aspect-video md:aspect-auto bg-gray-100 relative">
                    {listing.imageUrl ? (
                      <img 
                        src={listing.imageUrl} 
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300 min-h-[200px]">
                        🏠
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      #{i + 1}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="md:w-2/3 p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-800 text-lg">
                        {listing.title}
                      </h3>
                      <span className="text-lg font-bold text-blue-600 ml-2">
                        {listing.price?.toLocaleString()}€
                      </span>
                    </div>
                    
                    {/* Basic info */}
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                      {listing.bedrooms && <span>🛏️ {listing.bedrooms} hab</span>}
                      {listing.bathrooms && <span>🚿 {listing.bathrooms} baños</span>}
                      {listing.sqm && <span>📐 {listing.sqm}m²</span>}
                      {listing.city && <span>📍 {listing.city}</span>}
                    </div>

                    {/* Agent notes */}
                    {listing.agentNotes && (
                      <div className="bg-blue-50 rounded-lg p-3 mb-3">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Nota del agente:</span> {listing.agentNotes}
                        </p>
                      </div>
                    )}
                    
                    {listing.url && (
                      <a 
                        href={listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                      >
                        Ver en portal →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              La shortlist está vacía
            </h2>
            <p className="text-gray-600">
              Tu agente aún no ha añadido pisos a esta lista.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Powered by Leo 🏠</p>
        </div>
      </div>
    </div>
  );
}

