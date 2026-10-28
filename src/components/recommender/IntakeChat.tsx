'use client';

/**
 * Intake Chat Component (ElevenLabs)
 * 
 * A chat interface using ElevenLabs Conversational AI.
 * Same agent as VoiceIntake, but text-based with optional audio responses.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';
import { ArrowRight, Volume2, VolumeX, Mic, Loader2 } from 'lucide-react';
import { LifeProfile } from '@/types/recommender';

// Same agent as VoiceIntake
const ELEVENLABS_AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '');

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface IntakeChatProps {
  profileId: string | null;
  onProfileComplete: (profile: Partial<LifeProfile>, profileId: string) => void;
  onSwitchToVoice?: () => void;
  className?: string;
}

const INITIAL_SUGGESTIONS = [
  '¡Hola! Estoy buscando piso',
  'Somos una familia con niños',
  'Trabajo desde casa y necesito luz',
  'Busco algo tranquilo cerca del centro',
];

export const IntakeChat: React.FC<IntakeChatProps> = ({
  profileId,
  onProfileComplete,
  onSwitchToVoice,
  className = '',
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false); // Text mode by default
  const [isConnected, setIsConnected] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract profile from conversation
  const extractProfile = useCallback(async (convId: string) => {
    if (!convId || isExtracting) return;
    
    setIsExtracting(true);
    console.log('[IntakeChat] Extracting profile from conversation:', convId);
    
    try {
      const response = await fetch('/api/recommender/extract-voice-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, profileId }),
      });
      
      const data = await response.json();
      
      if (data.success && data.isComplete) {
        console.log('[IntakeChat] Profile extracted:', data.profile);
        onProfileComplete(data.profile, profileId || '');
      }
    } catch (error) {
      console.error('[IntakeChat] Error extracting profile:', error);
    } finally {
      setIsExtracting(false);
    }
  }, [profileId, onProfileComplete, isExtracting]);

  const conversation = useConversation({
    onConnect: () => {
      console.log('[IntakeChat] Connected');
      setIsConnected(true);
      // Add initial greeting
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: '¡Hola! Soy Leo, tu asistente de búsqueda de vivienda. Cuéntame, ¿qué te ha llevado a buscar casa ahora?'
      }]);
    },
    onDisconnect: (details) => {
      console.log('[IntakeChat] Disconnected:', details);
      setIsConnected(false);
      // Extract profile when conversation ends
      if (conversationId) {
        extractProfile(conversationId);
      }
    },
    onMessage: (message) => {
      console.log('[IntakeChat] Message:', message);
      if (message.message) {
        const newMsg: Message = {
          id: crypto.randomUUID(),
          role: message.source === 'user' ? 'user' : 'assistant',
          content: message.message,
        };
        setMessages(prev => [...prev, newMsg]);
      }
    },
    onError: (error) => {
      console.error('[IntakeChat] Error:', error);
    },
  });

  // Auto-connect on mount
  useEffect(() => {
    const connect = async () => {
      try {
        const id = await conversation.startSession({
          agentId: ELEVENLABS_AGENT_ID,
          connectionType: 'websocket' as const,
        });
        setConversationId(id);
        console.log('[IntakeChat] Session started:', id);
        
        // Mute audio by default for chat mode
        if (!audioEnabled) {
          conversation.setVolume({ volume: 0 });
        }
      } catch (error) {
        console.error('[IntakeChat] Failed to connect:', error);
      }
    };
    
    connect();
    
    return () => {
      if (conversation.status === 'connected') {
        conversation.endSession();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hide suggestions after first user message
  useEffect(() => {
    if (messages.some(m => m.role === 'user')) {
      setShowSuggestions(false);
    }
  }, [messages]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    const newEnabled = !audioEnabled;
    setAudioEnabled(newEnabled);
    conversation.setVolume({ volume: newEnabled ? 1 : 0 });
  }, [audioEnabled, conversation]);

  // Send message
  const handleSend = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || conversation.status !== 'connected') return;

    setInput('');
    
    // Add user message optimistically
    const userMsg: Message = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      content 
    };
    setMessages(prev => [...prev, userMsg]);

    // Send to ElevenLabs
    try {
      // The sendUserMessage method is for text input
      // This sends the text to the agent who will respond
      conversation.sendUserMessage(content);
    } catch (error) {
      console.error('[IntakeChat] Failed to send message:', error);
    }

    // Focus back on input
    inputRef.current?.focus();
  }, [input, conversation]);

  // End conversation and extract
  const handleEndConversation = useCallback(async () => {
    if (conversationId) {
      await conversation.endSession();
      await extractProfile(conversationId);
    }
  }, [conversation, conversationId, extractProfile]);

  const isLoading = conversation.status === 'connecting' || conversation.isSpeaking;

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-emerald-500' : 'bg-gray-300'
          }`} />
          <span className="text-sm text-gray-600">
            {isConnected 
              ? (conversation.isSpeaking ? 'Leo está escribiendo...' : 'Conectado')
              : 'Conectando...'
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg transition-colors ${
              audioEnabled 
                ? 'bg-emerald-100 text-emerald-600' 
                : 'bg-gray-100 text-gray-400'
            }`}
            title={audioEnabled ? 'Silenciar respuestas' : 'Activar audio'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          
          {/* Switch to voice */}
          {onSwitchToVoice && (
            <button
              onClick={onSwitchToVoice}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
              title="Cambiar a voz"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isConnected && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-2" />
              <p className="text-gray-500">Conectando con Leo...</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {conversation.isSpeaking && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && isConnected && messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500 mb-2">Sugerencias para empezar:</p>
          <div className="flex flex-wrap gap-2">
            {INITIAL_SUGGESTIONS.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSend(suggestion)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        {/* Done button */}
        {messages.length >= 6 && (
          <button
            onClick={handleEndConversation}
            disabled={isExtracting}
            className="w-full mb-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50"
          >
            {isExtracting ? 'Analizando respuestas...' : '✓ Ya tengo todo, buscar viviendas'}
          </button>
        )}
        
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isConnected ? 'Escribe tu mensaje...' : 'Conectando...'}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={!isConnected || isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || !isConnected || isLoading}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              input.trim() && isConnected
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default IntakeChat;
