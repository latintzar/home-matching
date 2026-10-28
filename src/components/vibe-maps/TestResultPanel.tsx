'use client';
import {appFetch as fetch} from '@/lib/app-path';

import { useState, useEffect, useCallback } from 'react';
import type { TestLog } from '@/lib/vibe-maps/testLogger';
import { formatLogForDisplay, getFullLogJSON } from '@/lib/vibe-maps/testLogger';

export type VerdictType = 'passed' | 'failed' | 'needs-evolution' | 'pending';

interface TestResultPanelProps {
  log: TestLog | null;
  isRunning: boolean;
  onPass?: () => void;
  onFail?: () => void;
  onNeedsEvolution?: () => void;
  onRerun?: () => void;
  onDismiss?: () => void;
}

export function TestResultPanel({ 
  log, 
  isRunning, 
  onPass, 
  onFail, 
  onNeedsEvolution,
  onRerun,
  onDismiss 
}: TestResultPanelProps) {
  const [copyFeedback, setCopyFeedback] = useState<'json' | 'text' | null>(null);
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [followUpComment, setFollowUpComment] = useState('');
  const [verdictState, setVerdictState] = useState<{
    saving: boolean;
    saved: VerdictType | null;
    error: string | null;
  }>({ saving: false, saved: null, error: null });
  
  // Reset verdict state when log changes
  useEffect(() => {
    if (log?.verdict) {
      setVerdictState({ saving: false, saved: log.verdict, error: null });
    } else {
      setVerdictState({ saving: false, saved: null, error: null });
    }
  }, [log?.runId, log?.verdict]);
  
  const handleCopyJSON = async () => {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(getFullLogJSON(log));
      setCopyFeedback('json');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const handleCopyFormatted = async () => {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(formatLogForDisplay(log));
      setCopyFeedback('text');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const handleVerdict = useCallback(async (verdict: VerdictType, comment?: string) => {
    if (!log) return;
    
    setVerdictState({ saving: true, saved: null, error: null });
    
    try {
      const response = await fetch('/api/test-logs/verdict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: log.runId, verdict, comment })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save verdict');
      }
      
      console.log(`✅ Verdict saved: Run #${log.runId} → ${verdict.toUpperCase()}${comment ? ' with comment' : ''}`);
      setVerdictState({ saving: false, saved: verdict, error: null });
      setShowFollowUpInput(false);
      setFollowUpComment('');
      
      // Call the callback after a brief delay to show feedback
      setTimeout(() => {
        if (verdict === 'passed') onPass?.();
        else if (verdict === 'failed') onFail?.();
        else if (verdict === 'needs-evolution') onNeedsEvolution?.();
      }, 1500);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save verdict:', errorMsg);
      setVerdictState({ saving: false, saved: null, error: errorMsg });
    }
  }, [log, onPass, onFail, onNeedsEvolution]);

  const handleNeedsEvolutionClick = useCallback(() => {
    setShowFollowUpInput(true);
  }, []);

  const handleSubmitEvolution = useCallback(() => {
    if (!followUpComment.trim()) return;
    handleVerdict('needs-evolution', followUpComment.trim());
  }, [followUpComment, handleVerdict]);
  
  // Running state
  if (isRunning) {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1A1A1A] border border-gray-700 rounded-xl p-4 shadow-2xl z-50 w-80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B6B]/20 flex items-center justify-center">
            <span className="animate-spin text-[#FF6B6B]">⚙️</span>
          </div>
          <div>
            <p className="text-white font-medium">Running Test...</p>
            <p className="text-gray-500 text-sm">Please wait</p>
          </div>
        </div>
      </div>
    );
  }
  
  // No log yet
  if (!log) return null;
  
  const success = log.output?.success ?? false;
  const isSaving = verdictState.saving;
  const hasSaved = verdictState.saved !== null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-[#1A1A1A] border border-gray-700 rounded-xl shadow-2xl z-50 w-96 overflow-hidden">
      {/* Saved Verdict Banner */}
      {hasSaved && (
        <div className={`px-4 py-3 ${
          verdictState.saved === 'passed' 
            ? 'bg-gradient-to-r from-green-600 to-emerald-600' 
            : verdictState.saved === 'needs-evolution'
            ? 'bg-gradient-to-r from-amber-600 to-orange-600'
            : 'bg-gradient-to-r from-red-600 to-rose-600'
        }`}>
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">
              {verdictState.saved === 'passed' ? '🎉' : verdictState.saved === 'needs-evolution' ? '🔄' : '💔'}
            </span>
            <div className="text-center">
              <p className="text-white font-bold text-lg">
                Test #{log.runId} {
                  verdictState.saved === 'passed' ? 'PASSED' : 
                  verdictState.saved === 'needs-evolution' ? 'NEEDS EVOLUTION' : 'FAILED'
                }
              </p>
              <p className="text-white/80 text-sm">
                {verdictState.saved === 'needs-evolution' 
                  ? 'Changes queued — follow-up logged' 
                  : 'Status saved to logs'}
              </p>
            </div>
            <span className="text-2xl">
              {verdictState.saved === 'passed' ? '🎉' : verdictState.saved === 'needs-evolution' ? '🔄' : '💔'}
            </span>
          </div>
        </div>
      )}
      
      {/* Header */}
      {!hasSaved && (
      <div className={`px-4 py-3 border-b border-gray-700 ${success ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{success ? '✅' : '❌'}</span>
            <div>
              <p className="text-white font-semibold">
                Test {log.testId}
              </p>
              <p className="text-gray-400 text-xs">
                {log.testName}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-500 hover:text-white transition-colors p-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
      )}
      
      {/* Run Info */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Run ID</p>
            <p className="text-[#FF6B6B] font-mono text-2xl font-bold">#{log.runId}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Duration</p>
            <p className="text-white font-mono">{log.duration}ms</p>
          </div>
        </div>
        
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-gray-500">API Calls:</span>
          <span className="text-white">{log.apiCalls.length}</span>
          <span className="text-gray-700">|</span>
          <span className="text-gray-500">Steps:</span>
          <span className="text-white">{log.steps.length}</span>
        </div>
      </div>
      
      {/* Error message if failed */}
      {log.output?.error && (
        <div className="px-4 py-2 bg-red-900/10 border-b border-gray-800">
          <p className="text-red-400 text-sm font-mono">{log.output.error}</p>
        </div>
      )}
      
      {/* Verdict Error */}
      {verdictState.error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-gray-800">
          <p className="text-red-400 text-sm">⚠️ {verdictState.error}</p>
        </div>
      )}
      
      {/* Copy Logs Buttons */}
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-gray-500 text-xs mb-2">Copy Logs</p>
        <div className="flex gap-2">
          <button
            onClick={handleCopyJSON}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              copyFeedback === 'json'
                ? 'bg-green-600 text-white'
                : 'bg-[#252525] text-gray-300 hover:bg-[#303030] border border-gray-700'
            }`}
          >
            {copyFeedback === 'json' ? (
              <>✓ Copied!</>
            ) : (
              <>
                <span>📋</span>
                <span>Full JSON</span>
              </>
            )}
          </button>
          <button
            onClick={handleCopyFormatted}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              copyFeedback === 'text'
                ? 'bg-green-600 text-white'
                : 'bg-[#252525] text-gray-300 hover:bg-[#303030] border border-gray-700'
            }`}
          >
            {copyFeedback === 'text' ? (
              <>✓ Copied!</>
            ) : (
              <>
                <span>📄</span>
                <span>Formatted</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Follow-up Comment Input (for Needs Evolution) */}
      {showFollowUpInput && !hasSaved && (
        <div className="px-4 py-3 border-b border-gray-800 bg-amber-900/10">
          <p className="text-amber-400 text-sm mb-2 font-medium">
            What changes will be made?
          </p>
          <textarea
            value={followUpComment}
            onChange={(e) => setFollowUpComment(e.target.value)}
            placeholder="Describe the evolution/changes needed..."
            className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSubmitEvolution}
              disabled={!followUpComment.trim()}
              className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Save & Log Changes
            </button>
            <button
              onClick={() => { setShowFollowUpInput(false); setFollowUpComment(''); }}
              className="px-3 py-2 bg-[#252525] hover:bg-[#303030] text-gray-300 rounded-lg text-sm font-medium transition-colors border border-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Actions - Show different UI based on state */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {isSaving ? (
          <div className="flex items-center justify-center gap-2 py-2.5 text-gray-400">
            <span className="animate-spin">⏳</span>
            <span>Saving verdict...</span>
          </div>
        ) : hasSaved ? (
          <div className="flex gap-2">
            <button
              onClick={onRerun}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#252525] hover:bg-[#303030] text-gray-300 rounded-lg font-medium transition-colors border border-gray-700"
            >
              <span>🔄</span>
              <span>Run Another Test</span>
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2.5 bg-[#252525] hover:bg-[#303030] text-gray-300 rounded-lg font-medium transition-colors border border-gray-700"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        ) : !showFollowUpInput ? (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => handleVerdict('passed')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
              >
                <span>✅</span>
                <span>Pass</span>
              </button>
              <button
                onClick={() => handleVerdict('failed')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
              >
                <span>❌</span>
                <span>Fail</span>
              </button>
              <button
                onClick={onRerun}
                className="px-4 py-2.5 bg-[#252525] hover:bg-[#303030] text-gray-300 rounded-lg font-medium transition-colors border border-gray-700"
                title="Re-run test"
              >
                🔄
              </button>
            </div>
            <button
              onClick={handleNeedsEvolutionClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg font-medium transition-colors border border-amber-600/30"
            >
              <span>🔄</span>
              <span>Works but needs evolution</span>
            </button>
          </>
        ) : null}
      </div>
      
      {/* Footer hint */}
      <div className="px-4 py-2 bg-[#151515] border-t border-gray-800">
        <p className="text-gray-600 text-xs text-center">
          Log saved to <code className="text-gray-500">logs/tests/{log.runId}-test-{log.testId.replace('.', '-')}.json</code>
        </p>
      </div>
    </div>
  );
}
