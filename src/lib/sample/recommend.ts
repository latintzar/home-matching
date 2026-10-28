import {sampleHomes} from './seed.mjs';
import {calculatePreWpaFitScore,scoreAndRankListingsV2} from '@/lib/recommender/fitScoringV2';
import {convertToUserFitProfile} from '@/lib/recommender/profileFit';
import type {LifeProfile} from '@/types/recommender';
import {appBasePath} from '../app-path';

/** Original deterministic fit pipeline over stored, authored WPA/area evidence. */
export function sampleRecommendations(profile:LifeProfile,maxResults=20) {
  const homes=sampleHomes(appBasePath);
  const prefilter={budget:{max:profile.constraints.maxBudget},preferredLocations:profile.propertyPreferences.preferredLocations,
    avoidLocations:profile.propertyPreferences.avoidLocations,minSqm:profile.propertyPreferences.minSqm,minBedrooms:profile.propertyPreferences.minBedrooms};
  const candidates=homes.filter(home=>calculatePreWpaFitScore(home.listing,prefilter).score>=40);
  const ranked=scoreAndRankListingsV2(candidates as any,convertToUserFitProfile(profile));
  const listings=ranked.filter(item=>item.fitResult.pass).slice(0,Math.max(1,Math.min(20,maxResults))).map(item=>{
    const listing=homes.find(home=>home.wpa.listing_id===item.wpa.listing_id)?.listing;
    if(!listing)throw new Error('Cached analysis is missing its listing.');
    return {listing:{...listing,bathrooms:Number(listing.bathrooms)},
    fitScore:item.fitResult.score,breakdown:item.fitResult.breakdown,topReasons:item.fitResult.topMatches,
    concerns:item.fitResult.concerns,explanation:item.fitResult.reason,
  };});
  return {success:true,results:{listings,total:homes.length,wpaEnabled:true},
    recommendations:listings.map(item=>({...item.listing,...item})),
    stats:{totalFound:homes.length,totalAnalyzed:homes.length,returned:listings.length},sample:true};
}
