/**
 * usePipelineData - Hook for managing pipeline-aware data
 * 
 * This hook provides a clean interface for components to work with
 * pipeline data, including automatic stage detection and updates.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { detectPipelineStage, PipelineStage } from '@/lib/pipeline-utils';
import { PropertyDataContract } from '@/types/progressive-components';

interface UsePipelineDataOptions {
  autoDetectStage?: boolean;
  onStageChange?: (stage: PipelineStage) => void;
  initialStage?: PipelineStage;
}

interface UsePipelineDataReturn {
  data: PropertyDataContract | null;
  pipelineStage: PipelineStage;
  isSkeleton: boolean;
  setData: (data: PropertyDataContract | null) => void;
  updateData: (updates: Partial<PropertyDataContract>) => void;
  resetData: () => void;
  hasStageData: (stage: PipelineStage) => boolean;
}

export const usePipelineData = (
  initialData: PropertyDataContract | null = null,
  options: UsePipelineDataOptions = {}
): UsePipelineDataReturn => {
  const {
    autoDetectStage = true,
    onStageChange,
    initialStage = 'none'
  } = options;

  const [data, setDataState] = useState<PropertyDataContract | null>(initialData);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(initialStage);

  // Update internal data when initialData prop changes
  useEffect(() => {
    setDataState(initialData);
  }, [initialData]);

  // Auto-detect pipeline stage when data changes
  useEffect(() => {
    if (autoDetectStage) {
      const detectedStage = detectPipelineStage(data);
      setPipelineStage(prevStage => {
        if (prevStage !== detectedStage && onStageChange) {
        onStageChange(detectedStage);
      }
        return detectedStage;
      });
    }
  }, [data, autoDetectStage, onStageChange]);

  // Set data and trigger stage detection
  const setData = useCallback((newData: PropertyDataContract | null) => {
    setDataState(newData);
  }, []);

  // Update data partially
  const updateData = useCallback((updates: Partial<PropertyDataContract>) => {
    setDataState(prevData => ({
      ...prevData,
      ...updates
    }));
  }, []);

  // Reset data
  const resetData = useCallback(() => {
    setDataState(null);
    setPipelineStage('none');
  }, []);

  // Check if specific stage data is available
  const hasStageData = useCallback((stage: PipelineStage): boolean => {
    if (!data) return false;
    
    switch (stage) {
      case 'scraped':
        return !!(data.title || data.price || data.constructedArea);
      case 'photos-stored':
        return !!(data.photos && data.photos.length > 0);
      case 'text-analysis':
        return !!(data.headlines && data.headlines.length > 0);
      case 'complete':
        return !!(data.unknownsChecklist && data.contextualFollowups);
      default:
        return false;
    }
  }, [data]);

  const isSkeleton = pipelineStage === 'none';

  return {
    data,
    pipelineStage,
    isSkeleton,
    setData,
    updateData,
    resetData,
    hasStageData
  };
};

/**
 * usePipelineProgress - Hook for tracking pipeline progress
 */
interface UsePipelineProgressReturn {
  progress: number;
  currentStage: PipelineStage;
  nextStage: PipelineStage | null;
  isComplete: boolean;
  stageInfo: {
    color: string;
    text: string;
    icon: string;
    description: string;
  };
}

export const usePipelineProgress = (pipelineStage: PipelineStage): UsePipelineProgressReturn => {
  const stageOrder: PipelineStage[] = ['none', 'scraped', 'photos-stored', 'text-analysis', 'complete'];
  const currentIndex = stageOrder.indexOf(pipelineStage);
  const progress = (currentIndex / (stageOrder.length - 1)) * 100;
  const nextStage = currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null;
  const isComplete = pipelineStage === 'complete';

  // Import stage info dynamically to avoid circular dependencies
  const stageInfo = React.useMemo(() => {
    const stages = {
      'none': { color: 'bg-gray-200', text: 'No data', icon: '⏳', description: 'No data available yet' },
      'scraped': { color: 'bg-blue-200', text: 'Scraped', icon: '✅', description: 'Basic property info scraped' },
      'photos-stored': { color: 'bg-green-200', text: 'Photos stored', icon: '📸', description: 'Photos uploaded to storage' },
      'text-analysis': { color: 'bg-purple-200', text: 'Text analyzed', icon: '📝', description: 'AI analysis complete' },
      'complete': { color: 'bg-emerald-200', text: 'Complete', icon: '🎉', description: 'All pipeline stages finished' }
    };
    return stages[pipelineStage];
  }, [pipelineStage]);

  return {
    progress,
    currentStage: pipelineStage,
    nextStage,
    isComplete,
    stageInfo
  };
};

export default usePipelineData;
