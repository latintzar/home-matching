"use client";

import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

interface ClientProfileClientProps {
  clientId: string;
  user: User;
}

export function ClientProfileClient({ clientId, user }: ClientProfileClientProps) {
  return (
    <div className="min-h-screen bg-[#FDFBF7] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Button
          variant="ghost"
          asChild
          className="mb-6 -ml-2"
        >
          <Link href="/pro">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al dashboard
          </Link>
        </Button>

        {/* Coming Soon Card */}
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-stone-100">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Construction className="w-8 h-8 text-amber-600" />
          </div>
          
          <h1 className="font-serif text-2xl font-medium text-stone-900 mb-3">
            Pro Flow - Próximamente
          </h1>
          
          <p className="text-stone-600 mb-2">
            Cliente ID: <code className="bg-stone-100 px-2 py-1 rounded">{clientId}</code>
          </p>
          
          <p className="text-stone-500 text-sm">
            Esta funcionalidad se implementará después de completar el flujo de Renter.
          </p>
        </div>
      </div>
    </div>
  );
}

