
import React from "react";

export const Layout8Blueprint = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-[#003366] text-blue-100 p-8 font-mono" 
         style={{ backgroundImage: 'linear-gradient(#004080 1px, transparent 1px), linear-gradient(90deg, #004080 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        <div className="max-w-5xl mx-auto border-4 border-white/20 p-8 relative">
            <div className="absolute top-0 left-0 bg-white/10 px-4 py-2 text-xs uppercase tracking-widest">Project: {data.listing_id}</div>
            <div className="absolute top-0 right-0 bg-white/10 px-4 py-2 text-xs uppercase tracking-widest">Status: ANALYSIS_COMPLETE</div>

            <header className="mb-12 border-b border-white/20 pb-8">
                <h1 className="text-4xl font-bold text-white mb-2 uppercase">{data.property_info.title}</h1>
                <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="block text-blue-400 text-xs">Location</span>
                        {data.property_info.location}
                    </div>
                    <div>
                        <span className="block text-blue-400 text-xs">Price</span>
                        {data.property_info.price_eur} EUR
                    </div>
                    <div>
                        <span className="block text-blue-400 text-xs">Date</span>
                        {new Date(data.generated_at).toLocaleDateString()}
                    </div>
                    <div>
                        <span className="block text-blue-400 text-xs">Version</span>
                        v1.0.4-BETA
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-3 gap-8">
                {/* Column 1: Structural Data */}
                <div className="col-span-1 border-r border-white/20 pr-8">
                    <h2 className="text-xl font-bold text-white mb-6 border-b border-white/20 pb-2 uppercase">System Diagnostics</h2>
                    {['structural_pathology', 'environmental_hostility'].map(key => {
                        const section = data.forensic_risk_audit[key];
                        return (
                            <div key={key} className="mb-8">
                                <h3 className="text-sm font-bold text-blue-300 mb-2 uppercase">{key.replace('_', ' ')}</h3>
                                <div className="bg-[#002244] border border-white/10 p-4">
                                    <div className="flex justify-between text-xs mb-2 border-b border-white/10 pb-1">
                                        <span>RISK_LEVEL</span>
                                        <span className={section.risk_level === 'Low' ? 'text-green-400' : 'text-red-400'}>{section.risk_level.toUpperCase()}</span>
                                    </div>
                                    <ul className="space-y-1">
                                        {section.alerts.map((a: string, i: number) => (
                                            <li key={i} className="text-xs leading-tight text-blue-200 opacity-80">{'>'} {a.replace(/\*\*/g, '')}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )
                    })}
                </div>

                 {/* Column 2: Scope & Spec */}
                 <div className="col-span-2">
                    <h2 className="text-xl font-bold text-white mb-6 border-b border-white/20 pb-2 uppercase">Execution Specification</h2>
                    
                    <div className="bg-[#002244] border border-white/10 p-6 mb-8">
                         <h3 className="text-sm font-bold text-blue-300 mb-4 uppercase">// MASTER PLAN SUMMARY</h3>
                         <p className="text-sm leading-relaxed font-light text-white opacity-90 mb-4">{data.execution_reality_check.renovation_reality.summary}</p>
                         
                         <div className="grid grid-cols-3 gap-4">
                             {data.execution_reality_check.renovation_reality.cost_estimates.map((c: string, i: number) => (
                                 <div key={i} className="border border-dashed border-white/30 p-2 text-center">
                                     <div className="text-xs text-blue-400 uppercase mb-1">Est. Cost {i+1}</div>
                                     <div className="text-sm font-bold">{c.split(':')[1] || c}</div>
                                 </div>
                             ))}
                         </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {data.execution_reality_check.room_by_room.map((room: any, i: number) => (
                            <div key={i} className="border border-white/10 p-4 hover:bg-white/5 transition-colors cursor-crosshair">
                                <div className="flex justify-between items-center mb-2">
                                     <h4 className="font-bold text-sm uppercase">{room.room_name}</h4>
                                     <span className="text-[10px] bg-blue-900 px-1 border border-blue-500 text-blue-300">ID: {room.room_id}</span>
                                </div>
                                <p className="text-xs text-blue-200 mb-2 border-l-2 border-blue-500 pl-2">{room.one_liner}</p>
                                <div className="text-[10px] text-blue-400 font-bold mt-2">REQ_ACTIONS:</div>
                                <div className="text-[10px] text-blue-300">{room.renovation_costs?.length || 0} items pending</div>
                            </div>
                        ))}
                    </div>
                 </div>
            </div>
        </div>
    </div>
  );
};

