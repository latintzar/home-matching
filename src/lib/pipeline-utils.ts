/**
 * Pipeline Utilities for Progressive Component Pattern
 * 
 * This module provides utilities for detecting pipeline stages and managing
 * progressive component rendering based on data availability.
 */

export type PipelineStage = 'none' | 'scraped' | 'photos-stored' | 'text-analysis' | 'complete';

export interface PipelineStageInfo {
  color: string;
  text: string;
  icon: string;
  description: string;
}

export const PIPELINE_STAGES: Record<PipelineStage, PipelineStageInfo> = {
  'none': { 
    color: 'bg-gray-200', 
    text: 'No data', 
    icon: '⏳',
    description: 'No data available yet'
  },
  'scraped': { 
    color: 'bg-blue-200', 
    text: 'Scraped', 
    icon: '✅',
    description: 'Basic property info scraped'
  },
  'photos-stored': { 
    color: 'bg-green-200', 
    text: 'Photos stored', 
    icon: '📸',
    description: 'Photos uploaded to storage'
  },
  'text-analysis': { 
    color: 'bg-purple-200', 
    text: 'Text analyzed', 
    icon: '📝',
    description: 'AI analysis complete'
  },
  'complete': { 
    color: 'bg-emerald-200', 
    text: 'Complete', 
    icon: '🎉',
    description: 'All pipeline stages finished'
  }
} as const;

/**
 * Detects the current pipeline stage based on available data
 */
export const detectPipelineStage = (data: any): PipelineStage => {
  if (!data) {
    return 'none';
  }
  
  const hasBasicInfo = data.title || data.price || data.constructedArea;
  const hasPhotos = data.photos && data.photos.length > 0;
  const hasTextAnalysis = data.headlines && data.headlines.length > 0;
  const hasFullAnalysis = data.unknownsChecklist && data.contextualFollowups;
  
  if (hasFullAnalysis) {
    return 'complete';
  }
  if (hasTextAnalysis) {
    return 'text-analysis';
  }
  if (hasPhotos) {
    return 'photos-stored';
  }
  if (hasBasicInfo) {
    return 'scraped';
  }
  return 'none';
};

/**
 * Gets pipeline stage information
 */
export const getPipelineStageInfo = (stage: PipelineStage): PipelineStageInfo => {
  return PIPELINE_STAGES[stage];
};

/**
 * Checks if a pipeline stage has specific data available
 */
export const hasStageData = (data: any, stage: PipelineStage): boolean => {
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
};

/**
 * Gets the next pipeline stage
 */
export const getNextPipelineStage = (currentStage: PipelineStage): PipelineStage | null => {
  const stageOrder: PipelineStage[] = ['none', 'scraped', 'photos-stored', 'text-analysis', 'complete'];
  const currentIndex = stageOrder.indexOf(currentStage);
  return currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null;
};

/**
 * Gets pipeline progress percentage
 */
export const getPipelineProgress = (stage: PipelineStage): number => {
  const stageOrder: PipelineStage[] = ['none', 'scraped', 'photos-stored', 'text-analysis', 'complete'];
  const currentIndex = stageOrder.indexOf(stage);
  return (currentIndex / (stageOrder.length - 1)) * 100;
};
