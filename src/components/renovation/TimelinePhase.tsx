"use client";

import React from "react";
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import { WorkItem } from "./WorkItem";
import { PermitItem } from "./PermitItem";

interface TimelinePhaseProps {
  phase: {
    name?: string;
    header?: string;
    milestone?: string;
    summary?: string;
    description?: string;
    subtitle?: string;
    weeks?: number;
    duration_weeks?: number;
  };
  phaseIndex: number;
  weeksFromStart: number;
  workItems: Array<{
    id: string;
    name: string;
    cost_low_eur: number;
    cost_high_eur: number;
    room_ref?: string | null;
    photo_refs?: string[];
  }>;
  permits: Array<{
    permit_type: string;
    why_needed?: string;
    what_needed?: string[];
    documentation_required?: string[];
    issuing_authority?: string;
    expected_time_weeks?: number;
    pitfalls?: string[];
    applies_to_work_ids?: string[];
  }>;
  openPermits: Record<string, boolean>;
  onPermitToggle: (key: string, open: boolean) => void;
  onWorkItemHover: (item: any) => void;
  onWorkItemMouseLeave: () => void;
  onWorkItemClick: (item: any) => void;
  formatCostRange: (low: number, high: number) => string;
}

export function TimelinePhase({
  phase,
  phaseIndex,
  weeksFromStart,
  workItems,
  permits,
  openPermits,
  onPermitToggle,
  onWorkItemHover,
  onWorkItemMouseLeave,
  onWorkItemClick,
  formatCostRange
}: TimelinePhaseProps) {
  return (
    <TimelineItem>
      {/* Time from start - LEFT SIDE */}
      <TimelineOppositeContent
        sx={{ 
          m: 0, 
          fontFamily: 'inherit', 
          display: 'flex', 
          alignItems: 'flex-start', 
          width: 80, 
          justifyContent: 'flex-end', 
          textAlign: 'right', 
          flex: '0 0 80px', 
          pt: 0,
          alignSelf: 'flex-start'
        }}
        align="right"
        variant="body2"
        color="text.secondary"
      >
        <div className="text-xs text-muted-foreground leading-tight text-right w-full" style={{ lineHeight: '1.75rem', paddingTop: '0.125rem' }}>
          {weeksFromStart > 0 ? `Week ${weeksFromStart}` : 'Start'}
        </div>
      </TimelineOppositeContent>

      {/* Center line - dot hidden, line visible */}
      <TimelineSeparator sx={{ marginLeft: '5px' }}>
        <TimelineConnector />
        <TimelineDot sx={{ display: 'none' }} />
        <TimelineConnector />
      </TimelineSeparator>

      {/* Content - RIGHT SIDE */}
      <TimelineContent sx={{ pl: 0.5, pr: 0, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', marginLeft: '5px', pb: (workItems.length > 0 || permits.length > 0) ? 3 : 2 }}>
        {/* Phase Header - Aligned with time text */}
        <div className="mb-4 pb-3 border-b border-gray-200">
          <div className="text-2xl font-bold tracking-tight text-gray-900 leading-7" style={{ lineHeight: '1.75rem' }}>
            {(phase.name || phase.header || '').replace(/^Fase \d+:\s*/i, '').replace(/^Fase \d+\s*/i, '')}
          </div>
          <div className="text-base text-slate-600 leading-6 mt-1 line-clamp-2">
            {phase.milestone || phase.summary || phase.description || phase.subtitle || ''}
          </div>
        </div>
        
        {/* Work Items List */}
        {workItems.length > 0 && (
          <div className="mt-1 space-y-3 pl-5">
            {workItems.map((item) => (
              <WorkItem
                key={item.id}
                item={item}
                onHover={() => onWorkItemHover(item)}
                onMouseLeave={onWorkItemMouseLeave}
                onClick={() => onWorkItemClick(item)}
                formatCostRange={formatCostRange}
              />
            ))}
            {/* Phase Total - tinted summary bar */}
            {workItems.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 grid grid-cols-[1fr_auto] items-center">
                  <div className="text-xs font-bold text-gray-800 uppercase tracking-wide">Phase total</div>
                  <div className="text-sm font-bold text-gray-900 whitespace-nowrap tabular-nums">
                    {formatCostRange(
                      workItems.reduce((sum, item) => sum + (item.cost_low_eur || 0), 0),
                      workItems.reduce((sum, item) => sum + (item.cost_high_eur || 0), 0)
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Permits */}
        {permits.length > 0 && (
          <div className="mt-6 space-y-3 pl-5">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Permits needed</div>
            {permits.map((permit, permitIdx) => {
              const permitKey = `phase-${phaseIndex}-permit-${permitIdx}`;
              return (
                <PermitItem
                  key={permitKey}
                  permit={permit}
                  isOpen={openPermits[permitKey] || false}
                  onToggle={(open) => onPermitToggle(permitKey, open)}
                />
              );
            })}
          </div>
        )}
        
        {/* No items message */}
        {workItems.length === 0 && permits.length === 0 && (
          <div className="text-xs text-muted-foreground italic mt-2 ml-2 pl-5 py-2">
            No work items or permits assigned to this phase
          </div>
        )}
      </TimelineContent>
    </TimelineItem>
  );
}

