import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase-server";
import { ShortlistPageClient } from "./ShortlistPageClient";

export const dynamic = "force-dynamic";

export default async function ShortlistPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/auth/signin?redirectTo=/shortlist");
  }

  return <ShortlistPageClient userId={user.id} />;
}

