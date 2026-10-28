'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, VibeArea } from './types';
import { getPriceTierDisplay } from '@/lib/vibe-maps/bookingUrls';

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  onSendMessage: (message: string) => void;
  onAreaClick?: (area: VibeArea) => void;
}

export default function ChatPanel({
  messages,
  loading,
  onSendMessage,
  onAreaClick,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Copy raw response to clipboard
  const handleCopyRaw = useCallback(async (message: ChatMessage) => {
    if (!message.rawResponse) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(message.rawResponse, null, 2));
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center">
          <span className="text-sm font-bold text-white">L</span>
        </div>
        <span className="text-white font-medium">Leo</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-600 mt-8">
            <p className="text-lg mb-2">👋 Welcome!</p>
            <p className="text-sm">Tell me about your trip and I&apos;ll find the perfect neighborhoods.</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white'
                  : 'bg-[#1A1A1A] text-gray-200 border border-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

              {/* Area list if assistant returned areas */}
              {message.role === 'assistant' && message.areas && message.areas.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                  {message.areas.map((area, i) => (
                    <button
                      key={i}
                      onClick={() => onAreaClick?.(area)}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: area.color }}
                      />
                      <span className="text-sm font-medium text-white flex-1">
                        {area.areaType === 'stay' ? '🏨 ' : ''}{area.name}
                      </span>
                      {/* Price tier badge for stay areas */}
                      {area.priceTier && (
                        <span 
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ 
                            backgroundColor: `${area.color}20`,
                            color: area.color 
                          }}
                        >
                          {getPriceTierDisplay(area.priceTier)}
                        </span>
                      )}
                      {area.grounded && !area.priceTier && (
                        <span className="text-[10px] text-emerald-400">✓ verified</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Copy Raw Response button - for all assistant messages with raw data */}
              {message.role === 'assistant' && message.rawResponse && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <button
                    onClick={() => handleCopyRaw(message)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      copiedId === message.id
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#252525] text-gray-400 hover:text-gray-200 hover:bg-[#303030] border border-gray-700'
                    }`}
                  >
                    {copiedId === message.id ? (
                      <>
                        <span>✓</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <span>📋</span>
                        <span>Copy Raw Response</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#FF6B6B] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#FF8E53] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#FFB347] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="w-full px-4 py-3 pr-12 bg-[#1A1A1A] border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:border-[#FF6B6B] focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 resize-none text-sm"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            className="absolute right-2 bottom-2 w-8 h-8 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] rounded-lg flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            aria-label="Send message"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-white text-sm">↑</span>
            )}
          </button>
        </div>
        <p className="text-center text-gray-700 text-xs mt-2">
          Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-500">Enter</kbd> to send
        </p>
      </div>
    </div>
  );
}

