'use client';

/**
 * Pro Intake Page
 * 
 * Uses Leo Pro Intake agent - asks about "your client" instead of "you"
 * Same functionality as consumer intake, different agent personality.
 * 
 * Agent: Leo Pro Intake (agent_5201kbd0s2axeddvthzxx2b307m3)
 */

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';
import { Phone, PhoneOff, MessageSquare, Loader2, Send, ArrowRight, Sparkles, Globe, ArrowLeft, Users } from 'lucide-react';

// Leo Pro Intake - For professionals talking about their clients
const PRO_AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_PRO_AGENT_ID || '');

// UI text translations
const UI_TEXT = {
  es: {
    title: 'Briefing con Leo',
    subtitle: 'Cuéntame sobre tu cliente. En 2-3 minutos tendré su perfil listo.',
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
    tellMe: 'Cuéntame sobre tu cliente',
    pressToStart: 'Pulsa para empezar',
    startConversation: 'Hablar con Leo',
    finish: 'Finalizar llamada',
    createProfile: 'Crear perfil',
    analyzing: 'Creando perfil...',
    typeHere: 'Escribe aquí...',
    profileComplete: 'Perfil del cliente creado',
    partialProfile: 'Perfil parcial',
    clientProfileReady: 'El perfil de tu cliente está listo.',
    canStartSearching: 'Puedo empezar a buscar, pero con más info haré mejores recomendaciones.',
    stillMissing: 'Aún me falta saber:',
    viewClient: 'Ver perfil del cliente',
    seeWhatIHave: 'Ver lo que tengo',
    completed: 'completado',
    suggestions: ['Es una pareja joven sin hijos', 'Familia con niños, buscan comprar', 'Profesional que se muda por trabajo'],
    continue: 'Continuar',
    back: 'Volver',
  },
  en: {
    title: 'Briefing with Leo',
    subtitle: 'Tell me about your client. In 2-3 minutes I\'ll have their profile ready.',
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
    tellMe: 'Tell me about your client',
    pressToStart: 'Press to start',
    startConversation: 'Speak with Leo',
    finish: 'End call',
    createProfile: 'Create profile',
    analyzing: 'Creating profile...',
    typeHere: 'Type here...',
    profileComplete: 'Client profile created',
    partialProfile: 'Partial profile',
    clientProfileReady: 'Your client\'s profile is ready.',
    canStartSearching: 'I can start searching, but more info will give better recommendations.',
    stillMissing: 'I still need to know:',
    viewClient: 'View client profile',
    seeWhatIHave: 'See what I have',
    completed: 'complete',
    suggestions: ['Young couple, no kids', 'Family with children, looking to buy', 'Professional relocating for work'],
    continue: 'Continue',
    back: 'Back',
  },
};

type Mode = 'choice' | 'voice' | 'chat';
type Lang = 'es' | 'en';

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
}

function ProIntakePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
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

  // Create profile on mount (linked to pro account)
  useEffect(() => {
    const createProfile = async () => {
      try {
        const res = await fetch('/api/recommender/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPro: true }), // Flag for pro-created profiles
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
        body: JSON.stringify({ conversationId: convId, profileId, isPro: true }),
      });
      const data = await response.json();
      
      if (data.success) {
        setCanRecommend(data.canRecommend ?? false);
        setMissingFields(data.missingFields ?? []);
        setCompletenessScore(data.completenessScore ?? 0);
        
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

  // Voice conversation
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
      }
    },
    onError: (error) => console.error('[Voice] Error:', error),
  });

  const startVoice = useCallback(async () => {
    try {
      const id = await conversation.startSession({ 
        agentId: PRO_AGENT_ID,
        connectionType: 'websocket' as const
      });
      setVoiceConversationId(id);
    } catch (error) {
      console.error('Failed to start voice:', error);
    }
  }, [conversation]);

  const endVoice = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('Failed to end voice:', error);
    }
  }, [conversation]);

  // Chat mode
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
          agentId: PRO_AGENT_ID, // Use pro agent for chat
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
      setChatMessages([{
        id: crypto.randomUUID(),
        role: 'agent',
        text: lang === 'es' 
          ? '¡Hola! Soy Leo. Vamos a crear el perfil de tu cliente. Cuéntame, ¿qué tipo de búsqueda es? ¿Alquiler o compra?'
          : 'Hi! I\'m Leo. Let\'s create your client\'s profile. Tell me, are they looking to rent or buy?'
      }]);
    }
  }, [mode, chatInitialized, profileId, lang]);

  // Navigate to client profile
  const handleProceed = useCallback(() => {
    if (profileId) router.push(`/pro/clients/${profileId}`);
  }, [profileId, router]);

  const isVoiceActive = conversation.status === 'connected';
  const isVoiceConnecting = conversation.status === 'connecting';
  const isSpeaking = conversation.isSpeaking;
  const isListening = isVoiceActive && !isSpeaking;
  const messageCount = mode === 'voice' ? voiceTranscript.length : chatMessages.length;

  // Language toggle
  const handleLanguageSwitch = useCallback(async () => {
    const newLang = lang === 'es' ? 'en' : 'es';
    if (conversation.status === 'connected') {
      await conversation.endSession();
      setVoiceConversationId(null);
      setVoiceTranscript([]);
    }
    setChatMessages([]);
    setChatConversationId(null);
    setChatInitialized(false);
    setLang(newLang);
    
    if (mode === 'voice') {
      setTimeout(async () => {
        try {
          const id = await conversation.startSession({ 
            agentId: PRO_AGENT_ID,
            connectionType: 'websocket' as const
          });
          setVoiceConversationId(id);
        } catch (error) {
          console.error('Failed to restart voice:', error);
        }
      }, 500);
    }
  }, [lang, conversation, mode]);

  const LanguageToggle = () => (
    <button
      onClick={handleLanguageSwitch}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-stone-200 text-stone-600 hover:bg-white hover:text-stone-900 transition-colors text-sm"
    >
      <Globe className="w-4 h-4" />
      {lang === 'es' ? 'EN' : 'ES'}
    </button>
  );

  // Start voice from choice
  const handleStartVoiceFromChoice = useCallback(async () => {
    if (!profileId) return;
    setMode('voice');
    try {
      const id = await conversation.startSession({ 
        agentId: PRO_AGENT_ID,
        connectionType: 'websocket' as const
      });
      setVoiceConversationId(id);
    } catch (error) {
      console.error('Failed to start voice:', error);
    }
  }, [profileId, conversation]);

  // Choice screen
  if (mode === 'choice') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6">
        {/* Header */}
        <div className="absolute top-6 left-6">
          <button
            onClick={() => router.push('/pro/clients/new')}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t.back}
          </button>
        </div>
        <div className="absolute top-6 right-6">
          <LanguageToggle />
        </div>
        
        {/* Pro badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm mb-8">
          <Users className="w-4 h-4" />
          Pro Mode - Talking about your client
        </div>
        
        {/* Orb */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-blue-300/30 rounded-full blur-3xl scale-150" />
          <div className="absolute -inset-8 rounded-full border border-blue-300/40 animate-pulse" />
          <button
            onClick={handleStartVoiceFromChoice}
            disabled={!profileId}
            className="relative w-40 h-40 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900/20 transform transition-all hover:scale-105 hover:bg-blue-500 active:scale-95 disabled:opacity-50"
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

  // Voice mode
  if (mode === 'voice') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isVoiceActive ? 'bg-green-500' : 'bg-stone-400'}`} />
            <span className="text-stone-700 font-medium">Leo</span>
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Pro</span>
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
          {/* Animated Orb - Blue for Pro */}
          <div className="relative mb-8">
            <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-500 ${
              isSpeaking ? 'bg-blue-400/30 scale-[2]' :
              isListening ? 'bg-blue-300/30 scale-[1.8] animate-pulse' :
              isVoiceConnecting ? 'bg-blue-300/20 scale-150' :
              'bg-blue-200/30 scale-125'
            }`} />
            
            {isSpeaking && (
              <>
                <div className="absolute inset-0 rounded-full border border-blue-400/40 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute -inset-4 rounded-full border border-blue-300/30 animate-ping" style={{ animationDuration: '2s' }} />
              </>
            )}
            
            {isListening && (
              <div className="absolute -inset-4 rounded-full border border-blue-400/40 animate-pulse" />
            )}
            
            <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
              isSpeaking ? 'bg-blue-600 scale-110' :
              isListening ? 'bg-blue-500' :
              isVoiceConnecting ? 'bg-blue-400' :
              'bg-blue-600'
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
            <button onClick={startVoice} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-md">
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
              {isExtracting ? t.analyzing : t.createProfile}
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
          />
        )}
        {isExtracting && <ExtractingOverlay lang={lang} />}
      </div>
    );
  }

  // Chat mode
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-stone-400" />
          <span className="text-stone-700 font-medium">{t.chatWith}</span>
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Pro</span>
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
        {chatMessages.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-white rounded-xl px-4 py-3 border border-stone-200 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        
        {chatMessages.map((msg, index) => (
          <React.Fragment key={msg.id}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-stone-700 border border-stone-200 shadow-sm'
              }`}>
                {msg.text}
              </div>
            </div>
            
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
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
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
            className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm"
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
            className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isExtracting ? t.analyzing : `${t.createProfile} →`}
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
        />
      )}
      {isExtracting && <ExtractingOverlay lang={lang} />}
    </div>
  );
}

// Completion overlay
function CompletionOverlay({ 
  onProceed, 
  canRecommend, 
  missingFields, 
  completenessScore, 
  lang = 'es',
}: { 
  onProceed: () => void;
  canRecommend?: boolean;
  missingFields?: string[];
  completenessScore?: number;
  lang?: Lang;
}) {
  const t = UI_TEXT[lang];
  const isPartial = !canRecommend && missingFields && missingFields.length > 0;
  
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border border-stone-200">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-8 h-8 text-blue-600" />
        </div>
        
        <h2 className="font-serif text-xl text-stone-900 mb-2">
          {isPartial ? t.partialProfile : t.profileComplete}
        </h2>
        
        {completenessScore !== undefined && (
          <div className="mb-4">
            <div className="w-full bg-stone-100 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ width: `${completenessScore}%` }}
              />
            </div>
            <p className="text-stone-400 text-xs">{completenessScore}% {t.completed}</p>
          </div>
        )}
        
        <p className="text-stone-500 mb-6">
          {isPartial ? t.canStartSearching : t.clientProfileReady}
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
          onClick={onProceed}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-md"
        >
          {t.viewClient} <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Loading fallback
function ProIntakeLoading() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
    </div>
  );
}

// Extracting overlay
function ExtractingOverlay({ lang = 'es' }: { lang?: Lang }) {
  const t = UI_TEXT[lang];
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center bg-white rounded-2xl p-8 shadow-xl">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-stone-700 font-medium">{t.analyzing}</p>
      </div>
    </div>
  );
}

export default function ProIntakePage() {
  return (
    <Suspense fallback={<ProIntakeLoading />}>
      <ProIntakePageContent />
    </Suspense>
  );
}

