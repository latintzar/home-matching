"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signOut } from "@/lib/supabase-browser";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <Card className="bg-white border-stone-100 rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Cerrar sesión
        </Button>
      </CardContent>
    </Card>
  );
}

