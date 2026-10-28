export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  editing?: boolean;
  timestamp?: Date;
  detectedTiers?: Array<'livable' | 'comfortable' | 'competitive'>;
  needsAgent?: boolean;
  thinking?: string;
  thinkingDurationSeconds?: number;
  cta?: {
    type: 'whatsapp' | 'analysis' | 'viewing-checklist' | 'renovation-ideas' | 'tier';
    tier?: 'livable' | 'comfortable' | 'competitive';
    whatsappMessage?: string;
  };
};

export interface UnifiedChatContext {
  listingId?: string | null;
  agentWhatsapp?: string | null;
  tierInfo?: {
    livable?: { name: string; priceRange: string };
    comfortable?: { name: string; priceRange: string };
    competitive?: { name: string; priceRange: string };
  };
  afterPhotos?: { [tier: string]: string[] };
}

