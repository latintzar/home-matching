'use client';
import {appFetch as fetch} from '@/lib/app-path';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, ChevronDown, ChevronUp, Terminal, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type LogEntry = {
  id: string;
  message: string;
  meta?: Record<string, unknown>;
  level?: 'info' | 'error';
  timestamp: Date;
};

export default function AutoAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoStart = searchParams.get('auto') === 'true';
  const { id } = use(params);

  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasStarted = useRef(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoStart && !hasStarted.current) {
      hasStarted.current = true;
      startBasicOrchestrator();
    }
  }, [autoStart]);

  const addLog = (msg: string, meta?: Record<string, unknown>, level: LogEntry['level'] = 'info') => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(-4)}`,
      message: msg,
      meta,
      level,
      timestamp: new Date(),
    };
    setLogs(prev => [...prev, entry]);
  };

  useEffect(() => {
    // Auto-scroll logs to bottom when expanded
    if (logsContainerRef.current && isExpanded) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const startBasicOrchestrator = async () => {
    setStatus('running');
    addLog('🚀 Starting Basic Orchestrator...');

    try {
      const response = await fetch(`/api/listings/${id}/orchestrate-basic-package`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `HTTP ${response.status} ${response.statusText}`;
        try {
          const json = JSON.parse(errorText);
          if (json.error) errorMsg += `: ${json.error}`;
        } catch {
          if (errorText) errorMsg += `: ${errorText.slice(0, 100)}`;
        }
        throw new Error(errorMsg);
      }
      
      if (!response.body) throw new Error('No response stream');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) {
                const prefix = data.type ? `[${data.type}] ` : '';
                addLog(`${prefix}${data.message}`, data, data.type === 'error' ? 'error' : 'info');
                if (data.type === 'complete' || data.message.includes('Pipeline Complete')) {
                   setStatus('complete');
                   toast.success('Analysis Complete!');
                   setTimeout(() => {
                     router.push(`/property/${id}`);
                   }, 1500);
                }
              }
            } catch (e) {
              addLog(`Failed to parse log chunk: ${(e as Error).message}`, { chunk: line }, 'error');
            }
          }
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setStatus('error');
      addLog(`❌ Error: ${(err as Error).message}`, { error: err }, 'error');
    }
  };

  const latestLog = logs[logs.length - 1];
  const logCount = logs.length;

  const getStatusIcon = () => {
    if (status === 'complete') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    if (status === 'error') return <XCircle className="h-5 w-5 text-red-500" />;
    if (status === 'running') return <Loader2 className="h-5 w-5 text-[#da654d] animate-spin" />;
    return <Terminal className="h-5 w-5 text-stone-400" />;
  };

  const getStatusText = () => {
    if (status === 'complete') return 'Analysis Complete';
    if (status === 'error') return 'Analysis Failed';
    if (status === 'running') return 'Analyzing...';
    return 'Ready to Analyze';
  };

  return (
    <div className="min-h-screen h-screen overflow-hidden bg-[#FDFBF7] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#FDFBF7] border-b border-stone-100 z-50">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
            <span className="font-serif text-xl font-medium tracking-tight text-stone-900">Leo.casa</span>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/')} 
            className="text-stone-500 hover:text-stone-700"
          >
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content - Centered */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
            <div className="flex justify-center mb-5">
              <div className={`h-20 w-20 rounded-2xl flex items-center justify-center border ${
                status === 'complete' ? 'bg-emerald-50 border-emerald-200' :
                status === 'error' ? 'bg-red-50 border-red-200' :
                status === 'running' ? 'bg-orange-50 border-orange-200' :
                'bg-stone-50 border-stone-200'
              }`}>
                {status === 'complete' ? (
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                ) : status === 'error' ? (
                  <XCircle className="h-10 w-10 text-red-500" />
                ) : status === 'running' ? (
                  <Loader2 className="h-10 w-10 text-[#da654d] animate-spin" />
                ) : (
                  <Terminal className="h-10 w-10 text-stone-400" />
                )}
               </div>
            </div>
            
            <h1 className="font-serif text-2xl font-medium text-stone-900 mb-2">
              {getStatusText()}
            </h1>
            <p className="text-stone-500 text-sm mb-6">
              Property #{id}
            </p>

            {status === 'idle' && (
              <Button 
                onClick={startBasicOrchestrator} 
                className="bg-[#da654d] hover:bg-[#c8553d] text-white shadow-md px-8"
              >
                Start Analysis
              </Button>
            )}

            {status === 'complete' && (
              <Button 
                onClick={() => router.push(`/property/${id}`)} 
                className="bg-[#da654d] hover:bg-[#c8553d] text-white shadow-md px-8"
              >
                View Results <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {status === 'error' && (
              <Button 
                onClick={() => { setStatus('idle'); setLogs([]); }} 
                variant="outline"
                className="border-stone-300"
              >
                Try Again
              </Button>
            )}
          </div>

          {/* Collapsible Terminal Box - Cursor Style */}
          {logs.length > 0 && (
            <div className="bg-stone-900 rounded-xl border border-stone-700 overflow-hidden shadow-lg">
              {/* Terminal Header - Always Visible */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getStatusIcon()}
                  <span className="font-mono text-xs text-stone-300 truncate">
                    {latestLog?.message || 'Waiting...'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className="text-[10px] text-stone-500 font-mono">
                    {logCount} {logCount === 1 ? 'line' : 'lines'}
               </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-stone-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-stone-500" />
                  )}
                </div>
              </button>

              {/* Expanded Logs */}
              {isExpanded && (
             <div 
               ref={logsContainerRef}
                  className="border-t border-stone-700 max-h-72 overflow-y-auto"
             >
                  <div className="p-4 space-y-1">
                    {logs.map((log, idx) => (
                      <div 
                        key={log.id} 
                        className={`font-mono text-xs leading-relaxed ${
                          log.level === 'error' ? 'text-red-400' : 'text-stone-300'
                        } ${idx === logs.length - 1 ? 'text-white font-medium' : ''}`}
                      >
                        <span className="text-stone-600 mr-2">
                          {log.timestamp.toLocaleTimeString('en-US', { 
                            hour12: false, 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit' 
                          })}
                        </span>
                        {log.message}
                    </div>
                ))}
                {status === 'running' && (
                      <div className="flex items-center gap-2 pt-2 text-[#da654d] font-mono text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="animate-pulse">Processing...</span>
                   </div>
                )}
             </div>
                </div>
              )}
             </div>
          )}

          {/* Idle state hint */}
          {logs.length === 0 && status === 'running' && (
            <div className="bg-stone-900 rounded-xl border border-stone-700 px-4 py-3 flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-[#da654d] animate-spin" />
              <span className="font-mono text-xs text-stone-400 animate-pulse">
                Connecting to orchestrator...
              </span>
            </div>
          )}
        
          <p className="text-center text-stone-400 text-xs">
          You can safely close this tab. Check back in your Dashboard later.
        </p>
        </div>
      </div>
    </div>
  );
}
