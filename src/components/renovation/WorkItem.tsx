"use client";

import React from "react";

interface WorkItemProps {
  item: {
    id: string;
    name: string;
    cost_low_eur: number;
    cost_high_eur: number;
  };
  onHover: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  formatCostRange: (low: number, high: number) => string;
}

export function WorkItem({ 
  item, 
  onHover, 
  onMouseLeave, 
  onClick, 
  formatCostRange 
}: WorkItemProps) {
  return (
    <button
      key={item.id}
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onMouseLeave}
      className="group grid grid-cols-[1fr_auto] items-start gap-x-6 w-full text-left relative cursor-pointer"
      aria-label={`Ver fotos de "${item.name || 'elemento'}"`}
    >
      <div className="relative">
        <span className="absolute -left-5 top-0.5 text-slate-300 group-hover:text-slate-500">→</span>
        <span className="text-sm font-medium text-slate-900 group-hover:text-gray-900 leading-6">
          {item.name || '—'}
        </span>
      </div>
      <span className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">
        {formatCostRange(item.cost_low_eur, item.cost_high_eur)}
      </span>
    </button>
  );
}

