import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getSupabaseServer } from "@/lib/supabase-server";
import { SettingsContent } from "./SettingsContent";

export const metadata: Metadata = {
  title: "Configuración | Leo.casa",
  description: "Configura tu experiencia en Leo.casa",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServer();

  // Fetch user's profile for language preference
  const { data: profile } = await supabase
    .from("user_lifestyle_profiles")
    .select("language")
    .eq("user_id", user?.id)
    .single();

  const currentLanguage = (profile?.language as string) || "es";

  return (
    <SettingsContent 
      user={user} 
      currentLanguage={currentLanguage}
    />
  );
}
