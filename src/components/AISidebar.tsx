import React, { useEffect } from "react";
import { UnifiedChat } from "@/components/chat/UnifiedChat";

interface AISidebarProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listingId?: string | null;
  initialSuggestions?: string[];
  onCopyAll?: () => void;
  onClearChat?: () => void;
  onOpenAnalysisModal?: (sectionId?: string) => void;
  afterPhotos?: { [tier: string]: string[] };
  tierInfo?: {
    livable?: { name: string; priceRange: string };
    comfortable?: { name: string; priceRange: string };
    competitive?: { name: string; priceRange: string };
  };
  agentWhatsapp?: string | null;
}

export const AISidebar: React.FC<AISidebarProps> = ({
  open,
  onOpenChange,
  listingId,
  initialSuggestions = [],
  onCopyAll,
  onClearChat,
  onOpenAnalysisModal,
  afterPhotos = {},
  tierInfo,
  agentWhatsapp,
}) => {
  // Handle ESC key to close sidebar
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <aside
      className={`fixed top-16 right-0 z-50 h-[calc(100vh-64px)] w-[90vw] sm:w-[360px] max-w-[90vw] border-l bg-background transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'} flex flex-col shadow-xl`}
      aria-label="Ask AI sidebar"
      role="complementary"
    >
      <UnifiedChat
        listingId={listingId}
        initialSuggestions={initialSuggestions}
        onCopyAll={onCopyAll}
        onClearChat={onClearChat}
        onOpenAnalysisModal={onOpenAnalysisModal}
        afterPhotos={afterPhotos}
        tierInfo={tierInfo}
        agentWhatsapp={agentWhatsapp}
        className="h-full"
      />
    </aside>
  );
};

export default AISidebar;
