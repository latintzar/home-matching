import React, { useRef, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Square, ArrowRight, ChevronDown } from "lucide-react";
import { useUnifiedChat } from '@/hooks/useUnifiedChat';
import { ChatMessageComponent } from '@/components/chat/ChatMessage';
import { UnifiedChatContext } from '@/types/chat';

interface UnifiedChatProps extends UnifiedChatContext {
  className?: string;
  initialSuggestions?: string[];
  onOpenAnalysisModal?: (sectionId?: string) => void;
  onCopyAll?: () => void;
  onClearChat?: () => void;
  apiEndpoint?: string; // Add optional endpoint
}

export const UnifiedChat: React.FC<UnifiedChatProps> = ({
  className,
  listingId,
  initialSuggestions = [],
  onOpenAnalysisModal,
  tierInfo,
  afterPhotos,
  agentWhatsapp,
  onCopyAll,
  onClearChat,
  apiEndpoint = '/api/ai/chat' // Default endpoint
}) => {
  const {
    input,
    setInput,
    messages,
    loading,
    suggestions,
    handleAsk,
    handleStop,
    handleClear,
    updateMessage
  } = useUnifiedChat({ 
    listingId, 
    initialSuggestions,
    apiEndpoint // Pass endpoint to hook
  });

  const listRef = useRef<HTMLDivElement>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lastAssistantMessageIdRef = useRef<string | null>(null);

  // External handlers
  useEffect(() => {
    if (onClearChat) {
      // We can't easily hook into the parent's clear function from here if passed as prop
      // But we can expose handleClear via ref or context if needed.
      // For now, we assume the parent handles clearing via key reset or similar, 
      // OR we listen to window events like AISidebar did.
    }
    
    const handleWindowCopy = () => {
      const allText = messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
      navigator.clipboard.writeText(allText);
      if (onCopyAll) onCopyAll();
    };
    
    const handleWindowClear = () => handleClear();

    window.addEventListener('copy-ai-chat', handleWindowCopy);
    window.addEventListener('clear-ai-chat', handleWindowClear);
    
    return () => {
      window.removeEventListener('copy-ai-chat', handleWindowCopy);
      window.removeEventListener('clear-ai-chat', handleWindowClear);
    };
  }, [messages, handleClear, onCopyAll]);

  // Auto-scroll logic
  useEffect(() => {
    if (!loading || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    if (lastMessage.id !== lastAssistantMessageIdRef.current) {
      lastAssistantMessageIdRef.current = lastMessage.id;
      requestAnimationFrame(() => {
        const container = listRef.current;
        if (!container) return;
        const el = container.querySelector(`[data-message-id="${lastMessage.id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
          container.scrollTop -= 20; // Small offset
        }
      });
    }
  }, [loading, messages]);

  // Suggestions collapse
  useEffect(() => {
    if (messages.length > 0 && suggestionsOpen) {
      setSuggestionsOpen(false);
    }
  }, [messages.length]);

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Messages List */}
      <div ref={listRef} className="flex-1 flex flex-col gap-4 overflow-y-auto p-4 text-sm relative scroll-smooth">
        {messages.length === 0 && !loading && (
          <div className="text-center text-muted-foreground py-8">
            Ask me anything about this property
          </div>
        )}
        
        {messages.map((m, i) => (
          <ChatMessageComponent
            key={m.id}
            message={m}
            loading={loading}
            isLastMessage={i === messages.length - 1}
            onCopy={(id, content) => navigator.clipboard.writeText(content)}
            onEdit={(id, content) => updateMessage(id, content)} // Simple edit for now
            onSaveEdit={(id, content) => {
                // Complex edit/resend logic would go here or in hook
                // For now, just update content locally
                updateMessage(id, content);
            }}
            onOpenAnalysisModal={onOpenAnalysisModal}
            tierInfo={tierInfo}
            afterPhotos={afterPhotos}
            agentWhatsapp={agentWhatsapp}
          />
        ))}
        
        {/* Padding for thinking/scrolling */}
        {loading && <div className="h-[20vh]" />} 
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex-none border-t border-border/50">
          <button
            onClick={() => setSuggestionsOpen(!suggestionsOpen)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${suggestionsOpen ? 'rotate-180' : ''}`} />
            <span>Suggestions</span>
          </button>
          {suggestionsOpen && (
            <div className="px-4 pb-2 max-h-[150px] overflow-y-auto">
              <div className="space-y-1">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full text-left text-sm py-1.5 px-2 hover:bg-muted/50 rounded-md transition-colors group block"
                    onClick={() => handleAsk(s)}
                  >
                    <div className="flex items-start gap-2 w-full">
                      <span className="flex-1 min-w-0 break-words text-foreground">{s}</span>
                      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input Area */}
      <form 
        className="p-3 flex-none bg-background border-t border-border"
        onSubmit={(e) => { e.preventDefault(); handleAsk(); }}
      >
        <div className="relative rounded-lg border border-input bg-muted overflow-hidden focus-within:ring-1 focus-within:ring-ring">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground px-4 pt-3 pb-10 resize-none focus:outline-none text-sm min-h-[44px] max-h-[150px]"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
          
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground pointer-events-none">
              {input.length}/1000
            </span>
            <button
              type={loading ? "button" : "submit"}
              onClick={loading ? handleStop : undefined}
              disabled={!loading && !input.trim()}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                loading
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : input.trim()
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted-foreground/20 text-muted-foreground cursor-not-allowed'
              }`}
            >
              {loading ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
