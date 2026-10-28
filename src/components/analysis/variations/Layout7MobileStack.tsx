
import React from "react";

export const Layout7MobileStack = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-slate-100 p-4 flex justify-center">
        <div className="w-full max-w-md space-y-4">
             {/* Header Card */}
             <div className="bg-white rounded-3xl shadow-sm p-6">
                 <div className="flex justify-between items-start mb-4">
                     <div>
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">{data.property_info.title}</h1>
                        <p className="text-sm text-slate-500 mt-1">{data.property_info.location}</p>
                     </div>
                     <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.property_info.price_eur)}
                     </div>
                 </div>
                 <div className="h-32 bg-slate-200 rounded-2xl mb-4 overflow-hidden">
                    <img src="https://source.unsplash.com/random/800x600?apartment" className="w-full h-full object-cover" alt="hero" />
                 </div>
                 <p className="text-sm text-slate-600 leading-relaxed">{data.house_as_a_whole.narrative_synthesis}</p>
             </div>

             {/* Risk Feed */}
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-4">Forensic Feed</div>
             
             {['structural_pathology', 'environmental_hostility'].map((key, i) => {
                 const section = data.forensic_risk_audit[key];
                 return (
                     <div key={key} className="bg-white rounded-3xl shadow-sm p-6 border-l-8 border-amber-400">
                         <div className="flex justify-between mb-2">
                            <h3 className="font-bold text-slate-900 capitalize">{key.replace('_', ' ')}</h3>
                            <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded">{section.risk_level}</span>
                         </div>
                         <p className="text-sm text-slate-600 mb-4">{section.synthesis}</p>
                         <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-xs font-bold text-slate-700 mb-1">Top Alert</p>
                            <p className="text-xs text-slate-600">{section.alerts[0].replace(/\*\*/g, '')}</p>
                         </div>
                     </div>
                 )
             })}

             {/* Rooms Horizontal Scroll */}
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-4 mt-6">Room Scan</div>
             <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
                 {data.execution_reality_check.room_by_room.map((room: any, i: number) => (
                     <div key={i} className="bg-white rounded-2xl shadow-sm p-4 w-64 shrink-0 snap-center">
                         <div className="h-24 bg-slate-100 rounded-xl mb-3 overflow-hidden">
                            <img src={`https://source.unsplash.com/random/400x300?room,${i}`} className="w-full h-full object-cover" alt="room" />
                         </div>
                         <h3 className="font-bold text-slate-900 mb-1">{room.room_name}</h3>
                         <p className="text-xs text-slate-500 line-clamp-2">{room.one_liner}</p>
                     </div>
                 ))}
             </div>
        </div>
    </div>
  );
};

