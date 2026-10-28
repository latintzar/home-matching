'use client';
import {appFetch as fetch} from '@/lib/app-path';

/**
 * Voice Intake Component
 * 
 * Embedded ElevenLabs conversational AI for voice-first intake.
 * Uses the @elevenlabs/react SDK for full custom UI control.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, MessageSquare, Loader2 } from 'lucide-react';

// ElevenLabs Agent ID for Leo Intake
const ELEVENLABS_AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '');

interface VoiceIntakeProps {
  profileId: string | null;
  onSwitchToChat: () => void;
  onProfileExtracted?: (profile: any, isComplete: boolean) => void;
  className?: string;
}

export const VoiceIntake: React.FC<VoiceIntakeProps> = ({
  profileId,
  onSwitchToChat,
  onProfileExtracted,
  className = '',
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: 'user' | 'agent'; text: string }>>([]);
  const [isEnding, setIsEnding] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Extract profile from conversation when it ends
  const extractProfile = useCallback(async (convId: string) => {
    if (!convId || isExtracting) return;
    
    setIsExtracting(true);
    console.log('[VoiceIntake] Extracting profile from conversation:', convId);
    
    try {
      const response = await fetch('/api/recommender/extract-voice-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, profileId }),
      });
      
      const data = await response.json();
      
      if (data.success && onProfileExtracted) {
        console.log('[VoiceIntake] Profile extracted:', data.profile);
        onProfileExtracted(data.profile, data.isComplete);
      } else {
        console.error('[VoiceIntake] Failed to extract profile:', data.error);
      }
    } catch (error) {
      console.error('[VoiceIntake] Error extracting profile:', error);
    } finally {
      setIsExtracting(false);
    }
  }, [profileId, onProfileExtracted, isExtracting]);

  const conversation = useConversation({
    onConnect: () => {
      console.log('[VoiceIntake] Connected');
    },
    onDisconnect: (details) => {
      console.log('[VoiceIntake] Disconnected:', details);
      // Extract profile when conversation ends
      if (conversationId) {
        extractProfile(conversationId);
      }
    },
    onMessage: (message) => {
      console.log('[VoiceIntake] Message:', message);
      // Add to transcript
      if (message.message) {
        setTranscript(prev => [
          ...prev,
          { role: message.source === 'user' ? 'user' : 'agent', text: message.message }
        ]);
      }
    },
    onError: (error) => {
      console.error('[VoiceIntake] Error:', error);
    },
  });

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  // Start conversation
  const handleStart = useCallback(async () => {
    try {
      const id = await conversation.startSession({
        agentId: ELEVENLABS_AGENT_ID,
        connectionType: 'websocket' as const,
      });
      setConversationId(id);
      console.log('[VoiceIntake] Session started:', id);
    } catch (error) {
      console.error('[VoiceIntake] Failed to start session:', error);
    }
  }, [conversation]);

  // End conversation
  const handleEnd = useCallback(async () => {
    setIsEnding(true);
    try {
      await conversation.endSession();
      setConversationId(null);
    } catch (error) {
      console.error('[VoiceIntake] Failed to end session:', error);
    } finally {
      setIsEnding(false);
    }
  }, [conversation]);

  // Status indicator
  const getStatusText = () => {
    if (isExtracting) return 'Analizando conversación...';
    switch (conversation.status) {
      case 'connected':
        return conversation.isSpeaking ? 'Leo está hablando...' : 'Escuchando...';
      case 'connecting':
        return 'Conectando...';
      case 'disconnecting':
        return 'Finalizando...';
      default:
        return 'Listo para empezar';
    }
  };

  const isActive = conversation.status === 'connected' || conversation.status === 'connecting';

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-emerald-700/30">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            isActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
          }`} />
          <span className="text-emerald-100 font-medium">{getStatusText()}</span>
        </div>
        <button
          onClick={onSwitchToChat}
          className="text-emerald-300 hover:text-white transition-colors flex items-center gap-2 text-sm"
        >
          <MessageSquare className="w-4 h-4" />
          Cambiar a texto
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Voice visualization ring */}
        <div className="relative mb-8">
          {/* Outer ring - pulses when speaking */}
          <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
            conversation.isSpeaking 
              ? 'bg-emerald-400/20 scale-125 animate-pulse' 
              : isActive 
                ? 'bg-emerald-500/10 scale-110' 
                : 'bg-transparent scale-100'
          }`} style={{ width: 200, height: 200, marginLeft: -20, marginTop: -20 }} />
          
          {/* Middle ring */}
          <div className={`absolute inset-0 rounded-full transition-all duration-200 ${
            isActive && !conversation.isSpeaking
              ? 'bg-blue-400/20 scale-110 animate-pulse'
              : 'bg-transparent scale-100'
          }`} style={{ width: 180, height: 180, marginLeft: -10, marginTop: -10 }} />

          {/* Main button */}
          <button
            onClick={isActive ? handleEnd : handleStart}
            disabled={conversation.status === 'connecting' || isEnding}
            className={`w-40 h-40 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
              isActive
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {conversation.status === 'connecting' || isEnding ? (
              <Loader2 className="w-16 h-16 animate-spin" />
            ) : isActive ? (
              <PhoneOff className="w-16 h-16" />
            ) : (
              <Phone className="w-16 h-16" />
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-2">
            {isActive ? 'Hablando con Leo' : 'Habla con Leo'}
          </h2>
          <p className="text-emerald-200/80">
            {isActive 
              ? 'Cuéntale sobre tu vida y lo que buscas en una casa. Di "Ya tengo todo" cuando quieras terminar.'
              : 'Pulsa el botón para empezar una conversación de voz con Leo, tu asistente de búsqueda de vivienda.'}
          </p>
        </div>

        {/* Transcript (collapsed by default, expands with content) */}
        {transcript.length > 0 && (
          <div 
            ref={transcriptRef}
            className="absolute bottom-4 left-4 right-4 max-h-40 overflow-y-auto bg-black/30 backdrop-blur-sm rounded-xl p-4 space-y-2"
          >
            {transcript.slice(-5).map((item, i) => (
              <div 
                key={i} 
                className={`text-sm ${
                  item.role === 'user' ? 'text-blue-300' : 'text-emerald-300'
                }`}
              >
                <span className="font-medium">
                  {item.role === 'user' ? 'Tú: ' : 'Leo: '}
                </span>
                {item.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      {isActive && (
        <div className="flex items-center justify-center gap-4 p-4 border-t border-emerald-700/30">
          <button
            onClick={() => conversation.setVolume({ volume: conversation.micMuted ? 1 : 0 })}
            className={`p-3 rounded-full transition-colors ${
              conversation.micMuted 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }`}
            title={conversation.micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
          >
            {conversation.micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          <button
            onClick={handleEnd}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-colors flex items-center gap-2"
          >
            <PhoneOff className="w-5 h-5" />
            Finalizar llamada
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceIntake;

