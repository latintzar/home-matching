export const dynamic='force-dynamic';
import { redirect } from "next/navigation";
import { getCurrentUser, isDevBypassActive } from "@/lib/auth-helpers";
import { getSupabaseServer } from "@/lib/supabase-server";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Language } from "@/lib/i18n/index";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the current user (with dev bypass support)
  const user = await getCurrentUser();

  // If not logged in, redirect to signin
  if (!user) {
    redirect("/auth/signin?redirectTo=/dashboard");
  }

  const client=await getSupabaseServer();
  const {data:accountProfile}=await client.from('user_profiles').select('active_profile_type').eq('id',user.id).single();
  const activeProfileType=(accountProfile?.active_profile_type==='buyer'?'buyer':'renter');
  const {data:profileRows}=await client.from('user_lifestyle_profiles').select('id,profile_type,intake_completed').eq('user_id',user.id);
  const allProfiles=(['renter','buyer'] as const).map(type=>{const row=profileRows?.find(record=>record.profile_type===type);return {type,exists:!!row,intakeCompleted:!!row?.intake_completed,profileId:row?.id};});

  // In dev bypass mode, skip onboarding check
  const devBypass = isDevBypassActive();
  
  // Check if user has completed onboarding and get language preference
  const supabase = await getSupabaseServer();
  const { data: profile } = await supabase
    .from("user_lifestyle_profiles")
    .select("intake_completed, language")
    .eq("user_id", user.id)
    .eq("profile_type",activeProfileType)
    .single();

  const isOnboardingComplete = devBypass || (profile?.intake_completed ?? false);
  const language = (profile?.language as Language) || 'es';
  
  // Note: We don't redirect to speak-with-leo here anymore.
  // The sidebar will disable nav items if onboarding isn't complete,
  // and individual pages can check onboarding status if needed.

  return (
    <AppLayout user={user} isOnboardingComplete={isOnboardingComplete} language={language} activeProfileType={activeProfileType} allProfiles={allProfiles}>
      {children}
    </AppLayout>
  );
}
