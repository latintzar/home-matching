"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DevModeBanner } from "@/components/dev/DevModeBanner";
import { track } from "@/lib/analytics";

export default function AddClientPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [selectedMethod, setSelectedMethod] = useState<"pro_call" | "client_link" | null>(null);

  const handleSubmit = async () => {
    if (!formData.name || !selectedMethod) return;
    
    setIsSubmitting(true);
    track("client_created", {
      properties: {
        intake_method: selectedMethod,
        has_email: !!formData.email,
        has_phone: !!formData.phone,
      },
    });

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock client ID
    const clientId = `client-${Date.now()}`;
      
    if (selectedMethod === "pro_call") {
      router.push(`/pro/clients/${clientId}/intake`);
      } else {
      // Would send link and redirect to client profile
      track("intake_link_sent", { properties: { client_id: clientId } });
      router.push(`/pro/clients/${clientId}`);
    }
  };

    return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <DevModeBanner />
      
        {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link href="/pro/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-white text-center mb-8">
          + Añadir Nuevo Cliente
        </h1>

        {/* Client Info Form */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-slate-300">
                Nombre del cliente <span className="text-red-400">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Ej: Juan Pérez"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1.5 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
            
            <div>
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="operator@example.invalid"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1.5 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
            
            <div>
              <Label htmlFor="phone" className="text-slate-300">
                Teléfono (WhatsApp)
              </Label>
              <div className="flex mt-1.5">
                <div className="flex items-center px-3 bg-slate-800 border border-r-0 border-slate-700 rounded-l-lg text-slate-400">
                  🇪🇸 +34
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="600 000 000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="rounded-l-none bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Intake Method Selection */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            ¿Cómo quieres hacer la entrevista?
          </h2>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelectedMethod("pro_call")}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedMethod === "pro_call"
                  ? "bg-amber-500/10 border-amber-500/50"
                  : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedMethod === "pro_call" ? "bg-amber-500/20" : "bg-slate-800"
                }`}>
                  <Mic className={`w-5 h-5 ${
                    selectedMethod === "pro_call" ? "text-amber-400" : "text-slate-400"
                  }`} />
              </div>
                <div>
                  <h3 className={`font-semibold ${
                    selectedMethod === "pro_call" ? "text-amber-400" : "text-white"
                  }`}>
                    Yo hago la llamada
              </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Habla tú con Leo sobre tu cliente.<br />
                    Perfecto si ya conoces bien sus necesidades.
              </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod("client_link")}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedMethod === "client_link"
                  ? "bg-blue-500/10 border-blue-500/50"
                  : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedMethod === "client_link" ? "bg-blue-500/20" : "bg-slate-800"
                }`}>
                  <Send className={`w-5 h-5 ${
                    selectedMethod === "client_link" ? "text-blue-400" : "text-slate-400"
                  }`} />
              </div>
                <div>
                  <h3 className={`font-semibold ${
                    selectedMethod === "client_link" ? "text-blue-400" : "text-white"
                  }`}>
                    Enviar link al cliente
              </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Tu cliente habla directamente con Leo.<br />
                    Recibirás un resumen cuando termine.
              </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!formData.name || !selectedMethod || isSubmitting}
          className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
                >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creando cliente...
            </>
          ) : selectedMethod === "pro_call" ? (
            "Crear cliente y empezar entrevista"
          ) : selectedMethod === "client_link" ? (
            "Crear cliente y enviar link"
          ) : (
            "Selecciona un método"
          )}
        </Button>
      </main>
      </div>
    );
  }
