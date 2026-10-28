"use client";

import Link from "next/link";
import { Construction, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { User } from "@supabase/supabase-js";

interface ProDashboardClientProps {
  user: User;
}

export function ProDashboardClient({ user }: ProDashboardClientProps) {
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Pro";

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {/* Header */}
      <header className="border-b border-stone-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link 
            href="/"
            className="font-serif text-xl font-medium tracking-tight text-stone-900"
          >
            Leo.casa <span className="text-amber-600">Pro</span>
          </Link>
          <span className="text-sm text-stone-500">{user.email}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="font-serif text-2xl md:text-3xl font-medium text-stone-900 mb-2">
            Hola, {userName} 👋
          </h1>
          <p className="text-stone-600">
            Panel de gestión de clientes
          </p>
        </div>

        {/* Coming Soon Card */}
        <Card className="bg-white rounded-3xl shadow-sm border border-stone-100 mb-8">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Construction className="w-8 h-8 text-amber-600" />
            </div>
            
            <h2 className="font-serif text-xl font-medium text-stone-900 mb-3">
              Pro Dashboard - Próximamente
            </h2>
            
            <p className="text-stone-500 text-sm max-w-md mx-auto">
              El flujo completo para profesionales (Personal Shoppers y Agentes de Relocalización) 
              se implementará después de completar y aprobar el flujo de Renter.
            </p>
          </CardContent>
        </Card>

        {/* Preview Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-white rounded-2xl shadow-sm border border-stone-100 opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-stone-400">
                <Users className="w-5 h-5" />
                Mis Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-stone-400 text-sm">
                Gestiona perfiles de clientes, ve sus preferencias y shortlists.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl shadow-sm border border-stone-100 opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-stone-400">
                <Plus className="w-5 h-5" />
                Añadir Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-stone-400 text-sm">
                Crea nuevos clientes y elige cómo hacer el intake.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Link back to renter flow */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            asChild
            className="rounded-full border-stone-200"
          >
            <Link href="/dashboard">
              Ver flujo de Renter (en desarrollo)
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

