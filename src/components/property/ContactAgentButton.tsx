"use client";

import { useState } from "react";
import { Phone, MessageCircle, Copy, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { NonProEvents } from "@/lib/analytics";

interface ContactAgentButtonProps {
  listingId: string;
  agentPhone?: string;
  agentWhatsApp?: string;
  userOneLiner?: string; // Pre-filled message about user preferences
  className?: string;
}

export function ContactAgentButton({
  listingId,
  agentPhone,
  agentWhatsApp,
  userOneLiner,
  className,
}: ContactAgentButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExpand = async () => {
    if (!isExpanded) {
      // Track analytics
      NonProEvents.contactAgentClicked(listingId);
      
      // Create viewing record
      try {
        const supabase = getSupabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          await supabase.from("viewings").insert({
            user_id: user.id,
            listing_id: listingId,
            status: "contacted",
            agent_phone: agentPhone,
            agent_whatsapp_url: agentWhatsApp,
          });
        }
      } catch (e) {
        console.error("Error creating viewing:", e);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const handleCopyPhone = async () => {
    if (agentPhone) {
      await navigator.clipboard.writeText(agentPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    if (agentWhatsApp) {
      // Format WhatsApp URL with pre-filled message
      const message = userOneLiner 
        ? `Hola, me interesa el piso. ${userOneLiner}`
        : "Hola, me interesa este piso que vi en Leo.casa";
      
      const url = agentWhatsApp.includes("wa.me") 
        ? `${agentWhatsApp}?text=${encodeURIComponent(message)}`
        : `https://wa.me/${agentWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
      
      window.open(url, "_blank");
    }
  };

  const handleCall = () => {
    if (agentPhone) {
      window.location.href = `tel:${agentPhone}`;
    }
  };

  // Collapsed state - "Quiero verlo" button
  if (!isExpanded) {
    return (
      <Button
        onClick={handleExpand}
        className={cn(
          "w-full h-14 bg-stone-900 text-white hover:bg-stone-800 rounded-2xl text-base font-medium",
          className
        )}
      >
        Quiero verlo
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    );
  }

  // Expanded state - Contact options
  return (
    <div className={cn("space-y-3 animate-in fade-in duration-200", className)}>
      <p className="text-sm text-stone-600 text-center">
        Contacta directamente con el agente
      </p>
      
      {/* WhatsApp button (primary) */}
      {agentWhatsApp && (
        <Button
          onClick={handleWhatsApp}
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          WhatsApp
        </Button>
      )}
      
      {/* Phone options */}
      {agentPhone && (
        <div className="flex gap-2">
          <Button
            onClick={handleCall}
            variant="outline"
            className="flex-1 h-12 rounded-xl border-stone-200"
          >
            <Phone className="w-5 h-5 mr-2" />
            Llamar
          </Button>
          <Button
            onClick={handleCopyPhone}
            variant="outline"
            className="h-12 px-4 rounded-xl border-stone-200"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </Button>
        </div>
      )}
      
      {/* Collapse button */}
      <button
        onClick={() => setIsExpanded(false)}
        className="w-full text-sm text-stone-500 hover:text-stone-700"
      >
        Ocultar
      </button>
    </div>
  );
}

// Simple "Add to shortlist" variant
export function AddToShortlistButton({
  listingId,
  isInShortlist,
  onToggle,
  className,
}: {
  listingId: string;
  isInShortlist: boolean;
  onToggle: (id: string) => void;
  className?: string;
}) {
  return (
    <Button
      onClick={() => onToggle(listingId)}
      variant={isInShortlist ? "secondary" : "outline"}
      className={cn(
        "rounded-xl",
        isInShortlist && "bg-rose-100 text-rose-700 hover:bg-rose-200",
        className
      )}
    >
      {isInShortlist ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          En shortlist
        </>
      ) : (
        <>
          Guardar
        </>
      )}
    </Button>
  );
}

