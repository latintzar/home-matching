import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { BillingContent } from "./BillingContent";

export default async function BillingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <BillingContent userId={user.id} userEmail={user.email || ""} />;
}

