
import React from "react";

export const Layout2Editorial = ({ data }: { data: any }) => {
  return (
    <div className="h-full overflow-y-auto bg-[#fcfbf9] text-[#1a1a1a] font-serif p-8">
      <div className="max-w-4xl mx-auto">
        {/* Masthead */}
        <header className="border-b-4 border-black pb-4 mb-8">
            <div className="flex justify-between items-end mb-2">
                 <span className="text-xs font-sans font-bold tracking-widest uppercase">Property Intelligence Report</span>
                 <span className="text-xs font-sans text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-2">{data.property_info.title}</h1>
            <div className="flex justify-between items-center font-sans text-sm border-t border-black pt-2">
                <span>{data.property_info.location}</span>
                <span className="font-bold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.property_info.price_eur)}</span>
            </div>
        </header>

        {/* Two Column Layout */}
        <div className="grid grid-cols-[1fr_280px] gap-8">
            {/* Main Column */}
            <div>
                <section className="mb-8">
                    <p className="text-lg leading-relaxed mb-4 first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-[-6px]">
                        {data.house_as_a_whole.narrative_synthesis}
                    </p>
                </section>

                <div className="h-px bg-gray-300 w-full my-6"></div>

                <section className="mb-8">
                    <h2 className="font-sans font-bold text-xl uppercase tracking-wider mb-4 border-b border-black pb-1 inline-block">Forensic Analysis</h2>
                    <div className="columns-2 gap-6 text-[15px] leading-relaxed space-y-4">
                         {['structural_pathology', 'environmental_hostility', 'social_security', 'urban_legality'].map(key => {
                            const section = data.forensic_risk_audit[key];
                            if (!section) return null;
                            return (
                                <div key={key} className="break-inside-avoid mb-6">
                                    <h3 className="font-bold text-lg mb-2 capitalize">{key.replace('_', ' ')}</h3>
                                    <p className="text-gray-700 mb-2">{section.synthesis}</p>
                                    <div className="bg-gray-100 p-3 border-l-2 border-black text-sm font-sans">
                                        <strong>Key Alert:</strong> {section.alerts?.[0]?.replace(/\*\*/g, '')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <div className="h-px bg-gray-300 w-full my-6"></div>

                <section>
                    <h2 className="font-sans font-bold text-xl uppercase tracking-wider mb-4 border-b border-black pb-1 inline-block">Room Report</h2>
                    <div className="grid grid-cols-2 gap-6">
                        {data.execution_reality_check.room_by_room.map((room: any) => (
                            <div key={room.room_id} className="border-t border-gray-200 pt-3">
                                <h3 className="font-bold text-lg">{room.room_name}</h3>
                                <p className="text-sm italic text-gray-600 mb-2 font-sans">{room.one_liner}</p>
                                <ul className="list-square ml-4 text-sm text-gray-800">
                                    {room.renovation_costs?.slice(0,2).map((cost: string, i: number) => (
                                        <li key={i}>{cost}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Sidebar Column */}
            <aside className="font-sans">
                <div className="bg-gray-100 p-4 mb-6">
                    <h3 className="font-bold uppercase text-xs mb-3 border-b border-gray-300 pb-1">Quick Facts</h3>
                    <ul className="space-y-2 text-sm">
                         <li className="flex justify-between"><span>Size</span> <span className="font-mono">{data.property_info.size_m2}m²</span></li>
                         <li className="flex justify-between"><span>Built</span> <span className="font-mono">1975</span></li>
                         <li className="flex justify-between"><span>Rooms</span> <span className="font-mono">{data.property_info.bedrooms}</span></li>
                    </ul>
                </div>

                <div className="mb-6">
                    <h3 className="font-bold uppercase text-xs mb-3 border-b border-black pb-1">Market Context</h3>
                    <p className="text-sm text-gray-600 mb-3">{data.financial_intelligence.market_context.summary}</p>
                    <div className="text-2xl font-bold text-green-700 mb-1">↑ 4%</div>
                    <div className="text-xs text-gray-500">Annual Trend</div>
                </div>

                <div className="bg-amber-50 p-4 border border-amber-100">
                     <h3 className="font-bold uppercase text-xs mb-3 text-amber-900">Opinion</h3>
                     <p className="text-sm text-amber-800 italic">"{data.house_as_a_whole.room_one_liners[0].one_liner}"</p>
                </div>
            </aside>
        </div>
      </div>
    </div>
  );
};

