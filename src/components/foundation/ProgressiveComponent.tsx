/**
 * ProgressiveComponent - Core Foundation Component
 * 
 * This component provides the foundation for all progressive components,
 * handling pipeline stage detection, skeleton rendering, and data-driven UI.
 */

import React from 'react';
import { detectPipelineStage, getPipelineStageInfo, PipelineStage } from '@/lib/pipeline-utils';
import { ProgressiveComponentProps, PropertyDataContract } from '@/types/progressive-components';

interface ProgressiveComponentState {
  pipelineStage: PipelineStage;
  isSkeleton: boolean;
}

export const ProgressiveComponent: React.FC<ProgressiveComponentProps> = ({
  data,
  pipelineStage: externalPipelineStage,
  showStageIndicator = true,
  showSkeletonWhenEmpty = true,
  onStageChange,
  className = '',
  children
}) => {
  // Detect pipeline stage from data if not provided externally
  const detectedStage = externalPipelineStage || detectPipelineStage(data);
  const isSkeleton = showSkeletonWhenEmpty && detectedStage === 'none';
  
  // Notify parent of stage changes
  React.useEffect(() => {
    if (onStageChange && detectedStage !== externalPipelineStage) {
      onStageChange(detectedStage);
    }
  }, [detectedStage, externalPipelineStage, onStageChange]);

  const stageInfo = getPipelineStageInfo(detectedStage);

  return (
    <div className={`progressive-component ${className}`}>
      {/* Pipeline Stage Indicator */}
      {showStageIndicator && (
        <div className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${stageInfo.color}`}>
            <span>{stageInfo.icon}</span>
            <span>{stageInfo.text}</span>
            {detectedStage !== 'complete' && detectedStage !== 'none' && (
              <span className="text-xs opacity-75">
                ({stageInfo.description})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="progressive-content">
        {isSkeleton ? (
          <ProgressiveSkeleton pipelineStage={detectedStage} />
        ) : (
          children
        )}
      </div>
    </div>
  );
};

/**
 * ProgressiveSkeleton - Smart skeleton component
 */
interface ProgressiveSkeletonProps {
  pipelineStage: PipelineStage;
  className?: string;
}

const ProgressiveSkeleton: React.FC<ProgressiveSkeletonProps> = ({ 
  pipelineStage, 
  className = '' 
}) => {
  const stageInfo = getPipelineStageInfo(pipelineStage);

  return (
    <div className={`progressive-skeleton ${className}`}>
      <div className="space-y-4">
        {/* Basic skeleton structure */}
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
          
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
        
        {/* Stage-specific skeleton content */}
        {pipelineStage !== 'none' && (
          <div className="text-center text-sm text-gray-500 mt-4">
            {stageInfo.description}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * PipelineIndicator - Reusable stage indicator component
 */
interface PipelineIndicatorProps {
  stage: PipelineStage;
  showDescription?: boolean;
  showProgress?: boolean;
  className?: string;
}

export const PipelineIndicator: React.FC<PipelineIndicatorProps> = ({
  stage,
  showDescription = false,
  showProgress = false,
  className = ''
}) => {
  const stageInfo = getPipelineStageInfo(stage);
  const progress = showProgress ? ((['none', 'scraped', 'photos-stored', 'text-analysis', 'complete'].indexOf(stage) / 4) * 100) : 0;

  return (
    <div className={`pipeline-indicator ${className}`}>
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${stageInfo.color}`}>
        <span>{stageInfo.icon}</span>
        <span>{stageInfo.text}</span>
        {showDescription && (
          <span className="text-xs opacity-75">
            ({stageInfo.description})
          </span>
        )}
      </div>
      
      {showProgress && (
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
          <div 
            className="bg-blue-600 h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

/**
 * ConditionalRender - Helper for stage-based rendering
 */
interface ConditionalRenderProps {
  stage: PipelineStage;
  requiredStages: PipelineStage[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ConditionalRender: React.FC<ConditionalRenderProps> = ({
  stage,
  requiredStages,
  children,
  fallback = null
}) => {
  const hasRequiredStage = requiredStages.includes(stage);
  
  if (hasRequiredStage) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
};

export default ProgressiveComponent;
