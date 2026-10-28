'use client';

import type { LifeProfile, SweetSpot } from '@/types/recommender';

export interface ScoredRecommendation {
  listing: { listing_id: string; url: string; title: string; price: number; bedrooms: number; bathrooms: number; sqm: number; city: string; region: string; image_urls: string[] };
  fitScore: number;
  breakdown: Record<string, number>;
  topReasons: string[];
  concerns: string[];
  explanation: string;
}
export interface RecommendationSearchResult { listings: ScoredRecommendation[]; total: number; sweetSpot?: SweetSpot; wpaEnabled?: boolean; }

/** Existing /recommend results scene, extracted for recipient-owned or synthetic data. */
export function RecommendationResults({ profile, searchResult, error = null, onEditProfile }: {
  profile: LifeProfile | null;
  searchResult: RecommendationSearchResult | null;
  error?: string | null;
  onEditProfile?: () => void;
}) {
  const handleStartOver = onEditProfile;
  return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Tus recomendaciones 🎯
              </h1>
              <p className="text-gray-600">
                {searchResult?.total || 0} propiedades encontradas
              </p>
            </div>
            <button
              onClick={handleStartOver}
              hidden={!handleStartOver}
              className="px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              Editar perfil
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-8">
              <p className="font-medium">Error en la búsqueda</p>
              <p className="text-sm">{error}</p>
              <p className="text-xs mt-2 text-red-500">
                Nota: El harvest está en progreso. Puede que no haya datos parseados aún.
              </p>
            </div>
          )}

          {/* Profile Summary */}
          {profile && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <h3 className="font-semibold text-gray-700 mb-3">Tu perfil</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                  💰 Hasta {((profile.constraints?.maxBudget || 0) / 1000).toFixed(0)}k €
                </span>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                  🛏️ {profile.propertyPreferences?.minBedrooms}+ hab
                </span>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                  📐 {profile.propertyPreferences?.minSqm}+ m²
                </span>
                {profile.lifestyle?.mustHaves?.map((must) => (
                  <span key={must} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                    ✅ {must}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sweet Spot Display */}
          {searchResult?.sweetSpot && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <h3 className="font-semibold text-gray-700 mb-3">📍 Tu Sweet Spot</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-emerald-600 mb-2">✅ Zonas ideales</p>
                  <div className="space-y-1">
                    {searchResult.sweetSpot.primary.map((loc) => (
                      <div key={loc.name} className="flex items-center justify-between text-sm">
                        <span>{loc.name}</span>
                        <span className="text-emerald-600 font-medium">{loc.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-600 mb-2">⚠️ Posibles</p>
                  <div className="space-y-1">
                    {searchResult.sweetSpot.secondary.map((loc) => (
                      <div key={loc.name} className="flex items-center justify-between text-sm">
                        <span>{loc.name}</span>
                        <span className="text-amber-600 font-medium">{loc.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-600 mb-2">❌ A evitar</p>
                  <div className="space-y-1">
                    {searchResult.sweetSpot.avoid.slice(0, 3).map((loc) => (
                      <div key={loc.name} className="flex items-center justify-between text-sm">
                        <span>{loc.name}</span>
                        <span className="text-red-600 font-medium">{loc.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Grid */}
          {searchResult && searchResult.listings.length > 0 ? (
            <div className="space-y-6">
              {searchResult.listings.map((scored, i) => (
                <div key={scored.listing.listing_id || i} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="md:flex">
                    {/* Image */}
                    <div className="md:w-1/3 aspect-video md:aspect-auto bg-gray-100 relative">
                      {scored.listing.image_urls?.[0] ? (
                        <img 
                          src={scored.listing.image_urls[0]} 
                          alt={scored.listing.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300 min-h-[200px]">
                          🏠
                        </div>
                      )}
                      {/* Fit Score Badge */}
                      <div className={`absolute top-3 right-3 px-3 py-1 rounded-full font-bold text-white ${
                        scored.fitScore >= 75 ? 'bg-emerald-500' :
                        scored.fitScore >= 60 ? 'bg-amber-500' :
                        scored.fitScore >= 45 ? 'bg-orange-500' : 'bg-red-500'
                      }`}>
                        {scored.fitScore}% fit
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="md:w-2/3 p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-800 text-lg line-clamp-1">
                          {scored.listing.title || 'Sin título'}
                        </h4>
                        {scored.listing.price && (
                          <span className="text-lg font-bold text-emerald-600 ml-2 whitespace-nowrap">
                            {scored.listing.price.toLocaleString()}€
                          </span>
                        )}
                      </div>
                      
                      {/* Basic info */}
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                        {scored.listing.bedrooms && <span>🛏️ {scored.listing.bedrooms} hab</span>}
                        {scored.listing.bathrooms && <span>🚿 {scored.listing.bathrooms} baños</span>}
                        {scored.listing.sqm && <span>📐 {scored.listing.sqm}m²</span>}
                        <span>📍 {scored.listing.city || scored.listing.region || 'España'}</span>
                      </div>

                      {/* Explanation */}
                      {scored.explanation && (
                        <p className="text-sm text-gray-600 mb-3">{scored.explanation}</p>
                      )}

                      {/* Reasons & Concerns */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {scored.topReasons.slice(0, 3).map((reason, j) => (
                          <span key={j} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                            {reason}
                          </span>
                        ))}
                        {scored.concerns.slice(0, 2).map((concern, j) => (
                          <span key={j} className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-full">
                            {concern}
                          </span>
                        ))}
                      </div>

                      {/* Score breakdown (mini) */}
                      {searchResult.wpaEnabled && scored.breakdown && (
                        <div className="flex gap-2 text-xs text-gray-400 mb-3">
                          <span title="Luz natural">☀️{scored.breakdown.naturalLight}</span>
                          <span title="Tranquilidad">🤫{scored.breakdown.noise}</span>
                          <span title="Exterior">🌿{scored.breakdown.outdoorSpace}</span>
                          <span title="Estado">✨{scored.breakdown.condition}</span>
                          <span title="Distribución">📐{scored.breakdown.layout}</span>
                        </div>
                      )}
                      
                      {scored.listing.url && (
                        <a 
                          href={scored.listing.url}
                          target={scored.listing.url.startsWith('/') && !scored.listing.url.startsWith('//') ? undefined : '_blank'}
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
                        >
                          Ver propiedad →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="text-6xl mb-4">🏗️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {searchResult?.total === 0 ? 'No hay propiedades aún' : 'Cargando propiedades...'}
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                El sistema de harvest está recopilando propiedades. 
                Una vez procesadas, aparecerán aquí filtradas por tu perfil.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto text-sm text-gray-500">
                <div className="bg-emerald-50 rounded-lg p-4">
                  <div className="text-2xl mb-1">✅</div>
                  <div>Perfil guardado</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4">
                  <div className="text-2xl mb-1">✅</div>
                  <div>Sweet spot</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <div className="text-2xl mb-1">⏳</div>
                  <div>Harvest en curso</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
