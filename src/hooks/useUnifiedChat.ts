import { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { ChatMessage } from '@/types/chat';
import { 
  detectTierReferences, 
  detectAgentRecommendation, 
  filterPhaseReferences 
} from '@/lib/chat-utils';

interface UseUnifiedChatProps {
  listingId?: string | null;
  initialSuggestions?: string[];
  onSuggestionsUpdate?: (suggestions: string[]) => void;
  apiEndpoint?: string;
}

export function useUnifiedChat({
  listingId,
  initialSuggestions = [],
  onSuggestionsUpdate,
  apiEndpoint = '/api/ai/chat'
}: UseUnifiedChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(initialSuggestions);
  
  // Tracking state
  const [shownTiers, setShownTiers] = useState<Set<'livable' | 'comfortable' | 'competitive'>>(new Set());
  const [shownCTAs, setShownCTAs] = useState<Set<'analysis' | 'renovation'>>(new Set());
  const [hasShownAnyTier, setHasShownAnyTier] = useState(false);
  const [hasShownBlockquote, setHasShownBlockquote] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastMessageCountRef = useRef(0);

  // Suggestion fetching logic
  useEffect(() => {
    if (loading || !listingId) return;
    
    const currentMessageCount = messages.length;
    if (currentMessageCount === 0 || currentMessageCount <= lastMessageCountRef.current) return;
    
    const lastMessage = messages[currentMessageCount - 1];
    if (lastMessage?.role !== 'assistant') {
      lastMessageCountRef.current = currentMessageCount;
      return;
    }
    
    const isCompletePair = currentMessageCount % 2 === 0;
    if (!isCompletePair) {
      lastMessageCountRef.current = currentMessageCount;
      return;
    }
    
    lastMessageCountRef.current = currentMessageCount;
    const currentMessages = messages;
    
    const timeoutId = setTimeout(() => {
      const conversationMessages = currentMessages.map(m => ({ role: m.role, content: m.content }));
      
      fetch(`/api/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, messages: conversationMessages })
      })
        .then(r => r.ok ? r.json() : Promise.reject(r))
        .then(d => {
          const newSuggestions = Array.isArray(d.suggestions) ? d.suggestions : [];
          setSuggestions(newSuggestions);
          if (onSuggestionsUpdate) onSuggestionsUpdate(newSuggestions);
        })
        .catch(() => {
          setSuggestions([]);
          if (onSuggestionsUpdate) onSuggestionsUpdate([]);
        });
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [listingId, messages.length, loading, onSuggestionsUpdate]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    handleStop();
    setMessages([]);
    setShownTiers(new Set());
    setShownCTAs(new Set());
    setHasShownAnyTier(false);
    setHasShownBlockquote(false);
  }, [handleStop]);

  const handleAsk = useCallback(async (text?: string) => {
    // If already loading, stop current request first and remove incomplete assistant message
    if (loading && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      
      // Remove any incomplete assistant message
      setMessages(prev => {
        const filtered = prev.filter(m => {
          if (m.role === 'user') return true;
          if (m.role === 'assistant') {
            const hasContent = m.content && m.content.trim().length > 10;
            const hasThinking = m.thinking && typeof m.thinking === 'string' && m.thinking.trim().length > 0;
            return hasContent || hasThinking;
          }
          return true;
        });
        return filtered;
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const content = (text ?? input).trim();
    if (!content) return;
    
    setInput("");
    
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    const thinkingStartTime = Date.now();
    
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", timestamp: new Date() };
    setMessages(prev => [...prev, assistantMsg]);
    
    let accumulatedContent = '';
    let thinkingContent = '';
    let thinkingReceivedTime: number | null = null;
    
    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          shownTiers: Array.from(shownTiers),
          shownCTAs: Array.from(shownCTAs),
          hasShownAnyTier,
          hasShownBlockquote
        }),
        signal: abortController.signal
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');
      
      let buffer = '';
      
      while (true) {
        if (abortController.signal.aborted) {
          const stoppedText = '\n\nThinking stopped early by user.';
          const stoppedMessage = accumulatedContent.trim()
            ? `${accumulatedContent.trim()}${stoppedText}`
            : 'Thinking stopped early by user.';
          setMessages(prev => prev.map(m => 
            m.id === assistantId ? { ...m, content: stoppedMessage } : m
          ));
          break;
        }
        
        const { done, value } = await reader.read();
        
        if (done) {
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer.slice(6));
              if (data.thinking) {
                const thinkingStr = typeof data.thinking === 'string' ? data.thinking : String(data.thinking || '');
                if (thinkingStr && !thinkingContent) {
                  thinkingContent = filterPhaseReferences(thinkingStr);
                  if (thinkingReceivedTime === null) thinkingReceivedTime = Date.now();
                }
              }
              if (data.chunk) accumulatedContent += data.chunk;
            } catch (e) {}
          }
          
          let finalContent = accumulatedContent;
          const detectedTiers = detectTierReferences(finalContent);
          const needsAgent = detectAgentRecommendation(finalContent);
          
          const newTiers = hasShownAnyTier ? [] : (detectedTiers || []);
          
          if (newTiers.length > 0) {
            setHasShownAnyTier(true);
            setShownTiers(prev => {
              const updated = new Set(prev);
              newTiers.forEach(tier => updated.add(tier));
              return updated;
            });
          }
          
          const hasBlockquote = /^\s*>/m.test(finalContent);
          if (hasBlockquote && !hasShownBlockquote) setHasShownBlockquote(true);
          
          const hasAnalysisCTA = finalContent.includes('[Open Analysis]') || finalContent.includes('See Full Analysis') || finalContent.includes('See Report') || finalContent.includes('[See Full Analysis]');
          const hasRenovationCTA = finalContent.includes('See Renovation') || finalContent.includes('renovation ideas') || finalContent.includes('renovation menu');
          
          if (hasAnalysisCTA && !shownCTAs.has('analysis')) setShownCTAs(prev => new Set(prev).add('analysis'));
          if (hasRenovationCTA && !shownCTAs.has('renovation')) setShownCTAs(prev => new Set(prev).add('renovation'));
          
          let thinkingDurationSeconds = null;
          if (thinkingContent && thinkingReceivedTime === null && thinkingStartTime) {
            thinkingDurationSeconds = Math.round((Date.now() - thinkingStartTime) / 1000);
          } else if (thinkingReceivedTime && thinkingStartTime) {
            thinkingDurationSeconds = Math.round((thinkingReceivedTime - thinkingStartTime) / 1000);
          }
          
          setMessages(prev => prev.map(m => 
            m.id === assistantId 
              ? { ...m, content: filterPhaseReferences(finalContent), detectedTiers: newTiers.length > 0 ? newTiers : undefined, needsAgent, thinking: thinkingContent || m.thinking, thinkingDurationSeconds: thinkingDurationSeconds || m.thinkingDurationSeconds }
              : m
          ));
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const rawData = line.slice(6);
            const data = JSON.parse(rawData);
            
            if (data.thinking !== undefined) {
              let thinkingStr = '';
              if (typeof data.thinking === 'string') thinkingStr = data.thinking;
              else if (data.thinking === true) thinkingStr = '';
              else thinkingStr = String(data.thinking || '');
              
              if (thinkingStr) {
                thinkingContent = filterPhaseReferences(thinkingStr);
                if (thinkingReceivedTime === null) {
                  thinkingReceivedTime = Date.now();
                  const thinkingDurationSeconds = Math.round((thinkingReceivedTime - thinkingStartTime) / 1000);
                  flushSync(() => {
                    setMessages(prev => prev.map(m => 
                      m.id === assistantId ? { ...m, thinking: filterPhaseReferences(thinkingStr), thinkingDurationSeconds } : m
                    ));
                  });
                } else {
                  flushSync(() => {
                    setMessages(prev => prev.map(m => 
                      m.id === assistantId ? { ...m, thinking: filterPhaseReferences(thinkingStr) } : m
                    ));
                  });
                }
              }
            }
            
            if (data.chunk) {
              accumulatedContent += data.chunk;
              setMessages(prev => prev.map(m => 
                m.id === assistantId ? { ...m, content: accumulatedContent } : m
              ));
            } else if (data.error) {
              setMessages(prev => prev.map(m => 
                m.id === assistantId ? { ...m, content: `Error: ${data.error}` } : m
              ));
              break;
            } else if (data.cta) {
              setMessages(prev => prev.map(m => 
                m.id === assistantId ? { ...m, cta: data.cta } : m
              ));
            } else if (data.done) {
              let finalContent = accumulatedContent;
              const detectedTiers = detectTierReferences(finalContent);
              const needsAgent = detectAgentRecommendation(finalContent);
              
              const newTiers = hasShownAnyTier ? [] : (detectedTiers || []);
              
              if (newTiers.length > 0) {
                setHasShownAnyTier(true);
                setShownTiers(prev => {
                  const updated = new Set(prev);
                  newTiers.forEach(tier => updated.add(tier));
                  return updated;
                });
              }
              
              const hasBlockquote = /^\s*>/m.test(finalContent);
              if (hasBlockquote && !hasShownBlockquote) setHasShownBlockquote(true);
              
              const hasAnalysisCTA = finalContent.includes('[Open Analysis]') || finalContent.includes('See Full Analysis') || finalContent.includes('See Report') || finalContent.includes('[See Full Analysis]');
              const hasRenovationCTA = finalContent.includes('See Renovation') || finalContent.includes('renovation ideas') || finalContent.includes('renovation menu');
              
              if (hasAnalysisCTA && !shownCTAs.has('analysis')) setShownCTAs(prev => new Set(prev).add('analysis'));
              if (hasRenovationCTA && !shownCTAs.has('renovation')) setShownCTAs(prev => new Set(prev).add('renovation'));
              
              let thinkingDurationSeconds = null;
              if (thinkingContent && thinkingReceivedTime === null && thinkingStartTime) {
                thinkingDurationSeconds = Math.round((Date.now() - thinkingStartTime) / 1000);
              } else if (thinkingReceivedTime && thinkingStartTime) {
                thinkingDurationSeconds = Math.round((thinkingReceivedTime - thinkingStartTime) / 1000);
              }
              
              setMessages(prev => prev.map(m => 
                m.id === assistantId 
                  ? { ...m, content: filterPhaseReferences(finalContent), detectedTiers: newTiers.length > 0 ? newTiers : undefined, needsAgent, thinking: thinkingContent || m.thinking, thinkingDurationSeconds: thinkingDurationSeconds || m.thinkingDurationSeconds }
                  : m
              ));
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        const stoppedText = '\n\nThinking stopped early by user.';
        const stoppedMessage = accumulatedContent.trim()
          ? `${accumulatedContent.trim()}${stoppedText}`
          : 'Thinking stopped early by user.';
        setMessages(prev => prev.map(m => 
          m.id === assistantId ? { ...m, content: stoppedMessage } : m
        ));
      } else {
        setMessages(prev => prev.map(m => 
          m.id === assistantId ? { ...m, content: "Sorry — something went wrong." } : m
        ));
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [loading, input, messages, listingId, apiEndpoint, shownTiers, shownCTAs, hasShownAnyTier, hasShownBlockquote]);

  const updateMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, content: newContent } : m
    ));
  }, []);

  const deleteMessagesAfter = useCallback((messageId: string) => {
    setMessages(prev => {
      const index = prev.findIndex(m => m.id === messageId);
      if (index === -1) return prev;
      return prev.slice(0, index + 1);
    });
    
    // Reset tracking state since we're rewinding
    // Note: Ideally we would recalculate shownTiers based on remaining messages, 
    // but clearing is a safe default to allow re-showing them
    setShownTiers(new Set());
    setShownCTAs(new Set());
    setHasShownAnyTier(false);
    setHasShownBlockquote(false);
  }, []);

  return {
    input,
    setInput,
    messages,
    setMessages,
    loading,
    suggestions,
    setSuggestions,
    handleAsk,
    handleStop,
    handleClear,
    updateMessage,
    deleteMessagesAfter
  };
}

