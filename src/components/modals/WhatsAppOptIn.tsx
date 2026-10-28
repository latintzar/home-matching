"use client";

import { useState } from "react";
import { MessageCircle, Phone, X, Check, ArrowRight, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { NonProEvents } from "@/lib/analytics";

interface WhatsAppOptInProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (opted: boolean, phone?: string) => void;
  userId?: string;
}

export function WhatsAppOptIn({
  isOpen,
  onClose,
  onComplete,
  userId,
}: WhatsAppOptInProps) {
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"ask" | "phone" | "success">("ask");
  const [error, setError] = useState<string | null>(null);

  const handleOptIn = () => {
    setStep("phone");
  };

  const handleSkip = () => {
    NonProEvents.whatsappSkipped();
    onComplete(false);
    onClose();
  };

  const handleSubmitPhone = async () => {
    // Validate phone
    const cleanPhone = phone.replace(/\s/g, "");
    if (!cleanPhone.match(/^\+?\d{9,15}$/)) {
      setError("Introduce un número de teléfono válido");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (userId) {
        const supabase = getSupabaseBrowser();
        
        // Update user profile with phone
        await supabase
          .from("user_lifestyle_profiles")
          .update({
            whatsapp_phone: cleanPhone,
            whatsapp_opted_in: true,
            whatsapp_opted_in_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }

      NonProEvents.whatsappOptedIn();
      setStep("success");
      
      // Auto-close after success
      setTimeout(() => {
        onComplete(true, cleanPhone);
        onClose();
      }, 2000);
    } catch (e) {
      console.error("Error saving phone:", e);
      setError("Error al guardar. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === "ask") {
      handleSkip();
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        {step === "ask" && (
          <>
            <DialogHeader>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
              <DialogTitle className="text-center font-serif text-2xl">
                ¿Recibir alertas por WhatsApp?
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <p className="text-center text-stone-600">
                Leo te avisará al instante cuando encuentre pisos que encajan 
                con lo que buscas.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Notificaciones instantáneas de nuevos pisos</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Responde directamente a Leo por chat</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Cancela cuando quieras</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleOptIn}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Sí, quiero alertas por WhatsApp
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-stone-500"
              >
                Ahora no, solo email
              </Button>
            </div>
          </>
        )}

        {step === "phone" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center font-serif text-2xl">
                Tu número de WhatsApp
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <p className="text-center text-stone-600 text-sm">
                Introduce tu número para recibir alertas
              </p>
              
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <Input
                  type="tel"
                  placeholder="+34 612 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-14 pl-12 pr-4 rounded-xl border-stone-200 text-base"
                  autoFocus
                />
              </div>
              
              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
              
              <p className="text-xs text-stone-500 text-center">
                Solo usaremos tu número para enviarte alertas de Leo.
                Puedes cancelar en cualquier momento.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("ask")}
                className="flex-1 h-12 rounded-xl"
                disabled={isSubmitting}
              >
                Atrás
              </Button>
              <Button
                onClick={handleSubmitPhone}
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
                disabled={isSubmitting || !phone}
              >
                {isSubmitting ? (
                  "Guardando..."
                ) : (
                  <>
                    Confirmar
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-serif text-2xl text-stone-900 mb-2">
              ¡Listo!
            </h3>
            <p className="text-stone-600">
              Te avisaremos por WhatsApp cuando Leo encuentre algo para ti.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Standalone opt-in banner (for profile page)
export function WhatsAppOptInBanner({
  onOptIn,
  className,
}: {
  onOptIn: () => void;
  className?: string;
}) {
  return (
    <div className={cn(
      "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-6",
      className
    )}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Bell className="w-6 h-6 text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-stone-900 mb-1">
            Activa alertas por WhatsApp
          </h3>
          <p className="text-sm text-stone-600 mb-4">
            Recibe notificaciones instantáneas cuando Leo encuentre pisos que encajan contigo.
          </p>
          <Button
            onClick={onOptIn}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Activar WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}

