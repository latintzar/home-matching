'use client';

import { ScopeItem } from '@/types/renovation';

interface FinalWorkItem {
  id: string;
  name: string;
  subtitle?: string;
  cost_low_eur: number;
  cost_high_eur: number;
  stage: string;  // Timeline phase name
}

interface ScopeTableProps {
  scope: ScopeItem[] | FinalWorkItem[];
  totals?: [number, number] | { low?: number; high?: number } | { min?: number; max?: number };
}

export function ScopeTable({ scope }: ScopeTableProps) {
  const isFinal = (row: any): row is FinalWorkItem => {
    return row && typeof row === 'object' && 'cost_low_eur' in row && 'stage' in row && 'name' in row;
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Project Plan</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {isFinal((scope as any)[0]) ? (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Low</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost High</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Range</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Range</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {scope.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No work items available
                </td>
              </tr>
            ) : (
              scope.map((item: any, index) => {
                const finalItem = isFinal(item);
                if (!finalItem) {
                  console.warn('Item does not match FinalWorkItem structure:', item);
                }
                return (
                  <tr key={item.id || index} className="hover:bg-gray-50 align-top">
                    {finalItem ? (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{item.name || '—'}</div>
                          {item.subtitle && (
                            <div className="text-xs text-gray-500 mt-0.5">{item.subtitle}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.stage || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">€{Math.round(item.cost_low_eur || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">€{Math.round(item.cost_high_eur || 0).toLocaleString()}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm text-gray-900">{(item as any).category || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            const permit = (item as any).permit as string;
                            const isNone = /sin permisos|none/i.test(permit);
                            return isNone ? (
                              <span className="text-xs text-gray-500">No permit needed</span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{permit}</span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{(item as any).timeRange || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{(item as any).costRange || '—'}</td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
