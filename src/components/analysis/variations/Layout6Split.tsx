
import React from "react";
import { AlertTriangle, Check, X } from "lucide-react";

export const Layout6Split = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
            <header className="text-center mb-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Claims vs. Reality</h1>
                <p className="text-slate-500">A direct comparison of listing marketing and forensic verification.</p>
            </header>

            <div className="grid grid-cols-2 gap-12 relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 transform -translate-x-1/2"></div>
                
                {/* Left: Claims */}
                <div className="pr-6">
                     <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-8 text-right">The Listing</h2>
                     <div className="space-y-12">
                         {/* Metric 1: Size */}
                         <div className="text-right">
                             <div className="text-sm text-slate-400 font-semibold uppercase mb-1">Claimed Size</div>
                             <div className="text-4xl font-light text-slate-800">{data.property_info.size_m2} m²</div>
                             <div className="text-sm text-slate-500 mt-2">"Spacious living area"</div>
                         </div>

                         {/* Metric 2: Condition */}
                         <div className="text-right">
                             <div className="text-sm text-slate-400 font-semibold uppercase mb-1">Claimed Condition</div>
                             <div className="text-2xl font-light text-slate-800">"Para entrar a vivir"</div>
                             <div className="text-sm text-slate-500 mt-2">Implies turnkey condition</div>
                         </div>

                         {/* Metric 3: Location */}
                         <div className="text-right">
                             <div className="text-sm text-slate-400 font-semibold uppercase mb-1">Location</div>
                             <div className="text-2xl font-light text-slate-800">{data.property_info.location}</div>
                             <div className="text-sm text-slate-500 mt-2">"Prime area"</div>
                         </div>
                     </div>
                </div>

                {/* Right: Truth */}
                <div className="pl-6">
                     <h2 className="text-xl font-bold text-indigo-600 uppercase tracking-widest mb-8">The Truth</h2>
                     <div className="space-y-12">
                         {/* Metric 1: Size */}
                         <div>
                             <div className="text-sm text-indigo-400 font-semibold uppercase mb-1 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Cadastral Verification</div>
                             <div className="text-4xl font-bold text-slate-900">85 m²</div>
                             <div className="text-sm text-red-500 mt-2 font-medium">10% Discrepancy found</div>
                         </div>

                         {/* Metric 2: Condition */}
                         <div>
                             <div className="text-sm text-indigo-400 font-semibold uppercase mb-1 flex items-center gap-2"><Check className="h-4 w-4" /> Forensic Audit</div>
                             <div className="text-2xl font-bold text-slate-900">Needs Renovation</div>
                             <ul className="text-sm text-slate-600 mt-2 space-y-1">
                                 <li>• Electrical outdated (1975)</li>
                                 <li>• Plumbing risk</li>
                                 <li>• ~€75k Investment needed</li>
                             </ul>
                         </div>

                          {/* Metric 3: Location */}
                         <div>
                             <div className="text-sm text-indigo-400 font-semibold uppercase mb-1 flex items-center gap-2"><Check className="h-4 w-4" /> Social Radar</div>
                             <div className="text-2xl font-bold text-slate-900">Verified Premium</div>
                             <div className="text-sm text-slate-600 mt-2">
                                 Noise levels verified high (70dB). <br/>
                                 Good neighborhood security.
                             </div>
                         </div>
                     </div>
                </div>
            </div>
            
            <div className="mt-16 bg-indigo-50 border border-indigo-100 rounded-xl p-8 text-center">
                <h3 className="text-lg font-bold text-indigo-900 mb-2">Verdict</h3>
                <p className="text-indigo-800 max-w-2xl mx-auto">{data.house_as_a_whole.narrative_synthesis}</p>
            </div>
        </div>
    </div>
  );
};

