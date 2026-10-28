'use client';

/**
 * Voice-First Intake Page
 * 
 * Voice Mode: ElevenLabs WebRTC (mic + speaker)
 * Chat Mode: ElevenLabs Text API (no mic, no speaker)
 * 
 * Same Leo agent, two different interfaces.
 * Supports ES/EN via language toggle.
 */

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';
import { Phone, PhoneOff, MessageSquare, Loader2, Send, ArrowRight, Sparkles, Globe } from 'lucide-react';

// Leo Intake - Single multilingual agent (handles ES/EN/mixed)
const AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || '');

// Multilingual - same agent for both, responds in user's language
const AGENT_IDS = {
  es: AGENT_ID,
  en: AGENT_ID,
};

// UI text translations
const UI_TEXT = {
  es: {
    title: 'Habla con Leo',
    subtitle: 'Cuéntame sobre tu vida y lo que buscas. En 2-3 minutos sabré exactamente qué tipo de casa necesitas.',
    preferChat: 'Prefiero escribir',
    chatWith: 'Chat con Leo',
    speakWithLeo: 'Hablar con Leo',
    joinCall: 'Unirse a la llamada',
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
    searchProperties: 'Buscar viviendas',
    analyzing: 'Analizando...',
    typeHere: 'Escribe aquí...',
    profileComplete: 'Perfil completado',
    partialProfile: 'Perfil parcial',
    leoKnows: 'Leo ya sabe lo que buscas.',
    canStartSearching: 'Puedo empezar a buscar, pero con más info haré mejores recomendaciones.',
    stillMissing: 'Aún me falta saber:',
    seeProperties: 'Ver viviendas',
    seeWhatIHave: 'Ver lo que tengo',
    completed: 'completado',
    suggestions: ['Estoy buscando piso para mí', 'Somos familia con niños', 'Busco algo tranquilo'],
    // Delivery preference
    howToReceive: '¿Cómo quieres recibir las viviendas?',
    byEmail: 'Por email',
    byWhatsApp: 'Por WhatsApp',
    enterEmail: 'Tu email',
    enterPhone: 'Tu número de WhatsApp',
    continue: 'Continuar',
    relaxMessage: 'Relájate, te enviaré viviendas que encajan contigo.',
  },
  en: {
    title: 'Kickoff with Leo',
    subtitle: 'Tell me about your life and what you\'re looking for. In 2-3 minutes I\'ll know exactly what kind of home you need.',
    preferChat: 'I prefer to type',
    chatWith: 'Chat with Leo',
    speakWithLeo: 'Speak with Leo',
    joinCall: 'Join call',
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
    searchProperties: 'Find properties',
    analyzing: 'Analyzing...',
    typeHere: 'Type here...',
    profileComplete: 'Profile complete',
    partialProfile: 'Partial profile',
    leoKnows: 'Leo knows what you\'re looking for.',
    canStartSearching: 'I can start searching, but more info will give you better recommendations.',
    stillMissing: 'I still need to know:',
    seeProperties: 'See properties',
    // Delivery preference
    howToReceive: 'How do you want to receive properties?',
    byEmail: 'By email',
    byWhatsApp: 'By WhatsApp',
    enterEmail: 'Your email',
    enterPhone: 'Your WhatsApp number',
    continue: 'Continue',
    relaxMessage: 'Relax, I\'ll send you properties that fit your lifestyle.',
    seeWhatIHave: 'See what I have',
    completed: 'complete',
    suggestions: ['I\'m looking for an apartment', 'We\'re a family with kids', 'Looking for something quiet'],
  },
};

type Mode = 'choice' | 'voice' | 'chat';
type Lang = 'es' | 'en';

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
}

function IntakePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Language - check URL param or default to Spanish
  const [lang, setLang] = useState<Lang>(() => {
    const urlLang = searchParams.get('lang');
    return (urlLang === 'en' || urlLang === 'es') ? urlLang : 'es';
  });
  const t = UI_TEXT[lang];
  
  const [mode, setMode] = useState<Mode>('choice');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [canRecommend, setCanRecommend] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [completenessScore, setCompletenessScore] = useState(0);
  
  // Delivery preference
  const [deliveryPreference, setDeliveryPreference] = useState<'email' | 'whatsapp'>('email');
  const [contactInfo, setContactInfo] = useState('');
  const [showDeliveryStep, setShowDeliveryStep] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  
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

  // Create profile on mount
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

  // Extract profile
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
        
        // Mark complete if we can recommend OR if profile is complete
        if (data.isComplete || data.canRecommend) {
          setProfileComplete(true);
        }
      }
    } catch (error) {
      console.error('Error extracting:', error);
    } finally {
      setIsExtracting(false);
    }
  }, [profileId, isExtracting]);

  // Patterns that indicate the agent has enough info (agent-initiated completion)
  const COMPLETION_PATTERNS = [
    'tengo todo lo que necesito',
    'ya tengo toda la información',
    'con esto puedo empezar',
    'perfecto, déjame buscar',
    'ya sé lo que buscas',
    'voy a buscar viviendas',
  ];
  
  // Check if message indicates agent has enough info
  const checkForCompletion = useCallback((text: string, source: string) => {
    if (source !== 'agent') return;
    
    const lowerText = text.toLowerCase();
    const isCompletionMessage = COMPLETION_PATTERNS.some(pattern => lowerText.includes(pattern));
    
    if (isCompletionMessage) {
      console.log('[Intake] Agent indicated completion, auto-extracting...');
      // Wait a moment for the message to finish, then extract
      setTimeout(() => {
        if (mode === 'voice' && voiceConversationId) {
          endVoice();
        } else if (mode === 'chat' && chatConversationId) {
          extractProfile(chatConversationId);
        }
      }, 2000);
    }
  }, [mode, voiceConversationId, chatConversationId, extractProfile]);

  // ========== VOICE MODE (ElevenLabs WebRTC) ==========
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
        // Check for agent-initiated completion
        checkForCompletion(message.message, message.source);
      }
    },
    onError: (error) => console.error('[Voice] Error:', error),
  });

  const startVoice = useCallback(async () => {
    try {
      const id = await conversation.startSession({ 
        agentId: AGENT_IDS[lang],
        connectionType: 'websocket' as const
      });
      setVoiceConversationId(id);
    } catch (error) {
      console.error('Failed to start voice:', error);
    }
  }, [conversation, lang]);

  const endVoice = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to end voice:', error);
    }
  }, [conversation]);

  // ========== CHAT MODE (ElevenLabs Text API) ==========
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
          // Check for agent-initiated completion
          checkForCompletion(data.response, 'agent');
        }
      } else if (data.fallback) {
        // API not available, use fallback message
        setChatMessages(prev => [
          ...prev,
          { id: crypto.randomUUID(), role: 'agent', text: 'Lo siento, hubo un problema. ¿Puedes intentarlo de nuevo?' }
        ]);
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
  }, [chatInput, chatLoading, chatConversationId, chatMessages]);

  // Auto-scroll
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [voiceTranscript, chatMessages]);

  // Auto-send Leo's greeting when entering chat mode
  useEffect(() => {
    if (mode === 'chat' && !chatInitialized && profileId) {
      setChatInitialized(true);
      // Leo sends the first message - no friction!
      setChatMessages([{
        id: crypto.randomUUID(),
        role: 'agent',
        text: '¡Hola! Soy Leo. ¿Cómo te va? Cuéntame, ¿qué te ha llevado a buscar casa ahora?'
      }]);
    }
  }, [mode, chatInitialized, profileId]);

  // Navigate to results
  const handleProceed = useCallback(() => {
    if (profileId) router.push(`/recommend?profileId=${profileId}`);
  }, [profileId, router]);

  const isVoiceActive = conversation.status === 'connected';
  const isVoiceConnecting = conversation.status === 'connecting';
  const isSpeaking = conversation.isSpeaking;
  const isListening = isVoiceActive && !isSpeaking;
  const messageCount = mode === 'voice' ? voiceTranscript.length : chatMessages.length;

  // Handle language switch - restart conversation if active
  const handleLanguageSwitch = useCallback(async () => {
    const newLang = lang === 'es' ? 'en' : 'es';
    
    // If voice is active, end it first
    if (conversation.status === 'connected') {
      await conversation.endSession();
      setVoiceConversationId(null);
      setVoiceTranscript([]);
    }
    
    // Clear chat state too
    setChatMessages([]);
    setChatConversationId(null);
    setChatInitialized(false);
    
    // Switch language
    setLang(newLang);
    
    // If in voice mode, restart with new language
    if (mode === 'voice') {
      setTimeout(async () => {
        try {
          const id = await conversation.startSession({ 
            agentId: AGENT_IDS[newLang],
            connectionType: 'websocket' as const
          });
          setVoiceConversationId(id);
        } catch (error) {
          console.error('Failed to restart voice:', error);
        }
      }, 500);
    }
    
    // If in chat mode, greeting will auto-send via useEffect
  }, [lang, conversation, mode]);

  // Language toggle component
  const LanguageToggle = () => (
    <button
      onClick={handleLanguageSwitch}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-stone-200 text-stone-600 hover:bg-white hover:text-stone-900 transition-colors text-sm"
    >
      <Globe className="w-4 h-4" />
      {lang === 'es' ? 'EN' : 'ES'}
    </button>
  );

  // Start voice AND switch to voice mode in one click
  const handleStartVoiceFromChoice = useCallback(async () => {
    if (!profileId) return;
    setMode('voice');
    // Start the session immediately
    try {
      const id = await conversation.startSession({ 
        agentId: AGENT_IDS[lang],
        connectionType: 'websocket' as const
      });
      setVoiceConversationId(id);
    } catch (error) {
      console.error('Failed to start voice:', error);
    }
  }, [profileId, conversation, lang]);

  // ========== CHOICE SCREEN ==========
  if (mode === 'choice') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6">
        {/* Language toggle - top right */}
        <div className="absolute top-6 right-6">
          <LanguageToggle />
        </div>
        
        {/* Orb - ONE CLICK starts voice immediately */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-stone-300/30 rounded-full blur-3xl scale-150" />
          <div className="absolute -inset-8 rounded-full border border-stone-300/40 animate-pulse" />
          <button
            onClick={handleStartVoiceFromChoice}
            disabled={!profileId}
            className="relative w-40 h-40 rounded-full bg-stone-900 flex items-center justify-center shadow-2xl shadow-stone-900/20 transform transition-all hover:scale-105 hover:bg-stone-800 active:scale-95 disabled:opacity-50"
          >
            <Phone className="w-16 h-16 text-white" />
          </button>
        </div>
        
        <h1 className="font-serif text-3xl font-medium text-stone-900 mb-3 text-center">{t.title}</h1>
        <p className="text-stone-600 text-center max-w-md mb-8">
          {t.subtitle}
        </p>
        
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
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isVoiceActive ? 'bg-green-500' : 'bg-stone-400'}`} />
            <span className="text-stone-700 font-medium">Leo</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <button
              onClick={() => { setMode('chat'); endVoice(); }}
              className="text-stone-500 hover:text-stone-900 transition-colors text-sm flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              {t.write}
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Animated Orb */}
          <div className="relative mb-8">
            <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-500 ${
              isSpeaking ? 'bg-stone-400/30 scale-[2]' :
              isListening ? 'bg-stone-300/30 scale-[1.8] animate-pulse' :
              isVoiceConnecting ? 'bg-stone-300/20 scale-150' :
              'bg-stone-200/30 scale-125'
            }`} />
            
            {isSpeaking && (
              <>
                <div className="absolute inset-0 rounded-full border border-stone-400/40 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute -inset-4 rounded-full border border-stone-300/30 animate-ping" style={{ animationDuration: '2s' }} />
              </>
            )}
            
            {isListening && (
              <div className="absolute -inset-4 rounded-full border border-stone-400/40 animate-pulse" />
            )}
            
            <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
              isSpeaking ? 'bg-stone-900 scale-110' :
              isListening ? 'bg-stone-800' :
              isVoiceConnecting ? 'bg-stone-700' :
              'bg-stone-900'
            }`}>
              {isVoiceConnecting ? (
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              ) : (
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 bg-white rounded-full transition-all ${
                        isSpeaking || isListening ? 'animate-bounce' : ''
                      }`}
                      style={{
                        height: isSpeaking ? '24px' : isListening ? '16px' : '8px',
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
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
                  <span className="opacity-50">{item.role === 'user' ? (lang === 'es' ? 'Tú: ' : 'You: ') : 'Leo: '}</span>
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
              {isExtracting ? t.analyzing : t.searchProperties}
            </button>
          )}
        </div>

        {/* Completion overlay */}
        {profileComplete && (
          <CompletionOverlay 
            onProceed={handleProceed} 
            canRecommend={canRecommend}
            missingFields={missingFields}
            profileId={profileId}
            completenessScore={completenessScore}
            lang={lang}
          />
        )}
        {isExtracting && <ExtractingOverlay lang={lang} />}
      </div>
    );
  }

  // ========== CHAT MODE (No mic, no speaker - just text) ==========
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-stone-400" />
          <span className="text-stone-700 font-medium">{t.chatWith}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <button
            onClick={() => setMode('choice')}
            className="text-stone-500 hover:text-stone-900 transition-colors text-sm flex items-center gap-2"
          >
            <Phone className="w-4 h-4" />
            {t.voice}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Loading state while waiting for initial greeting */}
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
            
            {/* Show suggestions after Leo's first message, before user replies */}
            {index === 0 && msg.role === 'agent' && chatMessages.length === 1 && (
              <div className="flex flex-wrap justify-center gap-2 py-4">
                {t.suggestions.map((s, i) => (
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
            {isExtracting ? t.analyzing : `${t.searchProperties} →`}
          </button>
        )}
      </div>

      {profileComplete && (
        <CompletionOverlay 
          onProceed={handleProceed} 
          canRecommend={canRecommend}
          missingFields={missingFields}
          completenessScore={completenessScore}
          lang={lang}
          profileId={profileId}
        />
      )}
      {isExtracting && <ExtractingOverlay lang={lang} />}
    </div>
  );
}

// Completion overlay component
function CompletionOverlay({ 
  onProceed, 
  canRecommend, 
  missingFields, 
  completenessScore, 
  lang = 'es',
  profileId,
}: { 
  onProceed: () => void;
  canRecommend?: boolean;
  missingFields?: string[];
  completenessScore?: number;
  lang?: Lang;
  profileId?: string | null;
}) {
  const t = UI_TEXT[lang];
  const isPartial = !canRecommend && missingFields && missingFields.length > 0;
  
  // Delivery preference state
  const [step, setStep] = useState<'summary' | 'delivery'>('summary');
  const [deliveryPref, setDeliveryPref] = useState<'email' | 'whatsapp'>('email');
  const [contactValue, setContactValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Save delivery preference
  const handleSaveDelivery = async () => {
    if (!contactValue.trim()) {
      setError(deliveryPref === 'email' ? 'Email required' : 'Phone number required');
      return;
    }
    
    // Basic validation
    if (deliveryPref === 'email' && !contactValue.includes('@')) {
      setError('Invalid email address');
      return;
    }
    
    if (deliveryPref === 'whatsapp' && contactValue.replace(/\D/g, '').length < 9) {
      setError('Invalid phone number');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const res = await fetch('/api/recommender/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          deliveryPreference: deliveryPref,
          email: deliveryPref === 'email' ? contactValue : undefined,
          phoneNumber: deliveryPref === 'whatsapp' ? contactValue : undefined,
        }),
      });
      
      if (res.ok) {
        onProceed();
      } else {
        setError('Failed to save preference');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border border-stone-200">
        
        {step === 'summary' ? (
          <>
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-stone-600" />
            </div>
            
            <h2 className="font-serif text-xl text-stone-900 mb-2">
              {isPartial ? t.partialProfile : t.profileComplete}
            </h2>
            
            {completenessScore !== undefined && (
              <div className="mb-4">
                <div className="w-full bg-stone-100 rounded-full h-2 mb-2">
                  <div 
                    className="bg-stone-600 h-2 rounded-full transition-all" 
                    style={{ width: `${completenessScore}%` }}
                  />
                </div>
                <p className="text-stone-400 text-xs">{completenessScore}% {t.completed}</p>
              </div>
            )}
            
            <p className="text-stone-500 mb-6">
              {isPartial ? t.canStartSearching : t.leoKnows}
            </p>
            
            {isPartial && missingFields && missingFields.length > 0 && (
              <div className="mb-6 p-4 bg-stone-50 rounded-xl border border-stone-200 text-left">
                <p className="text-stone-600 text-sm mb-2">{t.stillMissing}</p>
                <ul className="text-stone-500 text-sm space-y-1">
                  {missingFields.slice(0, 4).map((field, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-stone-400">•</span> {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <button
              onClick={() => setStep('delivery')}
              className="w-full py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              {t.continue} <ArrowRight className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            {/* Delivery preference step */}
            <h2 className="font-serif text-xl text-stone-900 mb-2">{t.howToReceive}</h2>
            <p className="text-stone-500 mb-6">{t.relaxMessage}</p>
            
            {/* Toggle buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => { setDeliveryPref('email'); setContactValue(''); setError(''); }}
                className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${
                  deliveryPref === 'email' 
                    ? 'border-stone-900 bg-stone-900 text-white' 
                    : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                📧 {t.byEmail}
              </button>
              <button
                onClick={() => { setDeliveryPref('whatsapp'); setContactValue(''); setError(''); }}
                className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${
                  deliveryPref === 'whatsapp' 
                    ? 'border-stone-900 bg-stone-900 text-white' 
                    : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                💬 {t.byWhatsApp}
              </button>
            </div>
            
            {/* Input field */}
            <input
              type={deliveryPref === 'email' ? 'email' : 'tel'}
              value={contactValue}
              onChange={(e) => { setContactValue(e.target.value); setError(''); }}
              placeholder={deliveryPref === 'email' ? t.enterEmail : t.enterPhone}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 mb-3 focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
            
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            
            <button
              onClick={handleSaveDelivery}
              disabled={saving || !contactValue.trim()}
              className="w-full py-4 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {t.seeProperties} <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function IntakePageLoading() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-stone-600 animate-spin" />
    </div>
  );
}

// Extracting overlay component
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

// Main export with Suspense boundary for useSearchParams
export default function IntakePage() {
  return (
    <Suspense fallback={<IntakePageLoading />}>
      <IntakePageContent />
    </Suspense>
  );
}
