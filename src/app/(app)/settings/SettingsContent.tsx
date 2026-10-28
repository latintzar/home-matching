"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, LogOut, Bell, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { signOut } from "@/lib/supabase-browser";
import { useLanguage, useTranslations } from "@/lib/i18n/index";
import type { User } from "@supabase/supabase-js";

interface SettingsContentProps {
  user: User | null;
  currentLanguage: string;
}

export function SettingsContent({ user, currentLanguage }: SettingsContentProps) {
  const router = useRouter();
  const { language, setLanguage: setContextLanguage } = useLanguage();
  const t = useTranslations();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleLanguageChange = async (newLanguage: 'es' | 'en') => {
    setIsSaving(true);
    setSaved(false);

    try {
      // Update context (which also persists to backend)
      await setContextLanguage(newLanguage);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      
      // Refresh the page to update server-rendered content
      router.refresh();
    } catch (error) {
      console.error("Failed to save language:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl font-medium text-stone-900 mb-2">
          {t.settings.title}
        </h1>
        <p className="text-stone-600">
          {t.settings.subtitle}
        </p>
      </div>

      {/* Language Setting */}
      <Card className="bg-white border-stone-100 rounded-2xl shadow-sm mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-medium text-stone-900">
                {t.settings.language}
              </CardTitle>
              <CardDescription className="text-stone-500">
                {t.settings.languageDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={language}
            onValueChange={handleLanguageChange}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors cursor-pointer">
              <RadioGroupItem value="es" id="es" />
              <Label htmlFor="es" className="flex-1 cursor-pointer">
                <span className="font-medium text-stone-900">{t.settings.spanish}</span>
                <p className="text-sm text-stone-500">{t.settings.spanishDescription}</p>
              </Label>
              <span className="text-2xl">🇪🇸</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors cursor-pointer">
              <RadioGroupItem value="en" id="en" />
              <Label htmlFor="en" className="flex-1 cursor-pointer">
                <span className="font-medium text-stone-900">{t.settings.english}</span>
                <p className="text-sm text-stone-500">{t.settings.englishDescription}</p>
              </Label>
              <span className="text-2xl">🇬🇧</span>
            </div>
          </RadioGroup>
          
          {/* Save indicator */}
          <div className="mt-4 h-6 flex items-center">
            {isSaving && (
              <span className="text-sm text-stone-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.settings.saving}
              </span>
            )}
            {saved && (
              <span className="text-sm text-green-600">
                ✓ {t.settings.saved}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notifications Setting (Placeholder) */}
      <Card className="bg-white border-stone-100 rounded-2xl shadow-sm mb-6 opacity-60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-medium text-stone-900">
                {t.settings.notifications}
              </CardTitle>
              <CardDescription className="text-stone-500">
                {t.settings.comingSoon}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Privacy Setting (Placeholder) */}
      <Card className="bg-white border-stone-100 rounded-2xl shadow-sm mb-6 opacity-60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-medium text-stone-900">
                {t.settings.privacy}
              </CardTitle>
              <CardDescription className="text-stone-500">
                {t.settings.comingSoon}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sign Out */}
      <Card className="bg-white border-stone-100 rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="w-5 h-5 mr-2" />
            {t.nav.signOut}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
