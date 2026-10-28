
import React from "react";
import { ArrowDown, CheckCircle, Circle, CircleDot } from "lucide-react";

export const Layout5Timeline = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-white p-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-slate-900">The Journey Home</h1>
        <p className="text-slate-500 mb-10">A chronological guide to making this property yours.</p>

        <div className="relative pl-8 border-l-2 border-slate-200 space-y-16">
            {/* Step 1: Diagnosis */}
            <div className="relative">
                <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-indigo-600 border-4 border-white shadow-sm"></div>
                <div className="mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Phase 1: Purchase Due Diligence</span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">Understand What You're Buying</h2>
                </div>
                
                <div className="bg-slate-50 rounded-lg p-6 border border-slate-100">
                    <h3 className="font-semibold mb-3 text-slate-900">Critical Checks Before Signing</h3>
                    <ul className="space-y-4">
                        {data.forensic_risk_audit.urban_legality.alerts.map((alert: string, i: number) => (
                             <li key={i} className="flex gap-3 items-start">
                                <CircleDot className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-slate-900">{alert.replace(/\*\*/g, '').split(':')[0]}</p>
                                    <p className="text-sm text-slate-600">{alert.split(':')[1]}</p>
                                </div>
                             </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Step 2: Negotiation */}
             <div className="relative">
                <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-slate-300 border-4 border-white shadow-sm"></div>
                <div className="mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded">Phase 2: The Offer</span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">Use Leverage to Negotiate</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                     {data.financial_intelligence.market_context.negotiation_leverage.map((item: string, i: number) => (
                         <div key={i} className="bg-white border border-slate-200 p-4 rounded shadow-sm">
                             <p className="text-sm font-medium text-slate-800">"{item}"</p>
                             <p className="text-xs text-slate-500 mt-2">Use this to reduce asking price.</p>
                         </div>
                     ))}
                </div>
            </div>

            {/* Step 3: Renovation Planning */}
             <div className="relative">
                <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-slate-300 border-4 border-white shadow-sm"></div>
                <div className="mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded">Phase 3: The Transformation</span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">Execution Roadmap ({data.execution_reality_check.renovation_reality.timeline_expectations.find((t: string) => t.includes("Total"))?.replace('Total:', '') || '6 months'})</h2>
                </div>
                
                <div className="space-y-6">
                    <div className="flex items-center gap-4 bg-white p-4 rounded border border-slate-200 shadow-sm">
                        <div className="text-center px-4 border-r border-slate-100">
                            <div className="text-2xl font-bold text-slate-900">1</div>
                            <div className="text-xs text-slate-500">Month</div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Projects & Licenses</h4>
                            <p className="text-xs text-slate-600">{data.execution_reality_check.renovation_reality.timeline_expectations[0]}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-4 bg-white p-4 rounded border border-slate-200 shadow-sm">
                        <div className="text-center px-4 border-r border-slate-100">
                            <div className="text-2xl font-bold text-slate-900">4</div>
                            <div className="text-xs text-slate-500">Months</div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Heavy Works</h4>
                            <p className="text-xs text-slate-600">Demolition, Installations, Masonry.</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-4 bg-white p-4 rounded border border-slate-200 shadow-sm">
                        <div className="text-center px-4 border-r border-slate-100">
                            <div className="text-2xl font-bold text-slate-900">2</div>
                            <div className="text-xs text-slate-500">Months</div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Finishes & Furniture</h4>
                            <p className="text-xs text-slate-600">Painting, carpentry, moving in.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step 4: Living */}
            <div className="relative">
                <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-green-500 border-4 border-white shadow-sm"></div>
                <div className="mb-4">
                     <span className="text-xs font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-1 rounded">Phase 4: Future Value</span>
                     <h2 className="text-xl font-bold text-slate-900 mt-2">Living & ROI</h2>
                </div>
                <p className="text-slate-600 leading-relaxed">
                    {data.financial_intelligence.market_context.summary}
                </p>
            </div>

        </div>
      </div>
    </div>
  );
};

