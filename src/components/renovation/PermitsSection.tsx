'use client';

import { PermitStep } from '@/types/renovation';

interface PermitsSectionProps {
  permits: Array<
    (PermitStep & { why_needed?: string; what_needed?: string; how_obtained?: string }) |
    { permit_type: string; why_needed: string; documentation_required: string[]; issuing_authority: string; expected_time_weeks: number; common_pitfalls?: string[] }
  >;
}

export function PermitsSection({ permits }: PermitsSectionProps) {
  const getPermitColor = (type: string) => {
    switch (type) {
      case 'obra-menor':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'obra-mayor':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'certificado-energetico':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Permits You Need</h3>
      
      <div className="grid grid-cols-1 gap-4">
        {permits.map((permit: any, index) => (
          <div
            key={index}
            className="p-4 rounded-lg border border-gray-200 bg-gray-50"
          >
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-gray-900">{permit.step || permit.permit_type}</h4>
            </div>
            
            {(permit.why_needed || permit?.why_needed) && (
              <div className="mb-3">
                <h5 className="text-xs font-medium text-gray-700 mb-1">Why needed:</h5>
                <p className="text-xs text-gray-600">{permit.why_needed}</p>
              </div>
            )}
            
            {(permit.what_needed || permit.documentation_required?.length) && (
              <div className="mb-3">
                <h5 className="text-xs font-medium text-gray-700 mb-1">What's needed:</h5>
                <p className="text-xs text-gray-600">{permit.what_needed || (permit.documentation_required || []).join(', ')}</p>
              </div>
            )}
            
            {(permit.how_obtained || permit.issuing_authority) && (
              <div>
                <h5 className="text-xs font-medium text-gray-700 mb-1">How to obtain:</h5>
                <p className="text-xs text-gray-600">{permit.how_obtained || `Authority: ${permit.issuing_authority}`}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
