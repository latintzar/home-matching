"use client";

import Link from "next/link";
import { MessageCircle, Heart, Eye, FileText, MapPin, Briefcase, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IsochroneMap } from "@/components/profile/IsochroneMap";
import { useTranslations } from "@/lib/i18n/index";
import type { User } from "@supabase/supabase-js";

interface NeedsSummary {
  headline?: string;
  bullets?: string[];
  personality?: string;
}

interface UserProfile {
  needs_summary?: NeedsSummary;
  work_lat?: number;
  work_lng?: number;
  work_location?: string;
  sweet_spot_areas?: string[];
  opportunity_areas?: string[];
  max_commute_minutes?: number;
  budget_min?: number;
  budget_max?: number;
  bedrooms_min?: number;
  preferred_areas?: string[];
  lifestyle_notes?: string;
}

interface ProfileContentProps {
  user: User | null;
  profile: UserProfile | null;
  stats: {
    saved: number;
    viewed: number;
    notes: number;
  };
}

export function ProfileContent({ user, profile, stats }: ProfileContentProps) {
  const t = useTranslations();
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario";
  
  // Format price in Spanish locale
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Parse needs summary
  const needsSummary = profile?.needs_summary ?? null;

  // Parse work location for map
  const workLocation = profile?.work_lat && profile?.work_lng
    ? {
        lat: profile.work_lat,
        lng: profile.work_lng,
        address: profile.work_location || "",
      }
    : null;

  const sweetSpotAreas = profile?.sweet_spot_areas ?? [];
  
  const opportunityAreas = profile?.opportunity_areas ?? [];

  const maxCommuteMinutes = profile?.max_commute_minutes ?? 30;

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl font-medium text-stone-900 mb-2">
          {t.profile.title}
        </h1>
        <p className="text-stone-600">
          {t.profile.subtitle}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="bg-white border-stone-100 rounded-2xl shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center mx-auto mb-2">
              <Heart className="w-5 h-5 text-rose-600" />
            </div>
            <p className="text-2xl font-semibold text-stone-900">{stats.saved}</p>
            <p className="text-sm text-stone-500">{t.dashboard.saved}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-stone-100 rounded-2xl shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-2">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-semibold text-stone-900">{stats.viewed}</p>
            <p className="text-sm text-stone-500">{t.dashboard.viewed}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-stone-100 rounded-2xl shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-semibold text-stone-900">{stats.notes}</p>
            <p className="text-sm text-stone-500">{t.dashboard.notes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Needs Summary - Leo's understanding */}
      {needsSummary && (needsSummary.headline || needsSummary.bullets?.length) ? (
        <Card className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-stone-200 rounded-2xl shadow-sm mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <CardTitle className="font-serif text-lg font-medium text-stone-900">
                {t.profile.leoUnderstands}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Headline */}
            {needsSummary.headline && (
              <p className="text-lg font-medium text-stone-800">
                {needsSummary.headline}
              </p>
            )}
            
            {/* Bullet points */}
            {needsSummary.bullets && needsSummary.bullets.length > 0 && (
              <ul className="space-y-2">
                {needsSummary.bullets.map((bullet, index) => (
                  <li key={index} className="text-stone-700 text-sm leading-relaxed">
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
            
            {/* Personality note */}
            {needsSummary.personality && (
              <p className="text-sm text-stone-500 italic border-t border-stone-200 pt-3 mt-3">
                {needsSummary.personality}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-stone-50 border-stone-200 rounded-2xl shadow-sm mb-6">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="font-medium text-stone-900 mb-1">
              {t.profile.tellLeo}
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              {t.profile.tellLeoDescription}
            </p>
            <Button asChild size="sm" className="rounded-full bg-amber-500 hover:bg-amber-600">
              <Link href="/speak-with-leo">
                {t.nav.speakWithLeo}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Isochrone Map */}
      <div className="mb-6">
        <IsochroneMap
          workLocation={workLocation}
          sweetSpotAreas={sweetSpotAreas}
          opportunityAreas={opportunityAreas}
          maxCommuteMinutes={maxCommuteMinutes}
        />
      </div>

      {/* Profile Summary */}
      <Card className="bg-white border-stone-100 rounded-2xl shadow-sm mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg font-medium text-stone-900">
            {t.profile.whatILookFor}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Budget */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-green-600 font-medium text-sm">€</span>
            </div>
            <div>
              <p className="text-sm text-stone-500">{t.profile.budget}</p>
              <p className="font-medium text-stone-900">
                {profile?.budget_min && profile?.budget_max 
                  ? `${formatPrice(profile.budget_min)} - ${formatPrice(profile.budget_max)}`
                  : t.profile.notDefined
                }
              </p>
            </div>
          </div>

          {/* Bedrooms */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <span className="text-purple-600 font-medium text-sm">🛏️</span>
            </div>
            <div>
              <p className="text-sm text-stone-500">{t.profile.bedrooms}</p>
              <p className="font-medium text-stone-900">
                {profile?.bedrooms_min ? `${profile.bedrooms_min}+ ${t.property.beds}` : t.profile.notDefined}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-stone-500">{t.profile.preferredAreas}</p>
              <p className="font-medium text-stone-900">
                {profile?.preferred_areas && profile.preferred_areas.length > 0
                  ? profile.preferred_areas.join(", ")
                  : t.profile.notDefined
                }
              </p>
            </div>
          </div>

          {/* Work location */}
          {profile?.work_location && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">{t.profile.workLocation}</p>
                <p className="font-medium text-stone-900">{profile.work_location}</p>
              </div>
            </div>
          )}

          {/* Commute */}
          {profile?.max_commute_minutes && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">{t.profile.maxCommute}</p>
                <p className="font-medium text-stone-900">{profile.max_commute_minutes} {t.profile.minutes}</p>
              </div>
            </div>
          )}

          {/* Lifestyle notes */}
          {profile?.lifestyle_notes && (
            <div className="pt-4 border-t border-stone-100">
              <p className="text-sm text-stone-500 mb-2">{t.profile.additionalNotes}</p>
              <p className="text-stone-700 text-sm">{profile.lifestyle_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Speak with Leo CTA */}
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/50 rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-serif text-lg font-medium text-stone-900 mb-1">
                {t.profile.wantToChange}
              </h3>
              <p className="text-sm text-stone-600">
                {t.profile.tellLeoUpdate}
              </p>
            </div>
            <Button asChild className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
              <Link href="/speak-with-leo" className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                {t.nav.speakWithLeo}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
