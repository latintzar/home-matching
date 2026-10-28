
import React from "react";

export const Layout4Visual = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-black text-white scroll-smooth snap-y snap-mandatory">
        {/* Section 1: Hero */}
        <section className="h-full w-full relative flex items-center justify-center snap-start">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/90 z-10" />
            <img src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60" alt="hero" />
            <div className="relative z-20 text-center px-6 max-w-3xl">
                <h1 className="text-6xl font-bold tracking-tighter mb-4 shadow-xl">{data.property_info.title}</h1>
                <p className="text-2xl font-light opacity-90">{data.property_info.location}</p>
                <div className="mt-8 inline-block border border-white/30 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full text-lg">
                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.property_info.price_eur)}
                </div>
            </div>
            <div className="absolute bottom-10 left-0 right-0 text-center z-20 animate-bounce text-white/50">
                ↓ Scroll to explore
            </div>
        </section>

        {/* Section 2: The Vibe (Synthesis) */}
        <section className="min-h-screen w-full relative flex items-center p-12 snap-start bg-[#121212]">
            <div className="grid grid-cols-2 gap-16 max-w-6xl mx-auto items-center">
                <div>
                     <h2 className="text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">The Soul of the House</h2>
                     <p className="text-xl leading-relaxed text-gray-300 mb-8">{data.house_as_a_whole.narrative_synthesis}</p>
                     <div className="flex flex-wrap gap-3">
                        {data.house_as_a_whole.cross_room_themes.map((t: string, i: number) => (
                            <span key={i} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm">{t}</span>
                        ))}
                     </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="aspect-[3/4] bg-gray-800 rounded-2xl overflow-hidden transform translate-y-8">
                        <img src="https://images.unsplash.com/photo-1556911220-e15b29be8c8f" className="w-full h-full object-cover" alt="vibe1" />
                    </div>
                    <div className="aspect-[3/4] bg-gray-800 rounded-2xl overflow-hidden transform -translate-y-8">
                        <img src="https://images.unsplash.com/photo-1513694203232-719a280e022f" className="w-full h-full object-cover" alt="vibe2" />
                    </div>
                </div>
            </div>
        </section>

        {/* Section 3: The Risks (Cards) */}
        <section className="min-h-screen w-full bg-slate-950 p-12 flex items-center snap-start">
            <div className="max-w-7xl mx-auto w-full">
                <h2 className="text-4xl font-bold mb-12 text-center">Forensic Reality</h2>
                <div className="grid grid-cols-3 gap-6">
                    {['structural_pathology', 'environmental_hostility', 'social_security'].map((key, i) => {
                        const section = data.forensic_risk_audit[key];
                        return (
                            <div key={i} className="group relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer">
                                <img src={`https://source.unsplash.com/random/800x1000?building,${i}`} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale group-hover:grayscale-0" alt="risk" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90" />
                                <div className="absolute bottom-0 left-0 p-8">
                                    <div className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">{section.risk_level} RISK</div>
                                    <h3 className="text-2xl font-bold mb-4 capitalize">{key.replace('_', ' ')}</h3>
                                    <p className="text-sm text-gray-300 line-clamp-3 group-hover:line-clamp-none transition-all">{section.synthesis}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>

         {/* Section 4: Room by Room (Horizontal Scroll) */}
         <section className="h-screen w-full bg-[#050505] flex flex-col justify-center p-12 snap-start">
             <h2 className="text-4xl font-bold mb-8 px-8">Room Inspector</h2>
             <div className="flex gap-8 overflow-x-auto px-8 pb-8 snap-x">
                 {data.execution_reality_check.room_by_room.map((room: any, i: number) => (
                     <div key={i} className="snap-center shrink-0 w-[400px] bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-all">
                         <div className="h-64 bg-gray-800 relative">
                            <img src={`https://source.unsplash.com/random/800x600?interior,${i}`} className="w-full h-full object-cover" alt="room" />
                            <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded backdrop-blur text-sm font-bold">{room.room_name}</div>
                         </div>
                         <div className="p-6">
                             <p className="text-lg italic text-gray-400 mb-4">"{room.one_liner}"</p>
                             <div className="space-y-4">
                                 <div>
                                     <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Issues</h4>
                                     <ul className="space-y-1">
                                        {room.findings.map((f: string, j: number) => <li key={j} className="text-sm text-gray-300">• {f}</li>)}
                                     </ul>
                                 </div>
                                 <div>
                                     <h4 className="text-xs font-bold uppercase text-green-500 mb-2">Cost to Fix</h4>
                                     <div className="flex flex-wrap gap-2">
                                        {room.renovation_costs?.map((c: string, j: number) => (
                                            <span key={j} className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded border border-green-500/20">{c}</span>
                                        ))}
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 ))}
             </div>
         </section>
    </div>
  );
};

