import { getCurrentUser } from "@/lib/auth-helpers";
import { getSupabaseServer } from "@/lib/supabase-server";
import { SpeakWithLeoContent } from "./SpeakWithLeoContent";

export default async function SpeakWithLeoPage() {
  const user = await getCurrentUser();
  
  // Fetch onboarding status and state
  let isOnboardingComplete = false;
  let intakeStep = 0;
  let whatifsCompleted = false;
  let followupCount = 0;
  let profileType: 'renter' | 'buyer' = 'renter';
  
  if (user) {
    const supabase = await getSupabaseServer();
    
    // Get active profile type
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("active_profile_type")
      .eq("id", user.id)
      .single();
    
    profileType = (userProfile?.active_profile_type as 'renter' | 'buyer') || 'renter';
    
    // Get lifestyle profile for active profile type
    const { data: profile } = await supabase
      .from("user_lifestyle_profiles")
      .select("intake_completed, intake_step, whatifs_completed, followup_count")
      .eq("user_id", user.id)
      .eq("profile_type", profileType)
      .single();
    
    if (profile) {
      isOnboardingComplete = profile.intake_completed ?? false;
      intakeStep = profile.intake_step ?? 0;
      whatifsCompleted = profile.whatifs_completed ?? false;
      followupCount = profile.followup_count ?? 0;
    }
  }
  
  return (
    <SpeakWithLeoContent
      userId={user?.id || null}
      profileType={profileType}
      isOnboardingComplete={isOnboardingComplete}
      intakeStep={intakeStep}
      whatifsCompleted={whatifsCompleted}
      followupCount={followupCount}
    />
  );
}
