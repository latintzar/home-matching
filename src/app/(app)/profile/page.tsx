import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ProfileContent } from "./ProfileContent";

export const metadata: Metadata = {
  title: "Mi Perfil | Leo.casa",
  description: "Tu perfil de búsqueda de vivienda",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServer();

  // Fetch user's lifestyle profile
  let profile = null;
  try {
    const { data } = await supabase
      .from("user_lifestyle_profiles")
      .select("*")
      .eq("user_id", user?.id)
      .single();
    profile = data;
  } catch (e) {
    console.log("No lifestyle profile found");
  }

  // Fetch user's stats - use try-catch for tables that might not exist
  let savedCount = 0;
  let viewedCount = 0;
  let notesCount = 0;

  try {
    const { count } = await supabase
      .from("user_saved_properties")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user?.id);
    savedCount = count || 0;
  } catch (e) {
    console.log("saved_properties table might not exist");
  }

  try {
    const { count } = await supabase
      .from("user_viewings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user?.id);
    viewedCount = count || 0;
  } catch (e) {
    console.log("user_viewings table might not exist");
  }

  try {
    const { count } = await supabase
      .from("user_notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user?.id);
    notesCount = count || 0;
  } catch (e) {
    console.log("user_notes table might not exist");
  }

  return (
    <ProfileContent
      user={user}
      profile={profile}
      stats={{
        saved: savedCount,
        viewed: viewedCount,
        notes: notesCount,
      }}
    />
  );
}
