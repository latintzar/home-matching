'use client';
import {appFetch as fetch} from '@/lib/app-path';

/**
 * Speak with Leo Content
 * 
 * Implements the onboarding state machine:
 * - State 0: NOTHING_DONE - User signed up but never talked to Leo
 * - State 1: CORE_STARTED - User started onboarding but didn't finish
 * - State 2: CORE_FINISHED - Core questions done, whatifs not started
 * - State 3: WHATIFS_FINISHED - Full onboarding complete
 * - State 4+: FOLLOWUPS_ADDED - User has had N follow-up conversations
 * 
 * Uses the same API endpoints as /recommend/intake for consistency.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';
import { Phone, PhoneOff, MessageSquare, Loader2, Send, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { AmorphousOrb } from '@/components/ui/AmorphousOrb';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

// ElevenLabs Agent IDs - Profile-specific agents
// Renter agents
const RENTER_INTAKE_AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || '');
const RENTER_WHATIFS_AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''); // TODO: Create leo-whatifs-renter
const RENTER_FOLLOWUP_AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''); // leo-followup (shared)

// Buyer agents
const BUYER_INTAKE_AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''); // TODO: Update with leo-intake-buyer ID
const BUYER_WHATIFS_AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''); // TODO: Create leo-whatifs-buyer
const BUYER_FOLLOWUP_AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''); // leo-followup (shared)

// Onboarding states
type OnboardingState = 'NOTHING_DONE' | 'CORE_STARTED' | 'CORE_FINISHED' | 'WHATIFS_FINISHED' | 'FOLLOWUPS_ADDED';

// UI text translations
const UI_TEXT = {
  es: {
    // Onboarding
    titleOnboarding: 'Conoce a Leo',
    subtitleOnboarding: 'Cuéntame sobre tu vida y lo que buscas. En 2-3 minutos sabré exactamente qué tipo de casa necesitas.',
    // Follow-up
    titleFollowup: 'Habla con Leo',
    subtitleFollowup: '¿Hay algo que quieras actualizar sobre tu búsqueda? Cuéntame cualquier cambio.',
    // Common
    preferChat: 'Prefiero escribir',
    chatWith: 'Chat con Leo',
    voice: 'Voz',
    write: 'Escribir',
    connecting: 'Conectando...',
    leoSpeaking: 'Leo está hablando',
    listening: 'Te escucho...',
    readyToTalk: 'Listo',
    tellMe: 'Cuéntame lo que buscas',
    pressToStart: 'Pulsa para empezar',
    startConversation: 'Hablar con Leo',
    finish: 'Finalizar llamada',
    analyzing: 'Guardando perfil...',
    typeHere: 'Escribe aquí...',
    profileUpdated: 'Perfil actualizado',
    leoKnows: 'Leo ha guardado los cambios.',
    goToProperties: 'Ver propiedades',
    suggestions: ['Estoy buscando piso para mí', 'Somos familia con niños', 'Busco algo tranquilo'],
    suggestionFollowup: ['Mi presupuesto ha cambiado', 'Busco otra zona', 'Necesito más habitaciones'],
  },
  en: {
    titleOnboarding: 'Meet Leo',
    subtitleOnboarding: 'Tell me about your life and what you\'re looking for. In 2-3 minutes I\'ll know exactly what kind of home you need.',
    titleFollowup: 'Speak with Leo',
    subtitleFollowup: 'Anything you want to update about your search? Tell me any changes.',
    preferChat: 'I prefer to type',
    chatWith: 'Chat with Leo',
    voice: 'Voice',
    write: 'Type',
    connecting: 'Connecting...',
    leoSpeaking: 'Leo is speaking',
    listening: 'I\'m listening...',
    readyToTalk: 'Ready',
    tellMe: 'Tell me what you\'re looking for',
    pressToStart: 'Press to start',
    startConversation: 'Speak with Leo',
    finish: 'End call',
    analyzing: 'Saving profile...',
    typeHere: 'Type here...',
    profileUpdated: 'Profile updated',
    leoKnows: 'Leo saved your changes.',
    goToProperties: 'See properties',
    suggestions: ['I\'m looking for an apartment', 'We\'re a family with kids', 'Looking for something quiet'],
    suggestionFollowup: ['My budget changed', 'Looking for another area', 'Need more bedrooms'],
  },
};

type Mode = 'choice' | 'voice' | 'chat';
type Lang = 'es' | 'en';

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
}

interface SpeakWithLeoContentProps {
  userId: string | null;
  profileType?: 'renter' | 'buyer';
  isOnboardingComplete: boolean;
  intakeStep?: number;
  whatifsCompleted?: boolean;
  followupCount?: number;
}

export function SpeakWithLeoContent({ 
  userId, 
  profileType = 'renter',
  isOnboardingComplete,
  intakeStep = 0,
  whatifsCompleted = false,
  followupCount = 0,
}: SpeakWithLeoContentProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  
  const [lang, setLang] = useState<Lang>('es');
  const t = UI_TEXT[lang];
  
  const [mode, setMode] = useState<Mode>('choice');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [canRecommend, setCanRecommend] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [completenessScore, setCompletenessScore] = useState(0);

  // Determine current onboarding state
  const getOnboardingState = (): OnboardingState => {
    if (isOnboardingComplete && whatifsCompleted) {
      return followupCount > 0 ? 'FOLLOWUPS_ADDED' : 'WHATIFS_FINISHED';
    }
    if (isOnboardingComplete && !whatifsCompleted) {
      return 'CORE_FINISHED';
    }
    if (intakeStep > 0 && intakeStep < 6) {
      return 'CORE_STARTED';
    }
    return 'NOTHING_DONE';
  };

  const onboardingState = getOnboardingState();
  
  // Voice mode state
  const [voiceConversationId, setVoiceConversationId] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<Message[]>([]);
  
  // Chat mode state
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInitialized, setChatInitialized] = useState(false);
  
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get agent ID based on profile type and onboarding state
  const getAgentId = (): string => {
    if (profileType === 'buyer') {
      switch (onboardingState) {
        case 'NOTHING_DONE':
        case 'CORE_STARTED':
          return BUYER_INTAKE_AGENT_ID;
        case 'CORE_FINISHED':
          return BUYER_WHATIFS_AGENT_ID;
        case 'WHATIFS_FINISHED':
        case 'FOLLOWUPS_ADDED':
          return BUYER_FOLLOWUP_AGENT_ID;
        default:
          return BUYER_INTAKE_AGENT_ID;
      }
    }
    
    // Renter (default)
    switch (onboardingState) {
      case 'NOTHING_DONE':
      case 'CORE_STARTED':
        return RENTER_INTAKE_AGENT_ID;
      case 'CORE_FINISHED':
        return RENTER_WHATIFS_AGENT_ID;
      case 'WHATIFS_FINISHED':
      case 'FOLLOWUPS_ADDED':
        return RENTER_FOLLOWUP_AGENT_ID;
      default:
        return RENTER_INTAKE_AGENT_ID;
    }
  };

  const agentId = getAgentId();

  // Create profile on mount (same as /recommend/intake)
  useEffect(() => {
    const createProfile = async () => {
      try {
        const res = await fetch('/api/recommender/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.success && data.profile?.id) {
          setProfileId(data.profile.id);
        }
      } catch (err) {
        console.error('Failed to create profile:', err);
      }
    };
    createProfile();
  }, []);

  // Extract profile after conversation (same API as /recommend/intake)
  const extractProfile = useCallback(async (convId: string) => {
    if (!convId || isExtracting || !profileId) return;
    
    setIsExtracting(true);
    try {
      const response = await fetch('/api/recommender/extract-voice-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, profileId }),
      });
      const data = await response.json();
      
      if (data.success) {
        setCanRecommend(data.canRecommend ?? false);
        setMissingFields(data.missingFields ?? []);
        setCompletenessScore(data.completenessScore ?? 0);
        
        // Mark intake as complete if this was onboarding
        if (!isOnboardingComplete && userId) {
          await supabase
            .from('user_lifestyle_profiles')
            .update({ intake_completed: true })
            .eq('user_id', userId);
        }
        
        if (data.isComplete || data.canRecommend) {
          setProfileComplete(true);
        }
      }
    } catch (error) {
      console.error('Error extracting:', error);
    } finally {
      setIsExtracting(false);
    }
  }, [profileId, isExtracting, isOnboardingComplete, userId, supabase]);

  // Completion patterns
  const COMPLETION_PATTERNS = [
    'tengo todo lo que necesito',
    'ya tengo toda la información',
    'con esto puedo empezar',
    'perfecto, déjame buscar',
    'ya sé lo que buscas',
    'voy a buscar viviendas',
    'he actualizado tu perfil',
    'cambios guardados',
  ];
  
  const checkForCompletion = useCallback((text: string, source: string) => {
    if (source !== 'agent') return;
    const lowerText = text.toLowerCase();
    const isCompletionMessage = COMPLETION_PATTERNS.some(pattern => lowerText.includes(pattern));
    
    if (isCompletionMessage) {
      setTimeout(() => {
        if (mode === 'voice' && voiceConversationId) {
          endVoice();
        } else if (mode === 'chat' && chatConversationId) {
          extractProfile(chatConversationId);
        }
      }, 2000);
    }
  }, [mode, voiceConversationId, chatConversationId, extractProfile]);

  // ========== VOICE MODE ==========
  const conversation = useConversation({
    onConnect: () => console.log('[Voice] Connected'),
    onDisconnect: () => {
      console.log('[Voice] Disconnected');
      if (voiceConversationId) extractProfile(voiceConversationId);
    },
    onMessage: (message) => {
      if (message.message) {
        setVoiceTranscript(prev => [
          ...prev,
          { id: crypto.randomUUID(), role: message.source === 'user' ? 'user' : 'agent', text: message.message }
        ]);
        checkForCompletion(message.message, message.source);
      }
    },
    onError: (error) => console.error('[Voice] Error:', error),
  });

  const startVoice = useCallback(async () => {
    try {
      const id = await conversation.startSession({ 
        agentId,
        connectionType: 'websocket' as const
      });
      setVoiceConversationId(id);
    } catch (error) {
      console.error('Failed to start voice:', error);
    }
  }, [conversation, agentId]);

  const endVoice = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to end voice:', error);
    }
  }, [conversation]);

  // ========== CHAT MODE ==========
  const sendChatMessage = useCallback(async (text?: string) => {
    const message = (text || chatInput).trim();
    if (!message || chatLoading) return;
    
    setChatInput('');
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: message };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    
    try {
      const res = await fetch('/api/recommender/elevenlabs-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationId: chatConversationId,
          messages: chatMessages,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setChatConversationId(data.conversationId);
        if (data.response) {
          setChatMessages(prev => [
            ...prev,
            { id: crypto.randomUUID(), role: 'agent', text: data.response }
          ]);
          checkForCompletion(data.response, 'agent');
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'agent', text: 'Error de conexión. Inténtalo de nuevo.' }
      ]);
    } finally {
      setChatLoading(false);
      inputRef.current?.focus();
    }
  }, [chatInput, chatLoading, chatConversationId, chatMessages, checkForCompletion]);

  // Auto-scroll
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [voiceTranscript, chatMessages]);

  // Auto-send greeting in chat mode
  useEffect(() => {
    if (mode === 'chat' && !chatInitialized && profileId) {
      setChatInitialized(true);
      const greeting = isOnboardingComplete
        ? '¡Hola de nuevo! ¿Hay algo que quieras contarme o cambiar sobre tu búsqueda?'
        : '¡Hola! Soy Leo. ¿Cómo te va? Cuéntame, ¿qué te ha llevado a buscar casa ahora?';
      setChatMessages([{ id: crypto.randomUUID(), role: 'agent', text: greeting }]);
    }
  }, [mode, chatInitialized, profileId, isOnboardingComplete]);

  const handleProceed = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const handleStartVoiceFromChoice = useCallback(async () => {
    if (!profileId) return;
    setMode('voice');
    try {
      const id = await conversation.startSession({ 
        agentId,
        connectionType: 'websocket' as const
      });
      setVoiceConversationId(id);
    } catch (error) {
      console.error('Failed to start voice:', error);
    }
  }, [profileId, conversation, agentId]);

  const isVoiceActive = conversation.status === 'connected';
  const isVoiceConnecting = conversation.status === 'connecting';
  const isSpeaking = conversation.isSpeaking;
  const isListening = isVoiceActive && !isSpeaking;
  const messageCount = mode === 'voice' ? voiceTranscript.length : chatMessages.length;

  // Get UI text based on onboarding state
  const getStateContent = () => {
    switch (onboardingState) {
      case 'NOTHING_DONE':
        return {
          title: t.titleOnboarding,
          subtitle: t.subtitleOnboarding,
          suggestions: t.suggestions,
        };
      case 'CORE_STARTED':
        return {
          title: lang === 'es' ? 'Continúa donde lo dejaste' : 'Continue where you left off',
          subtitle: lang === 'es' 
            ? `Estás en el paso ${intakeStep}/6. ¡Falta poco para terminar!`
            : `You're on step ${intakeStep}/6. Almost there!`,
          suggestions: t.suggestions,
        };
      case 'CORE_FINISHED':
        return {
          title: lang === 'es' ? "Exploremos algunos 'qué pasaría si'" : "Let's explore some 'what ifs'",
          subtitle: lang === 'es' 
            ? 'Te haré algunas preguntas para entender mejor tu flexibilidad.'
            : "I'll ask some questions to better understand your flexibility.",
          suggestions: lang === 'es' 
            ? ['Podría aumentar mi presupuesto', 'Otras zonas me interesan', 'Menos habitaciones servirían']
            : ['I could increase my budget', 'Other areas interest me', 'Fewer bedrooms would work'],
        };
      case 'WHATIFS_FINISHED':
      case 'FOLLOWUPS_ADDED':
        return {
          title: t.titleFollowup,
          subtitle: t.subtitleFollowup,
          suggestions: t.suggestionFollowup,
        };
      default:
        return {
          title: t.titleOnboarding,
          subtitle: t.subtitleOnboarding,
          suggestions: t.suggestions,
        };
    }
  };

  const { title, subtitle, suggestions } = getStateContent();

  // ========== CHOICE SCREEN ==========
  if (mode === 'choice') {
    return (
      <div className="min-h-[calc(100vh-56px)] md:min-h-screen flex flex-col items-center justify-center p-6">
        {/* Alert for incomplete states */}
        {(onboardingState === 'CORE_STARTED' || onboardingState === 'CORE_FINISHED') && (
          <div className="mb-6 max-w-md w-full">
            <div className={`flex items-center gap-3 p-4 rounded-xl ${
              onboardingState === 'CORE_STARTED' 
                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">
                {onboardingState === 'CORE_STARTED' 
                  ? (lang === 'es' 
                      ? `Te falta completar el paso ${intakeStep} de 6 para que Leo pueda recomendarte propiedades.`
                      : `You need to complete step ${intakeStep} of 6 for Leo to recommend properties.`)
                  : (lang === 'es'
                      ? 'Responde algunas preguntas de flexibilidad para mejorar tus recomendaciones.'
                      : 'Answer some flexibility questions to improve your recommendations.')
                }
              </span>
            </div>
          </div>
        )}

        {/* Amorphous Orb */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-amber-300/20 rounded-full blur-3xl scale-150" />
          <button
            onClick={handleStartVoiceFromChoice}
            disabled={!profileId}
            className="relative transform transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <AmorphousOrb size="xl" color="orange" isAnimating={false} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Phone className="w-16 h-16 text-white drop-shadow-lg" />
            </div>
          </button>
        </div>
        
        <h1 className="font-serif text-3xl font-medium text-stone-900 mb-3 text-center">{title}</h1>
        <p className="text-stone-600 text-center max-w-md mb-8">{subtitle}</p>
        
        <button
          onClick={() => setMode('chat')}
          className="text-stone-500 hover:text-stone-900 transition-colors text-sm flex items-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          {t.preferChat}
        </button>
      </div>
    );
  }

  // ========== VOICE MODE ==========
  if (mode === 'voice') {
    return (
      <div className="min-h-[calc(100vh-56px)] md:min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isVoiceActive ? 'bg-green-500' : 'bg-stone-400'}`} />
            <span className="text-stone-700 font-medium">Leo</span>
          </div>
          <button
            onClick={() => { setMode('chat'); endVoice(); }}
            className="text-stone-500 hover:text-stone-900 transition-colors text-sm flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            {t.write}
          </button>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Animated Amorphous Orb */}
          <div className="relative mb-8">
            {isVoiceConnecting ? (
              <div className="relative">
                <AmorphousOrb size="lg" color="black" isAnimating={true} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-white animate-spin" />
                </div>
              </div>
            ) : (
              <AmorphousOrb 
                size="lg" 
                color="black" 
                isAnimating={isVoiceActive}
                isSpeaking={isSpeaking}
              />
            )}
          </div>
          
          <h2 className="font-serif text-2xl text-stone-900 mb-2">
            {isVoiceConnecting ? t.connecting :
             isSpeaking ? t.leoSpeaking :
             isListening ? t.listening :
             t.readyToTalk}
          </h2>
          <p className="text-stone-500 text-sm mb-8">
            {isListening ? t.tellMe : t.pressToStart}
          </p>
          
          {/* Transcript preview */}
          {voiceTranscript.length > 0 && (
            <div ref={transcriptRef} className="w-full max-w-md p-4 bg-white border border-stone-200 rounded-xl max-h-40 overflow-y-auto shadow-sm">
              {voiceTranscript.slice(-3).map((item) => (
                <p key={item.id} className={`text-sm mb-2 ${item.role === 'user' ? 'text-stone-800' : 'text-stone-500'}`}>
                  <span className="opacity-50">{item.role === 'user' ? 'Tú: ' : 'Leo: '}</span>
                  {item.text.slice(0, 100)}{item.text.length > 100 ? '...' : ''}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 space-y-3">
          {!isVoiceActive && !isVoiceConnecting && (
            <button onClick={startVoice} className="w-full py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-md">
              <Phone className="w-5 h-5" />
              {t.startConversation}
            </button>
          )}
          
          {isVoiceActive && (
            <button onClick={endVoice} className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-red-200">
              <PhoneOff className="w-5 h-5" />
              {t.finish}
            </button>
          )}
          
          {messageCount >= 4 && (
            <button
              onClick={async () => {
                if (isVoiceActive) await endVoice();
                else if (voiceConversationId) await extractProfile(voiceConversationId);
              }}
              disabled={isExtracting}
              className="w-full py-4 bg-white hover:bg-stone-50 text-stone-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-stone-200 shadow-sm"
            >
              {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {isExtracting ? t.analyzing : t.goToProperties}
            </button>
          )}
        </div>

        {profileComplete && <CompletionOverlay onProceed={handleProceed} lang={lang} />}
        {isExtracting && <ExtractingOverlay lang={lang} />}
      </div>
    );
  }

  // ========== CHAT MODE ==========
  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-stone-400" />
          <span className="text-stone-700 font-medium">{t.chatWith}</span>
        </div>
        <button
          onClick={() => setMode('choice')}
          className="text-stone-500 hover:text-stone-900 transition-colors text-sm flex items-center gap-2"
        >
          <Phone className="w-4 h-4" />
          {t.voice}
        </button>
      </div>

      {/* Messages */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-white rounded-xl px-4 py-3 border border-stone-200 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        
        {chatMessages.map((msg, index) => (
          <React.Fragment key={msg.id}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-stone-900 text-white' 
                  : 'bg-white text-stone-700 border border-stone-200 shadow-sm'
              }`}>
                {msg.text}
              </div>
            </div>
            
            {index === 0 && msg.role === 'agent' && chatMessages.length === 1 && (
              <div className="flex flex-wrap justify-center gap-2 py-4">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendChatMessage(s)}
                    className="px-4 py-2 bg-white hover:bg-stone-50 rounded-full text-stone-600 text-sm transition-colors border border-stone-200 shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
        
        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-xl px-4 py-3 border border-stone-200 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 space-y-3 border-t border-stone-200 bg-white">
        <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={t.typeHere}
            disabled={chatLoading}
            className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            className="w-12 h-12 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        
        {messageCount >= 6 && (
          <button
            onClick={async () => {
              if (chatConversationId) await extractProfile(chatConversationId);
            }}
            disabled={isExtracting}
            className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isExtracting ? t.analyzing : `${t.goToProperties} →`}
          </button>
        )}
      </div>

      {profileComplete && <CompletionOverlay onProceed={handleProceed} lang={lang} />}
      {isExtracting && <ExtractingOverlay lang={lang} />}
    </div>
  );
}

// Completion overlay
function CompletionOverlay({ onProceed, lang = 'es' }: { onProceed: () => void; lang?: Lang }) {
  const t = UI_TEXT[lang];
  
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border border-stone-200">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-8 h-8 text-stone-600" />
        </div>
        
        <h2 className="font-serif text-xl text-stone-900 mb-2">{t.profileUpdated}</h2>
        <p className="text-stone-500 mb-6">{t.leoKnows}</p>
        
        <button
          onClick={onProceed}
          className="w-full py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-md"
        >
          {t.goToProperties} <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Extracting overlay
function ExtractingOverlay({ lang = 'es' }: { lang?: Lang }) {
  const t = UI_TEXT[lang];
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center bg-white rounded-2xl p-8 shadow-xl">
        <Loader2 className="w-10 h-10 text-stone-600 animate-spin mx-auto mb-4" />
        <p className="text-stone-700 font-medium">{t.analyzing}</p>
      </div>
    </div>
  );
}
