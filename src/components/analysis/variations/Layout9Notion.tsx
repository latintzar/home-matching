
import React from "react";
import { ChevronRight, FileText, MoreHorizontal } from "lucide-react";

export const Layout9Notion = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-white text-[#37352f] p-12 font-sans selection:bg-[#2eaadc] selection:text-white">
        <div className="max-w-[900px] mx-auto">
            {/* Notion Cover */}
            <div className="h-48 w-full bg-gradient-to-r from-pink-200 via-purple-200 to-indigo-200 rounded-t-xl opacity-50 mb-12 relative group">
                 <button className="absolute top-4 right-4 bg-white/50 hover:bg-white px-2 py-1 text-xs rounded transition-colors opacity-0 group-hover:opacity-100">Change cover</button>
            </div>

            {/* Title Area */}
            <div className="relative mb-12">
                 <div className="text-7xl absolute -top-16 left-0 animate-in fade-in slide-in-from-bottom-4 duration-700">🏡</div>
                 <h1 className="text-4xl font-bold mb-4">{data.property_info.title}</h1>
                 <div className="flex gap-4 text-sm text-gray-500 border-b border-gray-200 pb-4">
                     <span className="flex items-center gap-1">📍 {data.property_info.location}</span>
                     <span className="flex items-center gap-1">💶 {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.property_info.price_eur)}</span>
                     <span className="flex items-center gap-1">📅 {new Date().toLocaleDateString()}</span>
                 </div>
            </div>

            {/* Content */}
            <div className="space-y-6 text-[16px] leading-[1.5]">
                 {/* Callout Block */}
                 <div className="bg-[#f1f1ef] p-4 rounded flex gap-3 items-start mb-8">
                     <span className="text-xl">💡</span>
                     <div>
                         <strong className="font-medium text-gray-900 block mb-1">Executive Summary</strong>
                         <p>{data.house_as_a_whole.narrative_synthesis}</p>
                     </div>
                 </div>

                 <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                    <span className="text-gray-400">#</span> Forensic Analysis
                 </h2>

                 {/* Toggle Lists */}
                 {['structural_pathology', 'environmental_hostility', 'urban_legality'].map(key => {
                     const section = data.forensic_risk_audit[key];
                     return (
                         <details key={key} className="group mb-2 cursor-pointer">
                             <summary className="list-none flex items-center gap-2 hover:bg-gray-50 p-1 rounded font-medium select-none">
                                 <ChevronRight className="h-4 w-4 text-gray-400 group-open:rotate-90 transition-transform" />
                                 <span className="capitalize">{key.replace('_', ' ')}</span>
                                 <span className={`text-xs px-1.5 py-0.5 rounded ml-auto ${section.risk_level === 'Low' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{section.risk_level}</span>
                             </summary>
                             <div className="pl-7 pr-4 pt-2 pb-4 text-gray-600">
                                 <p className="mb-3 bg-white border-l-2 border-black pl-3 italic">{section.synthesis}</p>
                                 <ul className="list-disc pl-4 space-y-1">
                                     {section.alerts.map((a: string, i: number) => (
                                         <li key={i}>{a.replace(/\*\*/g, '')}</li>
                                     ))}
                                 </ul>
                             </div>
                         </details>
                     )
                 })}

                 <h2 className="text-2xl font-semibold mt-12 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                    <span className="text-gray-400">#</span> Renovation Scope
                 </h2>

                 {/* Database View */}
                 <div className="border border-gray-200 rounded overflow-hidden mb-8">
                     <div className="flex bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 p-2">
                         <div className="w-1/3 pl-2">Room Name</div>
                         <div className="w-1/3 border-l border-gray-200 pl-2">Condition</div>
                         <div className="w-1/3 border-l border-gray-200 pl-2">Cost Est.</div>
                     </div>
                     {data.execution_reality_check.room_by_room.map((room: any, i: number) => (
                         <div key={i} className="flex border-b border-gray-100 text-sm hover:bg-gray-50 p-2 last:border-0">
                             <div className="w-1/3 pl-2 flex items-center gap-2">
                                 <FileText className="h-3 w-3 text-gray-400" />
                                 {room.room_name}
                             </div>
                             <div className="w-1/3 border-l border-gray-100 pl-2 text-gray-600 truncate pr-2">
                                 <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded text-xs mr-2">Renovate</span>
                                 {room.one_liner}
                             </div>
                             <div className="w-1/3 border-l border-gray-100 pl-2 font-mono text-xs text-gray-500 pt-1">
                                 {room.renovation_costs?.[0] || '-'}
                             </div>
                         </div>
                     ))}
                      <div className="p-2 text-gray-400 text-sm flex gap-2 items-center cursor-pointer hover:bg-gray-50">
                         <span className="font-light text-xl pl-1">+</span> New
                      </div>
                 </div>

            </div>
        </div>
    </div>
  );
};

