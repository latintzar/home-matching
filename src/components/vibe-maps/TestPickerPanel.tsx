'use client';

import { useState, useCallback } from 'react';
import { implementationOrder, getProgress, type BuildingBlockTest, type TestStatus } from './testInputData';

interface TestPickerPanelProps {
  onTestSelect?: (test: BuildingBlockTest) => void;
  onClose?: () => void;
}

export default function TestPickerPanel({ onTestSelect, onClose }: TestPickerPanelProps) {
  const [recentlyCopied, setRecentlyCopied] = useState<string | null>(null);
  const progress = getProgress();

  const handleCopy = useCallback(async (text: string, testId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setRecentlyCopied(testId);
      setTimeout(() => setRecentlyCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const handleTestClick = useCallback((test: BuildingBlockTest) => {
    // Only allow clicking on done or implementing tests
    if (test.status === 'not-started') return;
    
    // Copy to clipboard first
    handleCopy(test.input, test.id);
    // Then notify parent
    onTestSelect?.(test);
  }, [handleCopy, onTestSelect]);

  return (
    <div className="h-full flex flex-col bg-[#0D0D0D] border-r border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧪</span>
            <span className="text-white font-medium">Tests</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Close test picker"
          >
            <span className="text-gray-500 text-lg">×</span>
          </button>
        )}
      </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Progress</span>
            <span className="text-gray-400">{progress.done}/{progress.total}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <div className="flex gap-3 text-[10px]">
            <span className="text-emerald-400">✓ {progress.done} done</span>
            <span className="text-yellow-400">● {progress.implementing} in progress</span>
            <span className="text-gray-600">{progress.notStarted} remaining</span>
          </div>
        </div>
      </div>

      {/* Test List - In Implementation Order */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {implementationOrder.map((test, index) => (
          <TestCard
            key={test.id}
            test={test}
            index={index + 1}
            isCopied={recentlyCopied === test.id}
            onCopy={() => handleCopy(test.input, test.id)}
            onClick={() => handleTestClick(test)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800">
        <p className="text-xs text-gray-600 text-center">
          Click a test to run it
        </p>
      </div>
    </div>
  );
}

interface TestCardProps {
  test: BuildingBlockTest;
  index: number;
  isCopied: boolean;
  onCopy: () => void;
  onClick: () => void;
}

function TestCard({ test, index, isCopied, onCopy, onClick }: TestCardProps) {
  const isClickable = test.status !== 'not-started';
  
  // Status styling
  const getStatusStyle = (status: TestStatus) => {
    switch (status) {
      case 'done':
        return {
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          card: 'border-emerald-500/30 hover:border-emerald-500/50',
          icon: '✓',
          label: 'Done'
        };
      case 'implementing':
        return {
          badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
          card: 'border-yellow-500/30 hover:border-yellow-500/50',
          icon: '●',
          label: 'Testing'
        };
      case 'not-started':
        return {
          badge: 'bg-gray-800 text-gray-600 border-gray-700',
          card: 'border-gray-800 opacity-50',
          icon: '○',
          label: 'Not built'
        };
    }
  };

  const statusStyle = getStatusStyle(test.status);

  // Get cost color
  const getCostColor = (cost: string) => {
    if (cost.includes('FREE') || cost === 'Included') return 'text-emerald-400';
    if (cost.includes('0.001') || cost.includes('0.0005')) return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div 
      className={`rounded-lg p-3 border transition-all ${statusStyle.card} ${
        isClickable ? 'cursor-pointer bg-[#1A1A1A]' : 'cursor-not-allowed bg-[#0D0D0D]'
      }`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : -1}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-label={isClickable ? `Run test ${test.id}: ${test.name}` : `Test ${test.id} not available yet`}
      aria-disabled={!isClickable}
        >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
          {/* Order number */}
          <span className="text-[10px] text-gray-600 font-mono w-5">{index}.</span>
          {/* Test ID */}
          <span className="text-[#FF6B6B] font-mono text-xs font-bold">{test.id}</span>
          {/* Status badge */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusStyle.badge}`}>
            {statusStyle.icon} {statusStyle.label}
          </span>
          </div>
        {/* Cost */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-gray-800/50 ${getCostColor(test.cost)}`}>
          {test.cost}
        </span>
      </div>

      {/* Test Name */}
      <div className="text-sm font-medium text-white mb-1">
        {test.name}
      </div>

      {/* API Badge */}
      <div className="mb-2">
        <span className="text-[10px] text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
          {test.api}
        </span>
      </div>

      {/* Description */}
      <p className="text-[10px] text-gray-500 leading-relaxed">
        {test.description}
      </p>

      {/* Copy indicator for clickable tests */}
      {isClickable && (
        <div className="mt-2 flex items-center justify-end">
          {isCopied ? (
            <span className="text-[10px] text-emerald-400">✓ Copied to clipboard</span>
          ) : (
            <span className="text-[10px] text-gray-600">Click to run</span>
          )}
      </div>
      )}
    </div>
  );
}
