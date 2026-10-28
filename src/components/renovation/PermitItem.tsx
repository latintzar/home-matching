"use client";

import React from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { FileText, ChevronDown } from "lucide-react";

interface PermitItemProps {
  permit: {
    permit_type: string;
    why_needed?: string;
    what_needed?: string[];
    documentation_required?: string[];
    issuing_authority?: string;
    expected_time_weeks?: number;
    pitfalls?: string[];
  };
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

export function PermitItem({ permit, isOpen, onToggle }: PermitItemProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger
        aria-expanded={isOpen}
        className="w-full text-left group"
      >
        <div className="flex items-start gap-3 py-1 hover:text-gray-900 transition-colors">
          <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 group-hover:text-gray-950">
                {permit.permit_type}
              </span>
              {permit.expected_time_weeks && permit.expected_time_weeks > 0 && (
                <span className="text-xs text-gray-500 tabular-nums">
                  ({permit.expected_time_weeks} week{permit.expected_time_weeks !== 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 mt-0.5 ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-7 pr-1 pt-2 pb-3">
        <div className="text-xs text-slate-700 leading-relaxed space-y-2.5">
          {permit.why_needed && (
            <div>
              <span className="font-semibold text-gray-900">Why needed:</span>
              <span className="ml-2 text-gray-700">{permit.why_needed}</span>
            </div>
          )}
          {((permit.what_needed?.length ?? 0) > 0 || (permit.documentation_required?.length ?? 0) > 0) && (
            <div>
              <div className="font-semibold text-gray-900 mb-1">Required documents:</div>
              <ul className="list-disc ml-5 space-y-1 text-gray-700">
                {(permit.what_needed || permit.documentation_required || []).map((doc: string, i: number) => (
                  <li key={i}>{doc}</li>
                ))}
              </ul>
            </div>
          )}
          {permit.issuing_authority && (
            <div>
              <span className="font-semibold text-gray-900">Issuing authority:</span>
              <span className="ml-2 text-gray-700">{permit.issuing_authority}</span>
            </div>
          )}
          {permit.pitfalls && permit.pitfalls.length > 0 && (
            <div>
              <div className="font-semibold text-gray-900 mb-1">Common pitfalls:</div>
              <ul className="list-disc ml-5 space-y-1 text-gray-700">
                {permit.pitfalls.map((pitfall: string, pitfallIdx: number) => (
                  <li key={pitfallIdx}>{pitfall}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

