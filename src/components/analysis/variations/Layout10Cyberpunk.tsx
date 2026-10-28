
import React from "react";
import { Terminal } from "lucide-react";

export const Layout10Cyberpunk = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-[#0d0221] text-[#00f0ff] p-8 font-mono selection:bg-[#f00] selection:text-white">
       <div className="max-w-6xl mx-auto border border-[#00f0ff]/30 shadow-[0_0_20px_rgba(0,240,255,0.2)] p-8 bg-[#0d0221] relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-50"></div>
           
           {/* Header */}
           <div className="flex justify-between items-start mb-12 border-b border-[#00f0ff]/30 pb-6">
               <div>
                   <h1 className="text-4xl font-bold tracking-widest mb-2 drop-shadow-[0_0_5px_#00f0ff]">{data.property_info.title.toUpperCase()}</h1>
                    <p className="text-[#ff003c] font-bold tracking-widest text-sm">{'>>'} SECTOR: {data.property_info.location.toUpperCase()}</p>
               </div>
               <div className="text-right">
                   <div className="text-xs text-[#00f0ff]/60 mb-1">SYSTEM_STATUS: ONLINE</div>
                   <div className="text-xs text-[#00f0ff]/60">ENCRYPTION: NONE</div>
                   <div className="mt-2 text-2xl font-bold text-white bg-[#ff003c] px-2 inline-block transform -skew-x-12">
                       {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.property_info.price_eur)}
                   </div>
               </div>
           </div>

           {/* Main Grid */}
           <div className="grid grid-cols-12 gap-8">
               
               {/* Left Data Stream */}
               <div className="col-span-4 border-r border-[#00f0ff]/20 pr-8 space-y-8">
                   <div className="bg-[#00f0ff]/5 p-4 border border-[#00f0ff]/20">
                       <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Terminal className="h-4 w-4" /> LOG_ENTRY_001</h2>
                       <p className="text-xs leading-relaxed text-[#00f0ff]/80 font-light">{data.house_as_a_whole.narrative_synthesis}</p>
                   </div>

                   <div>
                       <h3 className="text-xs font-bold text-[#ff003c] mb-2 uppercase">{'>>'} THREAT_DETECTION</h3>
                       <div className="space-y-2">
                           {['structural_pathology', 'urban_legality'].map(key => {
                               const section = data.forensic_risk_audit[key];
                               return (
                                   <div key={key} className="border border-[#ff003c]/40 p-3 bg-[#ff003c]/5">
                                       <div className="flex justify-between text-[10px] text-[#ff003c] mb-1">
                                           <span>TARGET: {key.toUpperCase()}</span>
                                           <span className="animate-pulse">{section.risk_level.toUpperCase()}</span>
                                       </div>
                                       <div className="text-xs text-white/90">{section.alerts[0].replace(/\*\*/g, '')}</div>
                                   </div>
                               )
                           })}
                       </div>
                   </div>
               </div>

               {/* Center Visual */}
               <div className="col-span-8">
                   <div className="grid grid-cols-2 gap-4 mb-8">
                       <div className="border border-[#00f0ff]/30 p-1">
                           <div className="bg-[#00f0ff]/10 h-full flex items-center justify-center aspect-video relative overflow-hidden group">
                                <div className="absolute inset-0 grid grid-cols-6 grid-rows-6">
                                    {[...Array(36)].map((_, i) => <div key={i} className="border-[0.5px] border-[#00f0ff]/5"></div>)}
                                </div>
                                <img src="https://source.unsplash.com/random/800x600?cyberpunk" className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity group-hover:opacity-60 transition-opacity" alt="cyber" />
                                <div className="z-10 bg-black/80 px-4 py-2 border border-[#00f0ff] text-xs tracking-widest">VISUAL_FEED_A</div>
                           </div>
                       </div>
                       <div className="border border-[#00f0ff]/30 p-4 bg-[#00f0ff]/5">
                           <h3 className="text-sm font-bold text-white mb-4 border-b border-[#00f0ff]/30 pb-2">EXECUTION_PROTOCOL</h3>
                           <ul className="space-y-3">
                               {data.execution_reality_check.renovation_reality.cost_estimates.map((c: string, i: number) => (
                                   <li key={i} className="flex items-center gap-2 text-xs">
                                       <span className="text-[#ff003c]">{'>>'}</span>
                                       <span className="text-[#00f0ff]">{c.split(':')[0]}</span>
                                       <span className="text-white ml-auto">{c.split(':')[1] || ''}</span>
                                   </li>
                               ))}
                           </ul>
                       </div>
                   </div>

                   <div className="border-t border-[#00f0ff]/20 pt-6">
                       <h3 className="text-sm font-bold text-white mb-4">UNIT_ANALYSIS_ARRAY</h3>
                       <div className="grid grid-cols-3 gap-4">
                           {data.execution_reality_check.room_by_room.slice(0,3).map((room: any, i: number) => (
                               <div key={i} className="bg-[#00f0ff]/5 p-3 border border-[#00f0ff]/20 hover:bg-[#00f0ff]/10 transition-colors">
                                   <div className="text-[10px] text-[#00f0ff]/60 mb-1">SECTOR_{i+1}</div>
                                   <div className="text-sm font-bold text-white mb-2">{room.room_name}</div>
                                   <div className="text-[10px] text-[#ff003c] font-bold uppercase">{room.one_liner.split(' ')[0]}...</div>
                               </div>
                           ))}
                       </div>
                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};

