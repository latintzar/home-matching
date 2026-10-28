'use client';
import {useState} from 'react';
import {RecommendationResults} from '../../src/components/recommender/RecommendationResults';
import {scoreAndRankListingsV2} from '../../src/lib/recommender/fitScoringV2';
import {homes, profiles} from '../../tools/home-fixtures.mjs';

export default function FirstMatchPage() {
  const [profileName, setProfileName] = useState<'homeOffice'|'outdoorSpace'>('homeOffice');
  const results = scoreAndRankListingsV2(homes as any, profiles[profileName] as any);
  const listings = results.filter(result => result.fitResult.pass).map(result => ({
    listing: {...result.listing, listing_id: (result.listing as any).id, url: '', region: '', image_urls: []},
    fitScore: result.fitResult.score,
    breakdown: {},
    topReasons: result.fitResult.topMatches,
    concerns: result.fitResult.concerns,
    explanation: result.fitResult.reason,
  }));
  return <>
    <nav className="bg-white border-b border-emerald-100 px-4 py-4" aria-label="Perfil del ejemplo">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div><strong className="text-stone-900 text-lg">Leo.casa</strong><p className="text-sm text-stone-600">Ejemplo sintético · importes de compra ficticios</p></div>
        <div className="flex flex-wrap gap-2">
          <button aria-pressed={profileName === 'homeOffice'} onClick={() => setProfileName('homeOffice')} className={'px-4 py-2 rounded-lg border '+(profileName==='homeOffice'?'bg-emerald-600 text-white':'bg-white text-emerald-800')}>Trabajo desde casa</button>
          <button aria-pressed={profileName === 'outdoorSpace'} onClick={() => setProfileName('outdoorSpace')} className={'px-4 py-2 rounded-lg border '+(profileName==='outdoorSpace'?'bg-emerald-600 text-white':'bg-white text-emerald-800')}>Exterior y mascota</button>
        </div>
      </div>
    </nav>
    <RecommendationResults profile={{constraints:{maxBudget:260000},propertyPreferences:{minBedrooms:2,minSqm:60},lifestyle:{mustHaves:[]}} as any} searchResult={{listings:listings as any,total:listings.length,wpaEnabled:false}} />
    <footer className="bg-white px-4 py-5 text-center text-sm text-stone-600">made by atelier neyra</footer>
  </>;
}
